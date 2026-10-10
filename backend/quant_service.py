"""Single-symbol quant analysis and JSON chart data for the React report."""
from __future__ import annotations

from datetime import date
from functools import lru_cache

import numpy as np
from quant_explanations import module_reports



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
            quantiles = np.percentile(paths, [5, 10, 25, 50, 75, 90, 95], axis=0)
            cone = {f'p{q}': _series(quantiles[i]) for i, q in enumerate((5, 10, 25, 50, 75, 90, 95))}
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
    # Export small aggregates from the exact run; never ship raw MC paths.
    distribution = []
    if histogram and sum(histogram['counts']):
        count = sum(histogram['counts'])
        distribution = [{'returnPct': (histogram['edges'][i]+histogram['edges'][i+1])/2,
                         'probabilityPct': n/count*100} for i,n in enumerate(histogram['counts'])]
    factors = [{'id': key, 'label': key, 'value': val.get('z'), 'min': -1, 'max': 1}
               for key,val in (report.get('rec', {}).get('factor_details') or {}).items()
               if isinstance(val,dict) and _number(val.get('z')) is not None]
    risk_values = [('var','VaR95',histogram.get('var95') if histogram else None),
                   ('cvar','CVaR95',histogram.get('cvar95') if histogram else None),
                   ('lock_drawdown','Drawdown T-lock',fcast.get('lock_risk', {}).get('max_dd_lock_pct')),
                   ('probability_loss','P(lỗ > 3%)',fcast.get('lock_risk', {}).get('prob_loss_gt_3pct'))]
    research = {
        'schemaVersion': 1, 'symbol': symbol, 'mode': 'eod', 'asOf': dates[-1],
        'source': 'QUANT · OHLCV của phiên phân tích', 'units': {'price':'VND','return':'pct'},
        'horizonSessions': fcast.get('horizon'),
        'simulationCount': int(paths.shape[0]) if cone else None,
        'cone': [{'session':i, **{f'p{q:02}':cone[f'p{q}'][i] for q in (5,25,50,75,95)}}
                 for i in range(len(cone['p50']))] if cone else [],
        'distribution': distribution,
        # Core preserves hard labels only. Do not invent historical posterior probabilities.
        'regime': [{'date':p['date'],'price':p['close'],'state':p['state'],'probabilities':None} for p in regime],
        'drawdown': [{'date':d,'valuePct':v} for d,v in zip(dates,_series(drawdown))],
        'factors': factors,
        'riskMetrics': [{'id':key,'label':label,'value':value,'unit':'%'} for key,label,value in risk_values if _number(value) is not None],
    }
    return _json({
        'module_reports': module_reports(report, prices),
        'flow': report.get('flow', {}),
        'trend': report.get('trend', {}),
        'data_lineage': {'observations': len(prices), 'start': dates[0], 'end': dates[-1],
                         'interval': '1D', 'price_unit': 'VND'},
        'research': research,
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
