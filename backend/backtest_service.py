"""Point-in-time evaluation of recommendations stored in published scans."""
from __future__ import annotations

import os
import statistics
import unicodedata

from store import connect, loads


def _fold(value) -> str:
    text = unicodedata.normalize("NFD", str(value or "").upper())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def _is_buy(value) -> bool:
    action = _fold(value).replace("_", " ")
    return ("BUY" in action or "MUA" in action) and "KHONG" not in action


def recommendation_backtest(symbol: str, current_bars: list[dict]) -> dict:
    """Evaluate prior published BUY signals at the next close and a fixed later close.

    A scan can only contribute after its full holding horizon exists in the price
    series. This deliberately excludes the current signal and incomplete trades.
    """
    horizon = max(1, int(os.getenv("QUANTIK_BACKTEST_HORIZON_SESSIONS", "20")))
    minimum = max(1, int(os.getenv("QUANTIK_BACKTEST_MIN_SAMPLES", "5")))
    cost_pct = max(0.0, float(os.getenv("QUANTIK_BACKTEST_ROUND_TRIP_COST_PCT", "0.30")))
    with connect() as db:
        rows = db.execute("""SELECT r.id,r.data_as_of,s.summary_json,s.ohlcv_json
                             FROM scan_runs r JOIN scan_results s ON s.run_id=r.id
                             WHERE r.status='published' AND r.id NOT LIKE 'DEMO-%'
                             AND s.symbol=? ORDER BY r.data_as_of,r.published_at""", (symbol,)).fetchall()

    prices = {}
    for bar in current_bars:
        if bar.get("time") and bar.get("close") is not None:
            prices[str(bar["time"])[:10]] = float(bar["close"])
    for row in rows:
        for bar in loads(row["ohlcv_json"], []):
            if bar.get("time") and bar.get("close") is not None:
                prices[str(bar["time"])[:10]] = float(bar["close"])
    sessions = sorted(prices)
    position = {day: index for index, day in enumerate(sessions)}

    trades, seen_dates = [], set()
    for row in rows:
        signal_date = str(row["data_as_of"] or "")[:10]
        summary = loads(row["summary_json"], {})
        if not signal_date or signal_date in seen_dates or not _is_buy(summary.get("recommendation")):
            continue
        entry_index = next((index for index, day in enumerate(sessions) if day > signal_date), None)
        if entry_index is None or entry_index + horizon >= len(sessions):
            continue
        entry_day, exit_day = sessions[entry_index], sessions[entry_index + horizon]
        entry, exit_price = prices[entry_day], prices[exit_day]
        if entry <= 0:
            continue
        net_return = (exit_price / entry - 1) * 100 - cost_pct
        trades.append({"run_id": row["id"], "signal_date": signal_date,
                       "entry_date": entry_day, "exit_date": exit_day,
                       "recommendation": summary.get("recommendation"),
                       "entry": round(entry, 2), "exit": round(exit_price, 2),
                       "net_return_pct": round(net_return, 2), "win": net_return > 0})
        seen_dates.add(signal_date)

    base = {"method": "published_point_in_time", "horizon_sessions": horizon,
            "round_trip_cost_pct": cost_pct, "sample_size": len(trades),
            "minimum_samples": minimum}
    if len(trades) < minimum:
        return {**base, "status": "insufficient_history",
                "reason": f"Cần ít nhất {minimum} tín hiệu MUA đã công bố và đủ {horizon} phiên theo dõi; hiện có {len(trades)}."}
    returns = [trade["net_return_pct"] for trade in trades]
    return {**base, "status": "completed",
            "period": {"from": trades[0]["signal_date"], "to": trades[-1]["exit_date"]},
            "win_rate_pct": round(100 * sum(trade["win"] for trade in trades) / len(trades), 2),
            "average_return_pct": round(statistics.fmean(returns), 2),
            "median_return_pct": round(statistics.median(returns), 2),
            "best_return_pct": round(max(returns), 2), "worst_return_pct": round(min(returns), 2),
            "trades": trades[-50:]}
