"""Adapters around copied, verified quant-core code. Never import quant-core/ itself."""
from __future__ import annotations

import math
from pathlib import Path

from quant_service import present_report


def clean(value):
    """Compact JSON-safe representation, excluding internal Monte Carlo paths."""
    import numpy as np
    import pandas as pd

    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items() if not str(k).startswith("_")}
    if isinstance(value, (list, tuple, np.ndarray)):
        return [clean(v) for v in value]
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        n = float(value)
        return n if math.isfinite(n) else None
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if value is None or isinstance(value, str):
        return value
    return str(value)


def bars_from_frame(frame):
    out = []
    for day, row in frame.sort_index().iterrows():
        out.append({"time": str(day)[:10], **{key: float(row[key]) for key in ("open", "high", "low", "close")},
                    "volume": int(row["volume"])})
    return out


def screen_frame(symbol, frame):
    from quant_engine.crawl_data import FeatureEngine, ScreeningEngine, AnalysisEngine

    prepared = frame.reset_index().rename(columns={frame.index.name or "index": "time"})
    features = FeatureEngine.compute_features(prepared)
    strong = ScreeningEngine.screen_strong(features)
    accumulation = ScreeningEngine.screen_accumulation(features)
    distribution = ScreeningEngine.screen_distribution(features)
    assessment = AnalysisEngine.generate_assessment(symbol, features, strong, accumulation, distribution)
    return clean({"strong": strong, "accumulation": accumulation,
                  "distribution": distribution, "assessment": assessment})


def scan_all(progress, symbols=None):
    """Collect all three exchanges, screen each fetched code and batch QUANT once."""
    import pandas as pd
    from quant_engine.quant import QuantPipeline, ScreenerBridge, _simplify_user_summary

    progress("universe", 3, "Đang lấy danh sách HOSE, HNX, UPCoM")
    if symbols is None:
        from quant_engine.crawl_data import DataProvider
        symbols = DataProvider().get_stock_list("ALL")
    universe = list(dict.fromkeys(symbols))
    if not universe:
        raise RuntimeError("Nguồn dữ liệu không trả danh sách mã; không công bố run rỗng")
    bridge = ScreenerBridge()
    data, failed, screening = {}, {}, {}
    progress("collecting", 5, f"Đang thu thập OHLCV cho {len(universe)} mã")
    for index, symbol in enumerate(universe, 1):
        try:
            fetched = bridge.fetch_ohlcv([symbol], days=252, delay=0)
            frame = fetched.get(symbol)
            if frame is None:
                failed[symbol] = "NO_OHLCV"
            else:
                data[symbol] = frame
                try:
                    screening[symbol] = screen_frame(symbol, frame)
                except Exception as exc:
                    screening[symbol] = {"error": f"{type(exc).__name__}: {exc}"}
        except Exception as exc:
            failed[symbol] = f"{type(exc).__name__}: {exc}"
        if index == len(universe) or index % 10 == 0:
            progress("collecting", 5 + int(55 * index / len(universe)), f"Thu thập {index}/{len(universe)} mã")
    if not data:
        raise RuntimeError("Không có mã nào có OHLCV hợp lệ")

    progress("quantifying", 64, f"Đang phân tích định lượng {len(data)} mã")
    index_frame = bridge.fetch_index("VNINDEX", days=252)
    exchanges = bridge.fetch_exchange_map(list(data))
    pipeline = QuantPipeline()
    screener_rows = [{"Mã CK": sym, "Tín hiệu": item.get("assessment", {}).get("overall_signal", "")}
                     for sym, item in screening.items() if "assessment" in item]
    reports = pipeline.batch(data, scr_df=pd.DataFrame(screener_rows), idx_df=index_frame,
                             exchange_map=exchanges)
    summary_frame = pipeline.summary_table(reports)
    summaries = {str(row["Symbol"]): clean(row.to_dict()) for _, row in summary_frame.iterrows()}
    localized_frame = _simplify_user_summary(summary_frame)
    localized = {str(row["Mã"]): clean(row.to_dict()) for _, row in localized_frame.iterrows()}
    progress("validating", 91, "Đang kiểm tra độ phủ và chuẩn bị công bố")
    results = []
    for symbol in universe:
        report = next((r for r in reports if r.get("symbol") == symbol), None)
        row = summaries.get(symbol, {})
        display = localized.get(symbol, {})
        error = failed.get(symbol) or (report or {}).get("error")
        action = str(row.get("Action") or "UNKNOWN")
        summary = {
            "symbol": symbol, "name": symbol, "exchange": exchanges.get(symbol, "UNKNOWN"),
            "recommendation": display.get("Khuyến nghị") or action,
            "gate_pass": bool(row.get("GatePass", False)),
            "gate_explanation": display.get("Giải thích điều kiện") or error or "",
            "score": row.get("Score"), "rating": display.get("Đánh giá") or "Chưa đánh giá",
            "hold_plan": display.get("Thời gian nắm giữ") or "—",
            "vni_trend": display.get("Xu hướng VN-Index") or "—",
            "sector": display.get("Nhóm ngành") or "Không xác định",
            "sector_trend": display.get("Xu hướng ngành") or "—",
            "analysis_status": "failed" if error else "completed",
        }
        detail = {**summary, "raw_action": action, "screener": screening.get(symbol, {}),
                  "quant": clean(report) if report else {}, "commentary": row.get("Analysis") or "",
                  "error": error, "source_meta": {"ohlcv": data[symbol].attrs.get("source") if symbol in data else None}}
        results.append((summary, detail, bars_from_frame(data[symbol]) if symbol in data else []))
    return {"universe_count": len(universe), "analyzed_count": sum(r[0]["analysis_status"] == "completed" for r in results),
            "failed_count": sum(r[0]["analysis_status"] == "failed" for r in results),
            "index_bars": bars_from_frame(index_frame) if index_frame is not None else [],
            "data_as_of": max((bars[-1]["time"] for _, _, bars in results if bars), default=None),
            "results": results}


def quant_one(symbol, progress, output_dir: Path, include_backtest=True):
    from quant_engine.quant import QuantPipeline, ScreenerBridge
    from quant_engine.quant_visuals import generate_quant_visuals

    bridge = ScreenerBridge()
    progress("fetch", 12, "Đang tải OHLCV và VN-Index")
    data = bridge.fetch_ohlcv([symbol], days=252)
    if symbol not in data:
        raise RuntimeError(f"Không lấy được OHLCV cho {symbol}")
    index = bridge.fetch_index("VNINDEX", days=252)
    exchange = bridge.fetch_exchange_map([symbol])
    progress("models", 35, "Đang chạy các mô hình định lượng")
    report = QuantPipeline().batch(data, idx_df=index, exchange_map=exchange)[0]
    if report.get("error"):
        raise RuntimeError(report["error"])
    progress("risk", 75, "Đang tổng hợp rủi ro và báo cáo")
    presentation = present_report(report, data[symbol])
    presentation["score_comparable"] = False  # Batch một mã không có phân phối toàn sàn.
    presentation["include_backtest"] = include_backtest
    progress("visual", 89, "Đang tạo biểu đồ QUANT")
    visuals = generate_quant_visuals(symbol, output_dir=output_dir, formats=("png",),
                                     report=report, price_data=data[symbol])
    return presentation, visuals
