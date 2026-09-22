"""Adapters around copied, verified quant-core code. Never import quant-core/ itself."""
from __future__ import annotations

import math
import os
import re
import time
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


def analysis_status(error: str | None) -> str:
    if not error:
        return "completed"
    if error.startswith("Liquidity gate failed"):
        return "screened_out"
    if error.startswith(("NO_OHLCV", "Insufficient data", "Data quality failed")):
        return "insufficient_data"
    return "failed"


def resolve_universe(symbols=None, provider=None):
    exchanges = {}
    if symbols is None:
        if provider is None:
            from quant_engine.crawl_data import DataProvider
            provider = DataProvider()
        symbols = []
        for exchange in ("HOSE", "HNX", "UPCOM"):
            listed = provider.get_stock_list(exchange)
            symbols.extend(listed)
            for symbol in listed:
                exchanges.setdefault(str(symbol).upper(), exchange)
    universe = list(dict.fromkeys(str(symbol).upper() for symbol in symbols
                                  if re.fullmatch(r"[A-Z0-9]{3,5}", str(symbol).upper())))
    return universe, exchanges


def scan_all(progress, symbols=None, checkpoint_dir: Path | None = None, universe_ready=None):
    """Collect all three exchanges, screen each fetched code and batch QUANT once."""
    import pandas as pd
    from quant_engine.quant import QuantPipeline, ScreenerBridge, _simplify_user_summary

    progress("universe", 3, "Đang lấy danh sách HOSE, HNX, UPCoM")
    universe, universe_exchanges = resolve_universe(symbols)
    if not universe:
        raise RuntimeError("Nguồn dữ liệu không trả danh sách mã; không công bố run rỗng")
    if universe_ready:
        universe_ready(len(universe))
    bridge = ScreenerBridge()
    data, failed, screening = {}, {}, {}
    if checkpoint_dir is not None:
        checkpoint_dir = Path(checkpoint_dir)
        checkpoint_dir.mkdir(parents=True, exist_ok=True)
    request_delay = max(0.0, float(os.getenv("QUANTIK_FETCH_INTERVAL_SECONDS", "1.5")))
    progress("collecting", 5, f"Đang thu thập OHLCV cho {len(universe)} mã")
    for index, symbol in enumerate(universe, 1):
        try:
            cache_file = checkpoint_dir / f"{symbol}.csv" if checkpoint_dir else None
            frame = None
            if cache_file and cache_file.is_file():
                try:
                    frame = pd.read_csv(cache_file, index_col=0, parse_dates=True)
                    if not {"open", "high", "low", "close", "volume"}.issubset(frame.columns) or len(frame) < 30:
                        frame = None
                    elif cache_file.with_suffix(".source").is_file():
                        frame.attrs["source"] = cache_file.with_suffix(".source").read_text(encoding="utf-8").strip()
                except (OSError, ValueError):
                    frame = None
            if frame is None:
                for attempt in range(3):
                    time.sleep(request_delay)
                    try:
                        fetched = bridge.fetch_ohlcv([symbol], days=252, delay=0)
                        frame = fetched.get(symbol)
                        break
                    except SystemExit:
                        if attempt == 2:
                            raise RuntimeError(f"Vnstock từ chối sau 3 lần thử: {symbol}")
                        progress("collecting", 5 + int(55 * index / len(universe)), "Đạt giới hạn Vnstock; chờ 65 giây")
                        time.sleep(65)
                if frame is not None and cache_file:
                    temporary = cache_file.with_suffix(".tmp")
                    frame.to_csv(temporary)
                    temporary.replace(cache_file)
                    cache_file.with_suffix(".source").write_text(str(frame.attrs.get("source") or "unknown"), encoding="utf-8")
            if frame is None:
                failed[symbol] = "NO_OHLCV"
            else:
                data[symbol] = frame
                try:
                    screening[symbol] = screen_frame(symbol, frame)
                except Exception as exc:
                    screening[symbol] = {"error": f"{type(exc).__name__}: {exc}"}
        except Exception as exc:
            if isinstance(exc, RuntimeError) and str(exc).startswith("Vnstock từ chối"):
                raise
            failed[symbol] = f"{type(exc).__name__}: {exc}"
        if index == len(universe) or index % 10 == 0:
            progress("collecting", 5 + int(55 * index / len(universe)), f"Thu thập {index}/{len(universe)} mã")
    if not data:
        raise RuntimeError("Không có mã nào có OHLCV hợp lệ")

    progress("quantifying", 64, f"Đang phân tích định lượng {len(data)} mã")
    index_frame = bridge.fetch_index("VNINDEX", days=252)
    exchanges = dict(universe_exchanges)
    missing_exchange = [symbol for symbol in data if symbol not in exchanges]
    if missing_exchange:
        exchanges.update(bridge.fetch_exchange_map(missing_exchange))
    pipeline = QuantPipeline()
    screener_rows = [{"Mã CK": sym, "Tín hiệu": item.get("assessment", {}).get("overall_signal", "")}
                     for sym, item in screening.items() if "assessment" in item]
    last_reported = {"value": 0}
    def quant_progress(stage, current, total, symbol):
        if stage == "analyzing":
            if current != total and current - last_reported["value"] < 10:
                return
            last_reported["value"] = current
            pct = 64 + int(23 * current / max(1, total))
            progress("quantifying", pct, f"Đã chạy QUANT {current}/{total} mã{f' · {symbol}' if symbol else ''}")
        elif stage == "cross_sectional":
            progress("cross_sectional", 88, "Đang huấn luyện và áp dụng mô hình cross-sectional")
        elif stage == "complete":
            progress("scoring", 90, "Đã hoàn tất chấm điểm toàn sàn")
    reports = pipeline.batch(data, scr_df=pd.DataFrame(screener_rows), idx_df=index_frame,
                             exchange_map=exchanges, progress_callback=quant_progress)
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
        error = failed.get(symbol) or screening.get(symbol, {}).get("error") or (report or {}).get("error")
        status = analysis_status(error)
        action = str(row.get("Action") or "UNKNOWN") if status == "completed" else None
        summary = {
            "symbol": symbol, "name": symbol, "exchange": exchanges.get(symbol, "UNKNOWN"),
            "recommendation": (display.get("Khuyến nghị") or action) if status == "completed" else None,
            "gate_pass": bool(row.get("GatePass", False)) if status == "completed" else False,
            "gate_explanation": (display.get("Giải thích điều kiện") or "") if status == "completed" else error,
            "score": row.get("Score") if status == "completed" else None,
            "rating": (display.get("Đánh giá") or "Chưa đánh giá") if status == "completed" else None,
            "hold_plan": display.get("Thời gian nắm giữ") if status == "completed" else None,
            "vni_trend": display.get("Xu hướng VN-Index"),
            "sector": display.get("Nhóm ngành"),
            "sector_trend": display.get("Xu hướng ngành"),
            "analysis_status": status,
        }
        detail = {**summary, "raw_action": action, "screener": screening.get(symbol, {}),
                  "quant": clean(report) if report else {}, "commentary": row.get("Analysis") or "",
                  "error": error, "listing_status": "listed",
                  "source_meta": {"ohlcv": data[symbol].attrs.get("source") if symbol in data else None}}
        results.append((summary, detail, bars_from_frame(data[symbol]) if symbol in data else []))
    return {"universe_count": len(universe),
            "analyzed_count": sum(r[0]["analysis_status"] in ("completed", "screened_out") for r in results),
            "failed_count": sum(r[0]["analysis_status"] in ("failed", "insufficient_data") for r in results),
            "index_bars": bars_from_frame(index_frame) if index_frame is not None else [],
            "data_as_of": max((bars[-1]["time"] for _, _, bars in results if bars), default=None),
            "results": results}


