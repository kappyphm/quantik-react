import json
import unittest
import pandas as pd
from quant_explanations import CATALOG, module_reports
from quant_narrative import narrative, synthesize


def prices(volume=1000):
    return pd.DataFrame({'open':100.,'high':110.,'low':90.,'close':98.,'volume':volume}, index=pd.bdate_range('2026-01-01',periods=150))


class NarrativeTest(unittest.TestCase):
    def test_all_modules_have_reader_sections_and_are_covered_in_linked_summary(self):
        modules = module_reports({'flow':{'cmf':-.2}},prices())
        modules.append({'id':'backtest','title':'Backtest','status':'unavailable','result':{},**narrative('backtest',{},prices(),'unavailable')})
        for m in modules:
            for key in ('definition','conditions','reading','why','connection'):
                self.assertTrue(m[key],(m['id'],key))
        summary=synthesize(modules)
        linked=[key for section in summary['sections'] for key in section['module_ids']]
        self.assertCountEqual(linked,[key for key,*_ in CATALOG]+['backtest'])
        self.assertEqual(len(linked),len(set(linked)))

    def test_distribution_explains_tail_and_link_to_historical_sharpe_without_causal_claims(self):
        modules=module_reports({'dist':{'excess_kurtosis':1.84,'skewness':-.21},'stats':{'sharpe':2}},prices())
        distribution=next(m for m in modules if m['id']=='dist')
        self.assertIn('1,84',distribution['reading']);self.assertIn('bậc bốn',distribution['why']);self.assertIn('Sharpe',distribution['connection'])
        self.assertNotIn('xác suất thắng 84',distribution['reading'])

    def test_positive_forecast_conflicts_with_negative_flow_and_weak_relative_strength(self):
        modules=module_reports({'flow':{'cmf':-.2},'trend':{'er':.28},'alpha':{'cross_sectional':{'rs_20d_pct':-4}},'fcast':{'ensemble_ret_pct':2,'agreement_pct':80,'coverage_pct':40,'timing_status':'WATCH'},'action':{'action':'WATCH','reason_codes':['TIMING_NOT_READY']}},prices())
        summary=synthesize(modules);text=json.dumps(summary,ensure_ascii=False)
        self.assertIn('mâu thuẫn',text);self.assertIn('chưa xác nhận',text);self.assertIn('-4',text)
        self.assertIn('theo dõi',summary['headline']);self.assertNotIn('BUY_NOW',text)

    def test_buy_requires_explicit_execution_gates_not_only_high_score(self):
        report={'rec':{'score':99},'action':{'action':'BUY_NOW'},'data_quality':{'status':'PASS'},'liquidity':{'pass':True},'sl':{'entry':100,'sl_swing':95,'tp1':110,'tp2':120},'pos':{'shares':100},'fcast':{'timing_status':'READY'}}
        self.assertIn('chưa đủ',synthesize(module_reports(report,prices()))['headline'])
        report['action'].update(gate_pass=True,executable=True)
        self.assertIn('Đủ điều kiện mua',synthesize(module_reports(report,prices()))['headline'])
        report['data_quality']['status']='FAIL'
        self.assertIn('Tránh mở',synthesize(module_reports(report,prices()))['headline'])

    def test_errors_stay_out_of_reader_text_and_missing_models_do_not_vote(self):
        modules=module_reports({'arima':{'error':'pip install statsmodels'},'hmm':{'method':'fallback','current':'SIDEWAY','prob_pct':99},'lightgbm_cross_sectional':{'available':False,'reason':'insufficient_symbol_universe','proj_pct':-20},'garch':{'garch':{'error':'Traceback code'},'egarch':{'error':'pip install arch'}}},prices())
        reader=[{key:m[key] for key in ('definition','conditions','reading','why','connection','metrics')} for m in modules]
        text=json.dumps(reader+synthesize(modules)['sections'],ensure_ascii=False)
        for technical in ('pip install','Traceback','insufficient_symbol_universe','-20','99%'):
            self.assertNotIn(technical,text)
        self.assertEqual(next(m['status'] for m in modules if m['id']=='garch'),'unavailable')
        self.assertNotIn('Xác suất gán trạng thái',[p['label'] for m in modules if m['id']=='hmm' for p in m['metrics']])

    def test_zero_volume_or_flat_candles_do_not_claim_balanced_money_flow(self):
        module=narrative('flow',{'cmf':0},prices(0),'computed');self.assertIn('quy ước',module['reading'])
        flat=prices();flat[['high','low','close']]=100
        module=narrative('flow',{'cmf':0},flat,'computed');self.assertIn('không có biên độ',module['reading'])


if __name__=='__main__':unittest.main()
