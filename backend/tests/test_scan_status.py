import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine import (align_index_cutoff, align_market_cutoff, analysis_status,
                    resolve_company_names, resolve_universe)
from worker import validate_scan_result


class ScanStatusTest(unittest.TestCase):
    def test_universe_keeps_exchange_for_failed_symbols(self):
        class Provider:
            def get_stock_list(self, exchange):
                return {'HOSE': ['FPT', 'DUP'], 'HNX': ['DUP', 'IDC'], 'UPCOM': ['ABB']}[exchange]
        universe, exchanges = resolve_universe(provider=Provider())
        self.assertEqual(universe, ['FPT', 'DUP', 'IDC', 'ABB'])
        self.assertEqual(exchanges, {'FPT': 'HOSE', 'DUP': 'HOSE', 'IDC': 'HNX', 'ABB': 'UPCOM'})

    def test_company_names_only_enrich_the_resolved_universe(self):
        class Listing:
            def all_symbols(self):
                return pd.DataFrame([{'symbol': 'FPT', 'organ_name': 'CTCP FPT'},
                                     {'symbol': 'OTHER', 'organ_name': 'Không thuộc universe'}])
        self.assertEqual(resolve_company_names(['FPT'], Listing()), {'FPT': 'CTCP FPT'})

    def test_liquidity_rejection_is_not_processing_failure(self):
        self.assertEqual(analysis_status(None), 'completed')
        self.assertEqual(analysis_status('Liquidity gate failed'), 'screened_out')
        self.assertEqual(analysis_status('NO_OHLCV'), 'insufficient_data')
        self.assertEqual(analysis_status('Data quality failed: stale'), 'insufficient_data')
        self.assertEqual(analysis_status('ValueError: invalid bars'), 'failed')

    def test_publication_checks_slot_and_freshness(self):
        result = {'universe_count': 2, 'analyzed_count': 2,
                  'index_bars': [{'time': '2026-09-21'}], 'data_as_of': '2026-09-21',
                  'results': [({'analysis_status': 'completed'}, {}, [{'time': '2026-09-21'}]),
                              ({'analysis_status': 'screened_out'}, {}, [{'time': '2026-09-21'}])]}
        validate_scan_result(result, 'PRE_OPEN', '2026-09-22')
        with self.assertRaisesRegex(RuntimeError, 'POST_CLOSE'):
            validate_scan_result(result, 'POST_CLOSE', '2026-09-22')
        result['results'][1][2][0]['time'] = '2026-09-18'
        with self.assertRaisesRegex(RuntimeError, 'cùng ngày'):
            validate_scan_result(result, 'MANUAL', '2026-09-22')

    def test_publication_counts_insufficient_data_as_processed(self):
        result = {'universe_count': 3, 'analyzed_count': 3,
                  'index_bars': [{'time': '2026-09-21'}], 'data_as_of': '2026-09-21',
                  'results': [({'analysis_status': 'completed'}, {}, [{'time': '2026-09-21'}]),
                              ({'analysis_status': 'screened_out'}, {}, [{'time': '2026-09-21'}]),
                              ({'analysis_status': 'insufficient_data'}, {}, [])]}
        validate_scan_result(result, 'MANUAL', '2026-09-22')

    def test_market_cutoff_uses_the_modal_completed_date(self):
        def frame(*days):
            return pd.DataFrame({'open': 1, 'high': 1, 'low': 1, 'close': 1, 'volume': 1},
                                index=pd.to_datetime(days))
        cutoff, aligned = align_market_cutoff({
            'AAA': frame('2026-09-20', '2026-09-21'),
            'BBB': frame('2026-09-20', '2026-09-21'),
            'CCC': frame('2026-09-21', '2026-09-22'),
        })
        self.assertEqual(cutoff.isoformat(), '2026-09-21')
        self.assertEqual(str(aligned['CCC'].index[-1])[:10], '2026-09-21')
        index = frame('2026-09-20', '2026-09-21', '2026-09-22')
        self.assertEqual(str(align_index_cutoff(index, cutoff).index[-1])[:10], '2026-09-21')


if __name__ == '__main__':
    unittest.main()
