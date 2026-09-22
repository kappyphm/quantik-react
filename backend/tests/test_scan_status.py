import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from engine import analysis_status


class ScanStatusTest(unittest.TestCase):
    def test_liquidity_rejection_is_not_processing_failure(self):
        self.assertEqual(analysis_status(None), 'completed')
        self.assertEqual(analysis_status('Liquidity gate failed'), 'screened_out')
        self.assertEqual(analysis_status('NO_OHLCV'), 'insufficient_data')
        self.assertEqual(analysis_status('Data quality failed: stale'), 'insufficient_data')
        self.assertEqual(analysis_status('ValueError: invalid bars'), 'failed')


if __name__ == '__main__':
    unittest.main()
