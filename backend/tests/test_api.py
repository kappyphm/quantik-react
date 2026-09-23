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
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
import server
import worker
from server import app
from store import connect, create_scan, dumps, init_db, new_job, now, update_job
from worker import process_one, run_scan
from backtest_service import recommendation_backtest


class ApiQueueTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        bars = [{'time': (date(2026, 8, 1) + timedelta(days=index)).isoformat(),
                 'open': 100 + index, 'high': 103 + index, 'low': 99 + index,
                 'close': 102 + index, 'volume': 1000 + index} for index in range(35)]
        summary = {'symbol': 'FPT', 'name': 'FPT', 'exchange': 'HOSE', 'recommendation': 'THEO DÕI',
                   'gate_pass': True, 'gate_explanation': 'Đạt', 'score': 89, 'rating': 'Tích cực',
                   'hold_plan': '2–6 tháng', 'vni_trend': 'Tăng', 'sector': 'Công nghệ',
                   'sector_trend': 'Tăng', 'analysis_status': 'completed'}
        with connect(write=True) as db:
            db.execute("INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,published_at,data_as_of,universe_count,analyzed_count,index_json) VALUES ('FIXTURE-TEST','2026-09-21','POST_CLOSE',1,'published',?,?,?,?,?,?)",
                       (now(), now(), bars[-1]['time'], 1, 1, dumps(bars)))
            db.execute("INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json) VALUES (?,?,?,?,?)",
                       ('FIXTURE-TEST', 'FPT', dumps(summary), dumps(summary), dumps(bars)))
            db.execute("INSERT INTO publication(key,run_id) VALUES ('latest','FIXTURE-TEST')")

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
            fake_report = {'symbol': 'FPT', 'as_of': '2026-09-04',
                           'data_source_mode': 'published_scan_snapshot'}
            with patch.object(worker, 'quant_from_snapshot',
                              return_value=(fake_report, {'generated': [], 'skipped': {}}, [])):
                self.assertTrue(process_one())
            job = client.get(f"/api/v1/quant/jobs/{created['job_id']}").json()
            self.assertEqual(job['status'], 'succeeded')
            job_date = job['requested_at'][:10]
            report = client.get(f"/api/v1/quant/reports/{created['job_id']}").json()
            self.assertEqual(report['analysis_mode'], 'quant_core')
            self.assertEqual(report['reference_run_id'], 'FIXTURE-TEST')
            self.assertEqual(client.get('/api/v1/quant/jobs').json()['total'], 1)
            self.assertEqual(client.get('/api/v1/quant/jobs?symbol=FPT&status=succeeded').json()['total'], 1)
            self.assertEqual(client.get('/api/v1/quant/jobs?symbol=VCB').json()['total'], 0)
            self.assertEqual(client.get(f'/api/v1/quant/jobs?date_from={job_date}&date_to={job_date}').json()['total'], 1)
            self.assertEqual(client.get('/api/v1/quant/jobs?status=unknown').status_code, 422)
            self.assertEqual(client.get('/api/v1/quant/jobs?date_from=2026-09-31').status_code, 422)
            self.assertEqual(client.get('/api/v1/quant/jobs?date_from=2026-09-23&date_to=2026-09-22').status_code, 422)
            self.assertEqual(client.get('/api/v1/quant/reports').json()['total'], 1)
            self.assertEqual(client.get('/api/v1/admin/scan-runs/FIXTURE-TEST/results').status_code, 403)
            os.environ['QUANTIK_ADMIN_KEY'] = 'test-admin-only'
            headers = {'X-Admin-Key': 'test-admin-only'}
            self.assertEqual(client.get('/api/v1/admin/scan-runs/FIXTURE-TEST/results', headers=headers).json()['total'], 1)
            self.assertEqual(client.get('/api/v1/admin/scan-runs/FIXTURE-TEST/results/FPT', headers=headers).json()['symbol'], 'FPT')
            self.assertEqual(client.get(f"/api/v1/admin/quant/reports/{created['job_id']}", headers=headers).json()['analysis_mode'], 'quant_core')
            with client.stream('GET', f"/api/v1/quant/jobs/{created['job_id']}/events") as response:
                response.read()
                self.assertIn('event: job.succeeded', response.text)
            self.assertEqual(client.get('/api/v1/quant/jobs').json()['total'], 1)
            self.assertEqual(client.get('/api/v1/quant/reports').json()['total'], 1)

    def test_demo_publication_is_never_public(self):
        try:
            with connect(write=True) as db:
                db.execute("INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,published_at) VALUES ('DEMO-TEST','2026-09-21','MANUAL',1,'published',?,?)", (now(), now()))
                db.execute("UPDATE publication SET run_id='DEMO-TEST' WHERE key='latest'")
            with TestClient(app) as client:
                self.assertEqual(client.get('/api/v1/scans/latest').status_code, 404)
                self.assertEqual(client.get('/api/v1/scans/status').status_code, 200)
        finally:
            with connect(write=True) as db:
                db.execute("UPDATE publication SET run_id='FIXTURE-TEST' WHERE key='latest'")

    def test_request_id_and_public_source_error_are_safe(self):
        with TestClient(app) as client:
            response = client.get('/health/live', headers={'X-Request-ID': 'test-request-123'})
            self.assertEqual(response.headers['X-Request-ID'], 'test-request-123')
            with patch.object(server, 'live_market_overview', side_effect=RuntimeError('C:/secret/provider.txt')):
                failed = client.get('/api/v1/market/overview')
            self.assertEqual(failed.status_code, 503)
            self.assertNotIn('secret', failed.text)

    def test_result_sort_keeps_missing_values_last(self):
        missing = {'symbol': 'ABC', 'name': 'ABC', 'exchange': 'UPCOM',
                   'score': None, 'analysis_status': 'insufficient_data'}
        with connect(write=True) as db:
            db.execute("INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json) VALUES (?,?,?,?,?)",
                       ('FIXTURE-TEST', 'ABC', dumps(missing), dumps(missing), '[]'))
        try:
            for order in ('asc', 'desc'):
                result = server.query_results('FIXTURE-TEST', '', None, None, None, None,
                                              None, None, 'score', order, 1, 10)
                self.assertEqual([item['symbol'] for item in result['items']], ['FPT', 'ABC'])
        finally:
            with connect(write=True) as db:
                db.execute("DELETE FROM scan_results WHERE run_id='FIXTURE-TEST' AND symbol='ABC'")

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
            calendar = client.put('/api/v1/admin/calendar/2026-09-23',
                                  json={'is_trading_day': False, 'reason': 'Ngày nghỉ kiểm thử'}, headers=headers)
            self.assertEqual(calendar.status_code, 200)
            self.assertEqual(client.put('/api/v1/admin/calendar/2026-09-24',
                                        json={'is_trading_day': False, 'reason': '  '}, headers=headers).status_code, 422)
            self.assertFalse(client.get('/api/v1/admin/calendar', headers=headers).json()['items'][0]['is_trading_day'])
            self.assertEqual(client.delete('/api/v1/admin/calendar/2026-09-23', headers=headers).status_code, 200)
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

    def test_quant_job_reads_the_published_snapshot(self):
        bars = [{'time': (date(2026, 3, 1) + timedelta(days=index)).isoformat(),
                 'open': 100 + index, 'high': 102 + index, 'low': 99 + index,
                 'close': 101 + index, 'volume': 1000 + index} for index in range(35)]
        summary = {'symbol': 'FPT', 'exchange': 'HOSE', 'recommendation': 'THEO DÕI',
                   'analysis_status': 'completed'}
        with connect(write=True) as db:
            db.execute("""INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,published_at,
                          data_as_of,index_json) VALUES ('REAL-SNAPSHOT','2026-04-04','MANUAL',1,'published',?,?,?,?)""",
                       (now(), now(), bars[-1]['time'], dumps(bars)))
            db.execute("INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json) VALUES (?,?,?,?,?)",
                       ('REAL-SNAPSHOT', 'FPT', dumps(summary), dumps(summary), dumps(bars)))
            db.execute("UPDATE publication SET run_id='REAL-SNAPSHOT' WHERE key='latest'")
        try:
            with TestClient(app) as client:
                client.post('/api/v1/session')
                created = client.post('/api/v1/quant/jobs', json={'symbol': 'FPT'}).json()
                fake_report = {'symbol': 'FPT', 'as_of': bars[-1]['time'],
                               'data_source_mode': 'published_scan_snapshot'}
                with patch.object(worker, 'quant_from_snapshot', return_value=(fake_report, {'generated': [], 'skipped': {}}, bars)) as run:
                    self.assertTrue(process_one())
                self.assertEqual(run.call_args.args[1], bars)
                report = client.get(f"/api/v1/quant/reports/{created['job_id']}").json()
                self.assertEqual(report['data_source_mode'], 'published_scan_snapshot')
                self.assertEqual(report['reference_run_id'], 'REAL-SNAPSHOT')
        finally:
            with connect(write=True) as db:
                db.execute("UPDATE publication SET run_id='FIXTURE-TEST' WHERE key='latest'")


if __name__ == '__main__':
    unittest.main()
