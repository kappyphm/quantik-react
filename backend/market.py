"""Read-through Vnstock market board, independent of scan publication."""
from __future__ import annotations

import threading
import time
import math
from datetime import datetime, timezone

from quant_engine.crawl_data import DataProvider
from quant_engine.quant import ScreenerBridge
from engine import bars_from_frame

_lock = threading.Lock()
_listing = (0.0, [])
_index = (0.0, [])
_pages = {}


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _symbols():
    global _listing
    if time.monotonic() - _listing[0] < 6 * 3600 and _listing[1]:
        return _listing[1]
    provider = DataProvider()
    symbols = provider.get_stock_list('ALL')
    if not symbols:
        raise RuntimeError('Vnstock không trả danh sách mã')
    _listing = (time.monotonic(), symbols)
    return symbols


def _index_bars():
    global _index
    if time.monotonic() - _index[0] < 300 and _index[1]:
        return _index[1]
    frame = ScreenerBridge().fetch_index('VNINDEX', days=64)
    if frame is None:
        raise RuntimeError('Vnstock không trả dữ liệu VN-Index')
    _index = (time.monotonic(), bars_from_frame(frame))
    return _index[1]


def overview(page: int, page_size: int) -> dict:
    """Fetch current quotes for the requested page; never substitute fixture prices."""
    key = (page, page_size)
    with _lock:
        cached = _pages.get(key)
        if cached and time.monotonic() - cached[0] < 60:
            return cached[1]
        symbols = _symbols()
        page_symbols = symbols[(page - 1) * page_size:page * page_size]
        if not page_symbols:
            items = []
        else:
            frame = DataProvider().get_price_board(page_symbols)
            if frame is None or frame.empty:
                raise RuntimeError('Vnstock không trả bảng giá')
            rows = {str(row['symbol']).upper(): row for _, row in frame.iterrows()}
            items = []
            for symbol in page_symbols:
                row = rows.get(symbol)
                if row is None:
                    items.append({'symbol': symbol, 'exchange': '—', 'price': None,
                                  'change': None, 'change_pct': None, 'volume': None})
                    continue
                price = _number(row.get('close_price'))
                reference = _number(row.get('reference_price'))
                volume = _number(row.get('volume_accumulated'))
                exchange = str(row.get('exchange')).strip()
                if exchange.casefold() in ('', 'nan', 'none', '<na>'):
                    exchange = '—'
                if price is None or reference is None or price <= 0 or reference <= 0:
                    items.append({'symbol': symbol, 'exchange': exchange,
                                  'price': None, 'change': None, 'change_pct': None,
                                  'volume': int(volume) if volume is not None and volume >= 0 else None})
                    continue
                items.append({'symbol': symbol, 'exchange': exchange,
                              'price': price, 'change': price - reference,
                              'change_pct': (price / reference - 1) * 100,
                              'volume': int(volume) if volume is not None and volume >= 0 else None})
        index_bars = _index_bars()
        result = {'source': 'vnstock_price_board',
                  'as_of': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                  'delay_minutes': None, 'delay_disclosure': 'not_disclosed_by_provider',
                  'market_status': 'provider_snapshot',
                  'run_id': None, 'total': len(symbols), 'page': page,
                  'page_size': page_size, 'breadth': None,
                  'index_bars': index_bars, 'items': items}
        _pages[key] = (time.monotonic(), result)
        return result
