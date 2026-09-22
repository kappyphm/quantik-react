"""Small API/queue contract test against an isolated SQLite database."""
import json
import os
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

TEST_DIR = tempfile.TemporaryDirectory()
os.environ['QUANTIK_DB_PATH'] = str(Path(TEST_DIR.name) / 'test.sqlite')
os.environ['QUANTIK_ALLOW_DEMO'] = 'true'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from server import app
from store import connect, create_scan, dumps, init_db, new_job, now, update_job
from worker import process_one, run_scan
from backtest_service import recommendation_backtest


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
            os.environ['QUANTIK_ALLOW_DEMO'] = 'false'
            self.assertEqual(client.get('/api/v1/quant/jobs').json()['total'], 0)
            self.assertEqual(client.get('/api/v1/quant/reports').json()['total'], 0)
            os.environ['QUANTIK_ALLOW_DEMO'] = 'true'

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

    def test_admin_rerun_and_retry_are_audited(self):
        os.environ['QUANTIK_ADMIN_KEY'] = 'test-admin-only'
        headers = {'X-Admin-Key': 'test-admin-only', 'X-Admin-Actor': 'operator-test'}
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/v1/admin/session').status_code, 403)
            self.assertEqual(client.get('/api/v1/admin/session', headers=headers).status_code, 200)
            body = {'slot': 'MANUAL', 'trading_date': '2026-09-20'}
            created = client.post('/api/v1/admin/scan-runs', json=body, headers=headers)
            self.assertEqual(created.status_code, 202)
            run_id = created.json()['run_id']
            self.assertEqual(client.post('/api/v1/admin/scan-runs', json=body, headers=headers).status_code, 409)
            with connect(write=True) as db:
                db.execute("UPDATE scan_runs SET status='failed' WHERE id=?", (run_id,))
            rerun = client.post('/api/v1/admin/scan-runs', json={**body, 'rerun_of': run_id}, headers=headers)
            self.assertEqual(rerun.status_code, 202)
            self.assertEqual(rerun.json()['rerun_of'], run_id)
            self.assertEqual(rerun.json()['attempt'], 2)
            client.post('/api/v1/session')
            owner = client.cookies.get('quantik_sid')
            failed = new_job('quant', owner, 'FPT', {'include_backtest': False})
            update_job(failed['id'], 'failed', 10, 'Lỗi kiểm thử', status='failed', error='test')
            retried = client.post(f"/api/v1/admin/jobs/{failed['id']}/retry", headers=headers)
            self.assertEqual(retried.status_code, 202)
            self.assertEqual(client.post(f"/api/v1/admin/jobs/{failed['id']}/retry", headers=headers).json()['job_id'],
                             retried.json()['job_id'])
            with connect() as db:
                row = db.execute('SELECT owner,params_json FROM jobs WHERE id=?', (retried.json()['job_id'],)).fetchone()
            self.assertEqual(row['owner'], owner)
            self.assertEqual(json.loads(row['params_json'])['retry_of'], failed['id'])
            self.assertEqual(client.post(f"/api/v1/admin/jobs/{failed['id']}/retry", headers={'X-Admin-Key': 'wrong'}).status_code, 403)
            audit = client.get('/api/v1/admin/audit', headers=headers).json()['items']
            self.assertTrue(any(item['action'] == 'scan.create' and item['target_id'] == run_id for item in audit))
            self.assertTrue(any(item['action'] == 'job.retry' and item['target_id'] == retried.json()['job_id'] for item in audit))
            with connect(write=True) as db:
                db.execute("UPDATE jobs SET status='cancelled' WHERE status='queued'")

    def test_failed_scan_keeps_symbol_diagnostics_without_publication(self):
        created = create_scan('MANUAL', '2026-09-19')
        with connect() as db:
            job = dict(db.execute('SELECT * FROM jobs WHERE id=?', (created['job_id'],)).fetchone())
        summary = {'symbol': 'FPT', 'analysis_status': 'completed'}
        failed = {'symbol': 'ABC', 'analysis_status': 'failed', 'gate_explanation': 'NO_OHLCV'}
        result = {'results': [(summary, summary, []), (failed, failed, [])],
                  'universe_count': 2, 'analyzed_count': 1, 'failed_count': 1,
                  'index_bars': [{'time': '2026-09-18'}], 'data_as_of': '2026-09-18'}
        with patch('worker.scan_all', return_value=result):
            with self.assertRaisesRegex(RuntimeError, 'Độ phủ'):
                run_scan(job)
        with connect() as db:
            run = db.execute('SELECT status,analyzed_count,failed_count,model_version,source_version,config_json FROM scan_runs WHERE id=?',
                             (created['run_id'],)).fetchone()
            count = db.execute('SELECT COUNT(*) FROM scan_results WHERE run_id=?', (created['run_id'],)).fetchone()[0]
            latest = db.execute("SELECT run_id FROM publication WHERE key='latest'").fetchone()[0]
        self.assertEqual((run['status'], run['analyzed_count'], run['failed_count'], count), ('failed', 1, 1, 2))
        self.assertEqual(run['model_version'], 'quant-engine-v7-copy')
        self.assertTrue(run['source_version'].startswith('vnstock-'))
        self.assertEqual(json.loads(run['config_json'])['min_coverage'], 0.8)
        self.assertNotEqual(latest, created['run_id'])
        with connect(write=True) as db:
            db.execute("UPDATE jobs SET status='cancelled' WHERE id=?", (created['job_id'],))

    def test_recommendation_backtest_uses_only_mature_published_signals(self):
        start = date(2026, 1, 1)
        bars = [{'time': (start + timedelta(days=index)).isoformat(), 'close': 100 + index}
                for index in range(45)]
        with connect(write=True) as db:
            for index in range(5):
                signal_day = bars[index]['time']
                run_id = f'REAL-BT-{index}'
                db.execute("""INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,
                              published_at,data_as_of) VALUES (?,?,?,?,'published',?,?,?)""",
                           (run_id, signal_day, 'MANUAL', 1, now(), now(), signal_day))
                db.execute("INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json) VALUES (?,?,?,?,?)",
                           (run_id, 'FPT', dumps({'symbol': 'FPT', 'recommendation': 'MUA'}),
                            dumps({'symbol': 'FPT'}), dumps(bars[:index + 1])))
        result = recommendation_backtest('FPT', bars)
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['sample_size'], 5)
        self.assertGreater(result['win_rate_pct'], 0)

    def test_quant_job_active_quota_and_idempotency(self):
        with patch.dict(os.environ, {'QUANTIK_MAX_ACTIVE_JOBS_PER_OWNER': '1',
                                     'QUANTIK_MAX_JOBS_PER_24H': '2'}):
            with TestClient(app) as client:
                client.post('/api/v1/session')
                first = client.post('/api/v1/quant/jobs', json={'symbol': 'FPT'},
                                    headers={'Idempotency-Key': 'quota-same'})
                self.assertEqual(first.status_code, 202)
                repeat = client.post('/api/v1/quant/jobs', json={'symbol': 'FPT'},
                                     headers={'Idempotency-Key': 'quota-same'})
                self.assertEqual(repeat.json()['job_id'], first.json()['job_id'])
                blocked = client.post('/api/v1/quant/jobs', json={'symbol': 'FPT'})
                self.assertEqual(blocked.status_code, 429)
                client.delete(f"/api/v1/quant/jobs/{first.json()['job_id']}")


if __name__ == '__main__':
    unittest.main()
