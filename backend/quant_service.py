"""Single-symbol quant analysis and JSON chart data for the React report."""
from __future__ import annotations

from datetime import date
from functools import lru_cache

import numpy as np



def _number(value):
    try:
        value = float(value)
        return value if np.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def _series(values):
    return [_number(value) for value in values]


def _json(value):
    if isinstance(value, dict):
        return {str(key): _json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, np.ndarray)):
        return [_json(item) for item in value]
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (int, float, np.integer, np.floating)):
        return _number(value)
    return value


@lru_cache(maxsize=64)
def analyze_symbol(symbol: str, session: str | None = None) -> dict:
    """Compute once per symbol/day. Do not ship raw Monte Carlo paths to the browser."""
    from quant_engine.quant import QuantPipeline, ScreenerBridge
    symbol = symbol.upper().strip()
    bridge = ScreenerBridge()
    data = bridge.fetch_ohlcv([symbol], days=252)
    if symbol not in data:
        raise ValueError(f"Không lấy được OHLCV cho {symbol}")
    index = bridge.fetch_index('VNINDEX', days=252)
    exchange = bridge.fetch_exchange_map([symbol])
    report = QuantPipeline().batch(data, idx_df=index, exchange_map=exchange)[0]
    if report.get('error'):
        raise ValueError(report['error'])
    return present_report(report, data[symbol])


def present_report(report: dict, prices) -> dict:
    """Browser-sized diagnostics from a completed quant run and its exact OHLCV."""
    symbol = report['symbol']
    prices = prices.sort_index()
    close = prices['close'].astype(float)
    dates = [str(day)[:10] for day in close.index]
    drawdown = (close / close.cummax() - 1) * 100

    fcast = report.get('fcast', {})
    paths = fcast.get('_mc_paths')
    cone = None
    histogram = None
    if paths is not None:
        paths = np.asarray(paths, dtype=float)
        if paths.ndim == 2 and paths.shape[1] > 1 and np.isfinite(paths).all():
            quantiles = np.percentile(paths, [10, 25, 50, 75, 90], axis=0)
            cone = {f'p{q}': _series(quantiles[i]) for i, q in enumerate((10, 25, 50, 75, 90))}
            returns = paths[:, -1] / float(close.iloc[-1]) * 100 - 100
            edges = np.histogram_bin_edges(returns, bins='fd')
            counts, edges = np.histogram(returns, bins=edges)
            cutoff = np.percentile(returns, 5)
            histogram = {'edges': _series(edges), 'counts': counts.astype(int).tolist(),
                         'median': _number(np.median(returns)), 'var95': _number(cutoff),
                         'cvar95': _number(returns[returns <= cutoff].mean())}

    hmm = report.get('hmm', {})
    state_dates = [str(day)[:10] for day in hmm.get('_state_dates', [])]
    state_labels = hmm.get('_state_labels', [])
    price_by_date = dict(zip(dates, _series(close)))
    regime = [{'date': day, 'close': price_by_date[day], 'state': state}
              for day, state in zip(state_dates, state_labels) if day in price_by_date]
    return _json({
        'symbol': symbol, 'as_of': dates[-1],
        'score': report.get('rec', {}).get('score'),
        'rating': report.get('rec', {}).get('rating'),
        'action': report.get('action', {}).get('action'),
        'commentary': report.get('commentary') or '',
        'dist': report.get('dist', {}),
        'stats': report.get('stats', {}),
        'vol': report.get('vol', {}),
        'ac': report.get('ac', {}),
        'arima': report.get('arima', {}),
        'garch': report.get('garch', {}),
        'hmm': {key: hmm.get(key) for key in ('current', 'prob_pct', 'state_probs', 'bic')},
        'fcast': {key: fcast.get(key) for key in ('ensemble_ret_pct', 'agreement_pct', 'coverage_pct', 'timing_status', 'horizon', 'mc', 'lock_risk')},
        'levels': {key: report.get('sl', {}).get(key) for key in ('entry', 'sl_swing', 'tp1', 'tp2')},
        'charts': {
            'history': {'dates': dates[-80:], 'close': _series(close.tail(80))},
            'drawdown': {'dates': dates, 'values': _series(drawdown)},
            'regime': regime,
            'probability_cone': cone,
            'return_distribution': histogram,
        },
    })


def today_session() -> str:
    return date.today().isoformat()
