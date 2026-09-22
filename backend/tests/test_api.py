"""Small API/queue contract test against an isolated SQLite database."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

TEST_DIR = tempfile.TemporaryDirectory()
os.environ['QUANTIK_DB_PATH'] = str(Path(TEST_DIR.name) / 'test.sqlite')
os.environ['QUANTIK_ALLOW_DEMO'] = 'true'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from server import app
from store import connect, dumps, init_db, now
from worker import process_one


class ApiQueueTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        bars = [
            {'time': '2026-09-18', 'open': 100, 'high': 103, 'low': 99, 'close': 102, 'volume': 1000},
            {'time': '2026-09-21', 'open': 102, 'high': 105, 'low': 101, 'close': 104, 'volume': 1200},
        ]
        summary = {'symbol': 'FPT', 'name': 'FPT', 'exchange': 'HOSE', 'recommendation': 'MUA',
                   'gate_pass': True, 'gate_explanation': 'Đạt', 'score': 89, 'rating': 'Tích cực',
                   'hold_plan': '2–6 tháng', 'vni_trend': 'Tăng', 'sector': 'Công nghệ',
                   'sector_trend': 'Tăng'}
        with connect(write=True) as db:
            db.execute("INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,published_at,data_as_of,universe_count,analyzed_count,index_json) VALUES ('DEMO-TEST','2026-09-21','POST_CLOSE',1,'published',?,?,?,?,?,?)",
                       (now(), now(), '2026-09-21', 1, 1, dumps(bars)))
            db.execute("INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json) VALUES (?,?,?,?,?)",
                       ('DEMO-TEST', 'FPT', dumps(summary), dumps(summary), dumps(bars)))
            db.execute("INSERT INTO publication(key,run_id) VALUES ('latest','DEMO-TEST')")

    def test_scan_job_and_report_reopen(self):
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/v1/scans/latest/results?page=1&page_size=5').json()['total'], 1)
            self.assertEqual(client.get('/api/v1/scans/latest/facets').json()['sector'], ['Công nghệ'])
            self.assertEqual(client.post('/api/v1/quant/jobs', json={'symbol': 'FPT'}).status_code, 401)
            self.assertEqual(client.post('/api/v1/session').status_code, 200)
            created = client.post('/api/v1/quant/jobs', json={'symbol': 'FPT'}, headers={'Idempotency-Key': 'same'}).json()
            repeated = client.post('/api/v1/quant/jobs', json={'symbol': 'FPT'}, headers={'Idempotency-Key': 'same'}).json()
            self.assertEqual(created['job_id'], repeated['job_id'])
            other = TestClient(app)
            other.post('/api/v1/session')
            self.assertEqual(other.get(f"/api/v1/quant/jobs/{created['job_id']}").status_code, 404)
            with connect(write=True) as db:
                db.execute("INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,published_at,data_as_of) VALUES ('NEW-TEST','2026-09-22','PRE_OPEN',1,'published',?,?,?)",
                           (now(), now(), '2026-09-22'))
                db.execute("UPDATE publication SET run_id='NEW-TEST' WHERE key='latest'")
            self.assertTrue(process_one())
            job = client.get(f"/api/v1/quant/jobs/{created['job_id']}").json()
            self.assertEqual(job['status'], 'succeeded')
            report = client.get(f"/api/v1/quant/reports/{created['job_id']}").json()
            self.assertEqual(report['analysis_mode'], 'synthetic_demo')
            self.assertEqual(report['reference_run_id'], 'DEMO-TEST')
            self.assertEqual(client.get('/api/v1/quant/jobs').json()['total'], 1)
            self.assertEqual(client.get('/api/v1/quant/reports').json()['total'], 1)
            self.assertEqual(client.get('/api/v1/admin/scan-runs/DEMO-TEST/results').status_code, 403)
            os.environ['QUANTIK_ADMIN_KEY'] = 'test-admin-only'
            headers = {'X-Admin-Key': 'test-admin-only'}
            self.assertEqual(client.get('/api/v1/admin/scan-runs/DEMO-TEST/results', headers=headers).json()['total'], 1)
            self.assertEqual(client.get('/api/v1/admin/scan-runs/DEMO-TEST/results/FPT', headers=headers).json()['symbol'], 'FPT')
            self.assertEqual(client.get(f"/api/v1/admin/quant/reports/{created['job_id']}", headers=headers).json()['analysis_mode'], 'synthetic_demo')
            with client.stream('GET', f"/api/v1/quant/jobs/{created['job_id']}/events") as response:
                response.read()
                self.assertIn('event: job.succeeded', response.text)

    def test_demo_publication_requires_explicit_opt_in(self):
        previous = os.environ.get('QUANTIK_ALLOW_DEMO')
        os.environ['QUANTIK_ALLOW_DEMO'] = 'false'
        try:
            with TestClient(app) as client:
                self.assertEqual(client.get('/api/v1/scans/latest').status_code, 404)
                self.assertEqual(client.get('/api/v1/scans/status').status_code, 200)
        finally:
            if previous is None:
                os.environ.pop('QUANTIK_ALLOW_DEMO', None)
            else:
                os.environ['QUANTIK_ALLOW_DEMO'] = previous


if __name__ == '__main__':
    unittest.main()
