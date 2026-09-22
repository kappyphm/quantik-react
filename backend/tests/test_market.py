"""Market board responses must remain valid JSON when a provider row is sparse."""
import json
import math
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import market


class MarketTest(unittest.TestCase):
    def setUp(self):
        market._listing = (0.0, [])
        market._index = (0.0, [])
        market._pages = {}

    def test_sparse_provider_values_are_returned_as_null(self):
        board = pd.DataFrame([
            {'symbol': 'AAA', 'exchange': 'HOSE', 'close_price': 10,
             'reference_price': 9.5, 'volume_accumulated': 1000},
            {'symbol': 'BBB', 'exchange': 'HNX', 'close_price': math.nan,
             'reference_price': 12, 'volume_accumulated': math.nan},
        ])
        with patch.object(market, 'DataProvider') as provider, \
             patch.object(market, '_index_bars', return_value=[{'time': '2026-09-22', 'close': 1700}]):
            provider.return_value.get_stock_list.return_value = ['AAA', 'BBB']
            provider.return_value.get_price_board.return_value = board
            result = market.overview(1, 5)
        self.assertEqual(result['items'][0]['volume'], 1000)
        self.assertIsNone(result['items'][1]['price'])
        self.assertIsNone(result['items'][1]['volume'])
        json.dumps(result, allow_nan=False)


if __name__ == '__main__':
    unittest.main()
