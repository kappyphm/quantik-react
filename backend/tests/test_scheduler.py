"""Scheduler must create each slot near its configured time, not hours later."""
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import scheduler


class SchedulerTest(unittest.TestCase):
    def test_due_slot_only_and_holiday(self):
        zone = ZoneInfo('Asia/Ho_Chi_Minh')
        with patch.object(scheduler, 'connect') as connect, patch.object(scheduler, 'create_scan') as create:
            connect.return_value.__enter__.return_value.execute.return_value.fetchone.return_value = None
            create.return_value = {'run_id': 'scheduled-test'}
            with patch.dict(os.environ, {'QUANTIK_PRE_OPEN_TIME': '07:00',
                                         'QUANTIK_POST_CLOSE_TIME': '16:20',
                                         'QUANTIK_HOLIDAYS': ''}):
                scheduler.tick(datetime(2026, 9, 22, 13, 30, tzinfo=zone))
                create.assert_not_called()
                scheduler.tick(datetime(2026, 9, 22, 7, 1, tzinfo=zone))
                create.assert_called_once_with('PRE_OPEN', '2026-09-22')
            create.reset_mock()
            with patch.dict(os.environ, {'QUANTIK_HOLIDAYS': '2026-09-22'}):
                scheduler.tick(datetime(2026, 9, 22, 16, 21, tzinfo=zone))
                create.assert_not_called()

    def test_database_override_can_open_a_weekend(self):
        zone = ZoneInfo('Asia/Ho_Chi_Minh')
        with patch.object(scheduler, 'connect') as connect, patch.object(scheduler, 'create_scan') as create:
            connect.return_value.__enter__.return_value.execute.return_value.fetchone.side_effect = [
                {'is_trading_day': 1}, None,
            ]
            create.return_value = {'run_id': 'weekend-override'}
            with patch.dict(os.environ, {'QUANTIK_PRE_OPEN_TIME': '07:00', 'QUANTIK_HOLIDAYS': ''}):
                scheduler.tick(datetime(2026, 9, 20, 7, 1, tzinfo=zone))
            create.assert_called_once_with('PRE_OPEN', '2026-09-20')


if __name__ == '__main__':
    unittest.main()
