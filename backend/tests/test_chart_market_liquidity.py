"""Ticker/venue resolution and liquidity rejection contracts across API and worker."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd
from fastapi.testclient import TestClient
import engine
import market
import server
import store
import worker
from quant_engine.quant import QuantPipeline
from quant_service import present_screened_report


def prices():
    end = pd.Timestamp.now(tz='Asia/Ho_Chi_Minh').tz_localize(None).normalize() - pd.offsets.BDay(1)
    dates = pd.bdate_range(end=end, periods=150)
    close = pd.Series([30000 + i*10 for i in range(150)], index=dates)
    return pd.DataFrame({'open': close, 'high': close+100, 'low': close-100,
                         'close': close, 'volume': 1000}, index=dates)


class ChartMarketLiquidityTest(unittest.TestCase):
    def test_all_venues_resolve_without_a_scan_and_catalog_is_cached(self):
        with patch.object(market, '_exchanges', {}), patch.object(market, '_exchanges_at', 0), \
             patch.object(market, 'DataProvider') as provider:
            provider.return_value.get_stock_list.side_effect = lambda venue: {'HOSE':['FPT'], 'HNX':['SHS'], 'UPCOM':['A32','ABW']}[venue]
            self.assertEqual(market.instrument('A32')['tv_symbol'], 'UPCOM:A32')
            self.assertEqual(market.instrument('ABW')['exchange'], 'UPCOM')
            self.assertEqual(market.instrument('SHS')['tv_symbol'], 'HNX:SHS')
            self.assertIsNone(market.instrument('BAD'))
            self.assertEqual(provider.return_value.get_stock_list.call_count, 3)

    def test_numeric_ticker_is_accepted_and_worker_saves_a_liquidity_result(self):
        frame = prices()
        raw = QuantPipeline().analyze('A32', frame, exchange='UPCOM')
        self.assertEqual(raw['error'], 'Liquidity gate failed')
        self.assertFalse(raw['liquidity']['pass'])
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(store, 'DB_PATH', Path(directory)/'test.sqlite'), \
             patch.object(worker, 'ARTIFACT_ROOT', Path(directory)/'artifacts'):
            with TestClient(server.app) as client:
                client.post('/api/v1/session')
                created = client.post('/api/v1/quant/jobs', json={'symbol':'a32'})
                self.assertEqual(created.status_code, 202)
                job_id = created.json()['job_id']
                presentation = present_screened_report(raw, frame)
                with patch.object(worker, 'quant_from_crawl', return_value=(presentation, {'generated':[], 'skipped':{}}, engine.bars_from_frame(frame))), \
                     patch.object(worker, 'recommendation_backtest', side_effect=AssertionError('blocked ticker has no trade plan')):
                    self.assertTrue(worker.process_one())
                saved = client.get(f'/api/v1/quant/jobs/{job_id}').json()
                self.assertEqual(saved['status'], 'succeeded');self.assertIsNone(saved['error'])
                report = client.get(f'/api/v1/quant/reports/{job_id}').json()
                self.assertEqual(report['analysis_status'], 'screened_out')
                self.assertEqual(report['analysis_outcome']['code'], 'LIQUIDITY_FAIL')
                self.assertIsNone(report['score']);self.assertEqual(report['action'], 'AVOID')
                self.assertFalse(report['liquidity']['pass']);self.assertIsNone(report['levels']['entry'])
                self.assertEqual(report['backtest']['status'], 'skipped')
                self.assertEqual(client.post('/api/v1/quant/jobs', json={'symbol':'A!2'}).status_code, 400)

    def test_gate_is_preserved_and_other_model_failures_still_raise(self):
        frame = prices();raw = QuantPipeline().analyze('ABW', frame, exchange='UPCOM')
        with patch.object(QuantPipeline, 'batch', return_value=[raw]), \
             patch.object(QuantPipeline, 'generate_commentary', side_effect=AssertionError('do not fabricate a completed model report')):
            report, visuals, bars = engine._quant_with_frames('ABW', frame, frame, 'UPCOM', lambda *args:None, Path('/tmp'))
        self.assertEqual(report['analysis_status'], 'screened_out')
        self.assertEqual(report['liquidity'], raw['liquidity']);self.assertEqual(len(bars),150)
        self.assertEqual(visuals['generated'],[]);self.assertFalse(report['research']['cone'])
        with patch.object(QuantPipeline, 'batch', return_value=[{'symbol':'ABW','error':'Data quality failed: NONFINITE_OHLCV'}]):
            with self.assertRaisesRegex(RuntimeError, 'Data quality failed'):
                engine._quant_with_frames('ABW', frame, frame, 'UPCOM', lambda *args:None, Path('/tmp'))
        with self.assertRaises(ValueError):present_screened_report({'symbol':'ABW','liquidity':{'pass':True}},frame)

    def test_instrument_api_is_public_but_rejects_unknown_symbols(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(store,'DB_PATH',Path(directory)/'test.sqlite'):
            with TestClient(server.app) as client, patch.object(server,'market_instrument') as lookup:
                lookup.return_value={'symbol':'A32','exchange':'UPCOM','tv_symbol':'UPCOM:A32'}
                self.assertEqual(client.get('/api/v1/market/symbols/A32').json()['tv_symbol'],'UPCOM:A32')
                lookup.return_value=None
                self.assertEqual(client.get('/api/v1/market/symbols/BAD').status_code,404)
                self.assertEqual(client.get('/api/v1/market/symbols/A!2').status_code,400)

    def test_board_refresh_uses_shared_cache_then_reads_new_quotes(self):
        with patch.object(market,'_pages',{}), patch.object(market,'_symbols',return_value=['FPT']), \
             patch.object(market,'_index_bars',return_value=[]), patch.object(market,'DataProvider') as provider, \
             patch.object(market.time,'monotonic') as clock:
            clock.return_value=100
            provider.return_value.get_price_board.return_value=pd.DataFrame([{'symbol':'FPT','close_price':100000,'reference_price':99000}])
            self.assertEqual(market.overview(1,5)['items'][0]['price'],100000)
            clock.return_value=100+market.QUOTE_CACHE_SECONDS-1
            market.overview(1,5);self.assertEqual(provider.return_value.get_price_board.call_count,1)
            clock.return_value=100+market.QUOTE_CACHE_SECONDS+1
            provider.return_value.get_price_board.return_value=pd.DataFrame([{'symbol':'FPT','close_price':101000,'reference_price':99000}])
            self.assertEqual(market.overview(1,5)['items'][0]['price'],101000)
            self.assertEqual(provider.return_value.get_price_board.call_count,2)


if __name__ == '__main__':unittest.main()
