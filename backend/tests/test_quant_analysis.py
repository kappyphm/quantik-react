import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

import engine
import server
import store
import worker
from quant_service import present_report
from quant_explanations import module_reports
from quant_engine.quant import ScreenerBridge, StructureEngine
from quant_engine.quant import QuantPipeline
from quant_engine.quant_visuals import generate_quant_visuals
from quant_engine.crawl_data import DataProvider


def frame():
    return pd.DataFrame({'time': pd.bdate_range('2026-01-01', periods=150),
                         'open': 100, 'high': 110, 'low': 90, 'close': 98, 'volume': 1000})


class SingleQuantAnalysisTest(unittest.TestCase):
    def test_new_job_needs_no_published_scan_and_worker_crawls(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(store, 'DB_PATH', Path(directory)/'test.sqlite'), patch.object(worker, 'ARTIFACT_ROOT', Path(directory)/'artifacts'):
            store.init_db()
            with TestClient(server.app) as client:
                client.post('/api/v1/session')
                response = client.post('/api/v1/quant/jobs', json={'symbol': 'NEW'})
                self.assertEqual(response.status_code, 202)
                job_id = response.json()['job_id']
                fake = {'symbol': 'NEW', 'data_source_mode': 'crawl_data_live', 'as_of': '2026-07-29'}
                with patch.object(worker, 'quant_from_crawl', return_value=(fake, {'generated': [], 'skipped': {}}, [])) as crawl, patch.object(worker, 'quant_from_snapshot', side_effect=AssertionError('new jobs cannot use old snapshot')):
                    self.assertTrue(worker.process_one())
                    self.assertEqual(crawl.call_args.args[0], 'NEW')
                report = client.get(f'/api/v1/quant/reports/{job_id}').json()
                self.assertEqual(report['data_source_mode'], 'crawl_data_live')
                self.assertIsNone(report['reference_run_id'])
                self.assertEqual(client.post('/api/v1/quant/jobs', json={'symbol': 'A!'}).status_code, 400)

    def test_fetch_failure_fails_job_without_snapshot_substitution(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(store, 'DB_PATH', Path(directory)/'test.sqlite'), patch.object(worker, 'ARTIFACT_ROOT', Path(directory)/'artifacts'):
            store.init_db()
            job = store.new_job('quant', None, 'FPT', {'data_source_mode': 'crawl_data_live', 'include_backtest': False})
            with patch.object(worker, 'quant_from_crawl', side_effect=RuntimeError('Không lấy được dữ liệu')), patch.object(worker, 'quant_from_snapshot', side_effect=AssertionError('no fallback')):
                worker.process_one()
            with store.connect() as db:
                saved = db.execute('SELECT status,report_json,error FROM jobs WHERE id=?', (job['id'],)).fetchone()
            self.assertEqual(saved['status'], 'failed')
            self.assertIsNone(saved['report_json'])
            self.assertIn('Không lấy được dữ liệu', saved['error'])

    def test_crawl_then_quant_then_visual_uses_the_same_normalized_bars(self):
        raw = frame()
        provider = Mock()
        provider.get_ohlcv.return_value = raw
        provider.get_index_data.return_value = raw
        provider.get_stock_list.side_effect = lambda exchange: ['FPT'] if exchange == 'HOSE' else []
        events = []
        provider.get_ohlcv.side_effect = lambda *a, **k: events.append('crawl') or raw
        def quantify(symbol, prices, index, exchange, progress, output_dir, include_backtest, source_mode):
            events.append('quant')
            self.assertEqual(exchange, 'HOSE')
            self.assertEqual(source_mode, 'crawl_data_live')
            self.assertEqual(prices.attrs['price_unit'], 'VND')
            self.assertEqual(prices.close.iloc[-1], 98000)
            presentation = present_report({'symbol': symbol, 'flow': StructureEngine.flow(prices)}, prices)
            events.append('visual')
            return presentation, {'generated': [], 'skipped': {}}, engine.bars_from_frame(prices)
        with patch.object(DataProvider, '__new__', return_value=provider), patch.object(engine, '_quant_with_frames', side_effect=quantify), patch.object(ScreenerBridge, 'fetch_ohlcv', side_effect=AssertionError('fetch must come from crawl_data')):
            result, _, bars = engine.quant_from_crawl('FPT', lambda *args: None, Path('/tmp'), False)
        self.assertEqual(events, ['crawl', 'quant', 'visual'])
        self.assertEqual(result['data_lineage']['observations'], len(bars))
        self.assertEqual(result['data_lineage']['end'], bars[-1]['time'])
        self.assertIn('crawl_data.py', result['data_lineage']['collector'])

    def test_cmf_negative_positive_and_zero_explanations_follow_actual_ohlcv(self):
        for close, sign in [(98, -1), (102, 1), (100, 0)]:
            prices = frame().set_index('time'); prices['close'] = close
            flow = StructureEngine.flow(prices)
            module = next(m for m in module_reports({'flow': flow}, prices) if m['id'] == 'flow')
            self.assertAlmostEqual(flow['cmf'], sign*.2)
            actual = next(p['value'] for p in module['evidence'] if p['label'] == 'CMF tính lại từ OHLCV')
            self.assertAlmostEqual(actual, flow['cmf'])
            self.assertIn('nửa dưới' if sign < 0 else 'nửa trên' if sign > 0 else 'cân bằng', module['explanation'])
            self.assertIn('không đo tiền rút/nạp', module['limitations'])

    def test_model_report_and_image_visuals_share_the_exact_core_result(self):
        prices = frame().set_index('time')
        report = {'symbol': 'FPT', 'flow': StructureEngine.flow(prices), 'stats': {'sharpe': 1.2}}
        phases = []
        with patch.object(QuantPipeline, 'batch', return_value=[report]) as batch, patch.object(QuantPipeline, 'generate_commentary', return_value='Nhận định core'), patch('quant_engine.quant_visuals.generate_quant_visuals', return_value={'generated': [], 'skipped': {}}) as visual, patch.dict('os.environ', {'QUANTIK_GENERATE_IMAGES': 'true'}):
            presentation, _, bars = engine._quant_with_frames('FPT', prices, prices, 'HOSE', lambda phase, *args: phases.append(phase), Path('/tmp'))
        self.assertIs(batch.call_args.args[0]['FPT'], prices)
        self.assertIs(visual.call_args.kwargs['report'], report)
        self.assertIs(visual.call_args.kwargs['price_data'], prices)
        flow = next(m for m in presentation['module_reports'] if m['id'] == 'flow')
        self.assertEqual(flow['result']['cmf'], report['flow']['cmf'])
        self.assertEqual(bars[-1]['close'], prices.close.iloc[-1])
        self.assertEqual(phases[0], 'models'); self.assertIn('visual', phases)

    def test_private_paths_do_not_leak_and_unavailable_models_stay_unavailable(self):
        prices = frame().set_index('time')
        report = {'symbol': 'FPT', 'lightgbm_cross_sectional': {'available': False, 'reason': 'insufficient_symbol_universe'},
                  'hmm': {'method': 'fallback', 'current': 'SIDEWAY'}, 'meta_label_model': {'status': 'WARMUP'},
                  'fcast': {'_mc_paths': np.ones((5, 3))*98, '_private': 'hidden', 'horizon': 2}}
        result = present_report(report, prices)
        models = {m['id']: m for m in result['module_reports']}
        self.assertEqual(models['lightgbm_cross_sectional']['status'], 'unavailable')
        self.assertEqual(models['hmm']['status'], 'fallback')
        self.assertEqual(models['meta_label_model']['status'], 'warmup')
        self.assertNotIn('_mc_paths', json.dumps(result))
        self.assertNotIn('_private', json.dumps(result))
        self.assertTrue(result['research']['cone'])


if __name__ == '__main__': unittest.main()