def _quant_with_frames(symbol, frame, index, exchange, progress, output_dir: Path,
                       include_backtest=True, source_mode="live_fetch"):
    from quant_engine.quant import QuantPipeline, ScreenerBridge
    from quant_engine.quant_visuals import generate_quant_visuals

    progress("models", 35, "Đang chạy các mô hình định lượng")
    report = QuantPipeline().batch({symbol: frame}, idx_df=index, exchange_map={symbol: exchange})[0]
    if report.get("error"):
        raise RuntimeError(report["error"])
    progress("risk", 75, "Đang tổng hợp rủi ro và báo cáo")
    presentation = present_report(report, frame)
    presentation["score_comparable"] = False  # Batch một mã không có phân phối toàn sàn.
    presentation["score_comparability_reason"] = "Job một mã không chạy lại phân phối cross-sectional toàn sàn."
    presentation["include_backtest"] = include_backtest
    presentation["data_source_mode"] = source_mode
    progress("visual", 89, "Đang tạo biểu đồ QUANT")
    visuals = generate_quant_visuals(symbol, output_dir=output_dir, formats=("png",),
                                     report=report, price_data=frame)
    return presentation, visuals, bars_from_frame(frame)


def frame_from_bars(bars):
    import pandas as pd
    frame = pd.DataFrame(bars)
    if frame.empty or not {"time", "open", "high", "low", "close", "volume"}.issubset(frame.columns):
        raise RuntimeError("Snapshot không có OHLCV hợp lệ")
    frame["time"] = pd.to_datetime(frame["time"], errors="raise")
    return frame.set_index("time").sort_index()


def quant_from_snapshot(symbol, bars, index_bars, exchange, progress, output_dir: Path, include_backtest=True):
    progress("fetch", 12, "Đọc OHLCV và VN-Index từ snapshot đã công bố")
    return _quant_with_frames(symbol, frame_from_bars(bars), frame_from_bars(index_bars), exchange,
                              progress, output_dir, include_backtest, "published_scan_snapshot")
