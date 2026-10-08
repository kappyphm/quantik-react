import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
import server
import store
from store import connect, dumps, init_db, now
from scan_presentation import fields_from_summary, enrich_saved_summary
from quant_service import present_report


class ProductPresentationTest(unittest.TestCase):
    def test_highlights_read_one_publication_no_model_run(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(store, 'DB_PATH',Path(directory)/'test.sqlite'):
            init_db()
            with connect(write=True) as db:
                db.execute("INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,published_at,data_as_of,universe_count,analyzed_count) VALUES ('PRODUCT-TEST','2026-10-08','POST_CLOSE',1,'published',?,?,?,?,?)", (now(),now(),'2026-10-08',21,20))
                db.execute("INSERT INTO publication(key,run_id) VALUES ('latest','PRODUCT-TEST')")
                for i in range(21):
                    symbol=f'A{chr(65+i)}A'
                    summary={'symbol':symbol,'score':i,'gate_pass':False,'analysis_status':'completed','action':'AVOID' if i==20 else 'WATCH'}
                    detail={'quant':{'stats':{'sharpe':0,'win_rate_pct':60},'sl':{'entry':16700,'sl_swing':16000},'costs':{'net_forecast_pct':0},'data_quality':{'status':'FAIL' if i==19 else 'PASS'}}}
                    db.execute('INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json) VALUES (?,?,?,?,?)',('PRODUCT-TEST',symbol,dumps(summary),dumps(detail),'[]'))
            with TestClient(server.app) as client, patch.object(server,'new_job',side_effect=AssertionError('GET must not create jobs')):
                response=client.get('/api/v1/scans/latest/highlights')
            self.assertEqual(response.status_code,200)
            data=response.json();self.assertEqual(data['id'],'PRODUCT-TEST');self.assertEqual(len(data['items']),10)
            self.assertEqual(data['eligibleCount'],20);self.assertEqual(data['excludedCount'],1)
            self.assertIn('AUA',data['highlights']['cautions']);self.assertNotIn('AUA',data['highlights']['opportunities'])
            self.assertEqual(len(set(data['highlights']['opportunities']+data['highlights']['cautions'])),10)
            self.assertEqual(data['items'][0]['entry_vnd'],16700);self.assertEqual(data['items'][0]['net_forecast_pct'],0)
            self.assertEqual(response.headers['cache-control'],'no-store')

    def test_saved_legacy_metrics_and_new_summary_preserve_units_and_gate(self):
        values=fields_from_summary({'Action':'AVOID','GatePass':False,'Entry':16700,'TP':20000,'Sharpe':0,'WinRate':60,'NetFc%':0,'SL':0}, {'liquidity':{'adv20_value_vnd':1200000001},'fcast':{'horizon':10}})
        self.assertEqual(values['entry_vnd'],16700);self.assertIsNone(values['stop_loss_vnd'])
        self.assertEqual(values['sharpe'],0);self.assertEqual(values['net_forecast_pct'],0)
        self.assertEqual(values['up_day_ratio_pct'],60);self.assertEqual(values['adv20_value_vnd'],1200000001)
        saved=enrich_saved_summary({'gate_pass':False,'score':99},{'raw_action':'AVOID','quant':{'fcast':{'meta_trust_probability':.6}}})
        self.assertFalse(saved['gate_pass']);self.assertEqual(saved['action'],'AVOID');self.assertEqual(saved['meta_trust_pct'],60)

    def test_visuals_use_actual_p05_p95_paths_and_hard_hmm_labels(self):
        prices=pd.DataFrame({'close':[100000,90000,110000]}, index=pd.date_range('2026-10-01',periods=3))
        paths=np.array([[110000,120000],[110000,90000],[110000,130000],[110000,100000]],dtype=float)
        report={'symbol':'FPT','fcast':{'horizon':1,'_mc_paths':paths},'hmm':{'_state_dates':prices.index,'_state_labels':['BULL','BEAR','SIDEWAY']},'rec':{'factor_details':{'liquidity':{'z':.4}}}}
        result=present_report(report,prices);r=result['research']
        self.assertEqual(r['units']['price'],'VND');self.assertEqual(r['simulationCount'],4)
        self.assertAlmostEqual(r['cone'][1]['p05'],np.percentile(paths[:,1],5))
        self.assertAlmostEqual(r['cone'][1]['p95'],np.percentile(paths[:,1],95))
        self.assertAlmostEqual(sum(p['probabilityPct'] for p in r['distribution']),100)
        self.assertIsNone(r['regime'][0]['probabilities']);self.assertEqual(r['regime'][1]['state'],'BEAR')
        self.assertAlmostEqual(r['drawdown'][1]['valuePct'],-10)
        self.assertEqual(r['factors'][0]['min'],-1);self.assertNotIn('_mc_paths',json.dumps(result))
        del report['fcast']['_mc_paths']
        empty=present_report(report,prices)['research'];self.assertEqual(empty['cone'],[]);self.assertEqual(empty['distribution'],[])

if __name__ == '__main__':unittest.main()
