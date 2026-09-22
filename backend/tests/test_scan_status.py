import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine import analysis_status
from worker import validate_scan_result


class ScanStatusTest(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
