"""Presentation fields only: preserve core Action Gate, metrics and VND units."""
from __future__ import annotations
import math

ROW_FIELDS = {
    'action':'Action','gate_pass':'GatePass','gate_reasons':'GateReasons',
    'sector_return_20d_pct':'NganhRet20D%','sector_correlation':'TuongQuanNganh',
    'sector_lead_lag':'MaDanDatNganh','sharpe':'Sharpe','up_day_ratio_pct':'WinRate',
    'max_drawdown_pct':'MaxDD','annual_return_pct':'AnnRet','hmm_regime':'HMM',
    'volatility_regime':'VolReg','forecast_direction':'Forecast','ensemble_return_pct':'EnsRet%',
    'agreement_pct':'Agreement','model_coverage_pct':'Coverage%','directional_support_pct':'AlphaSupport%',
    'active_model_count':'ActiveModels','meta_trust_pct':'MetaTrust%','hurst':'Hurst',
    'hurst_regime':'HurstRegime','lightgbm_rank_pct':'LightGBMRank%','lightgbm_alpha_pct':'LightGBMAlpha%',
    'gross_forecast_pct':'GrossFc%','roundtrip_cost_pct':'CostRT%','net_forecast_pct':'NetFc%',
    'mc_volatility_source':'MCVol','lock_drawdown_pct':'LockDD%','probability_loss_gt_3pct':'PLoss3%',
    'data_quality_status':'DQStatus','data_quality_score':'DQScore','data_quality_flags':'DQFlags',
    'liquidity_tier':'LiqTier','capacity_shares':'CapacityShares','gap_abs_p95_pct':'GapP95%',
    'entry_vnd':'Entry','stop_loss_vnd':'SL','take_profit_1_vnd':'TP1','take_profit_2_vnd':'TP',
    'trade_model_agreement_pct':'ModelAgreement%','risk_pct_nav':'RiskPctNAV','commentary':'Analysis',
}

def fields_from_summary(row, report=None):
    values = {key:row.get(source) for key,source in ROW_FIELDS.items()}
    report = report or {}
    # Use unrounded liquidity source, not the Excel display rounded to billions.
    values['adv20_value_vnd'] = report.get('liquidity', {}).get('adv20_value_vnd')
    values['holding_sessions'] = report.get('fcast', {}).get('horizon')
    return _valid(values)

def _valid(values):
    result = {}
    for key,value in values.items():
        if isinstance(value,float) and not math.isfinite(value): value=None
        if key.endswith('_vnd') and isinstance(value,(int,float)) and value<=0:value=None
        result[key]=value
    return result

def enrich_saved_summary(summary, detail):
    """Read legacy publications without running a model or rewriting SQLite."""
    q=detail.get('quant') or {}; fc=q.get('fcast') or {}; sl=q.get('sl') or {}
    stats=q.get('stats') or {}; lock=fc.get('lock_risk') or {}; costs=q.get('costs') or {}
    dq=q.get('data_quality') or {}; liq=q.get('liquidity') or {}; sec=q.get('sector') or {}
    cc=q.get('cross_corr') or {}; leads=cc.get('lead_lag') or []; lgb=q.get('lightgbm_cross_sectional') or {}
    fallback={
      'action':detail.get('raw_action') or (q.get('action') or {}).get('action'),
      'gate_reasons':(q.get('action') or {}).get('reason_codes'),
      'holding_sessions':fc.get('horizon'),'index_trend':summary.get('vni_trend'),
      'sector_return_20d_pct':(sec.get('trend') or {}).get('ret_20D_pct'),
      'sector_correlation':cc.get('avg_pairwise_corr'),'sector_lead_lag':leads[0].get('relation') if leads else None,
      'sharpe':stats.get('sharpe'),'up_day_ratio_pct':stats.get('win_rate_pct'),
      'max_drawdown_pct':stats.get('max_dd_pct'),'annual_return_pct':stats.get('ann_return_pct'),
      'hmm_regime':(q.get('hmm') or {}).get('current'),'volatility_regime':(q.get('vol') or {}).get('regime'),
      'forecast_direction':fc.get('consensus'),'ensemble_return_pct':fc.get('ensemble_ret_pct'),
      'agreement_pct':fc.get('agreement_pct'),'model_coverage_pct':fc.get('coverage_pct'),
      'directional_support_pct':fc.get('support_pct'),'active_model_count':fc.get('active_models'),
      'meta_trust_pct':fc.get('meta_trust_probability')*100 if isinstance(fc.get('meta_trust_probability'),(int,float)) else None,
      'hurst':(fc.get('hurst') or {}).get('hurst'),'hurst_regime':(fc.get('hurst') or {}).get('regime'),
      'lightgbm_rank_pct':lgb.get('rank_pct'),'lightgbm_alpha_pct':lgb.get('predicted_alpha_pct'),
      'gross_forecast_pct':costs.get('gross_forecast_pct'),'roundtrip_cost_pct':costs.get('roundtrip_cost_pct'),
      'net_forecast_pct':costs.get('net_forecast_pct'),'mc_volatility_source':(fc.get('mc') or {}).get('vol_source'),
      'lock_drawdown_pct':lock.get('max_dd_lock_pct'),'probability_loss_gt_3pct':lock.get('prob_loss_gt_3pct'),
      'data_quality_status':dq.get('status'),'data_quality_score':dq.get('score'),'data_quality_flags':dq.get('flags'),
      'liquidity_tier':liq.get('tier'),'adv20_value_vnd':liq.get('adv20_value_vnd'),
      'capacity_shares':liq.get('capacity_shares'),'gap_abs_p95_pct':liq.get('gap_abs_p95_pct'),
      'entry_vnd':sl.get('entry'),'stop_loss_vnd':sl.get('sl_swing'),'take_profit_1_vnd':sl.get('tp1'),
      'take_profit_2_vnd':sl.get('tp_optimal',sl.get('tp2',sl.get('tp_2r'))),
      'trade_model_agreement_pct':sl.get('model_agreement_pct'),'risk_pct_nav':(q.get('pos') or {}).get('risk_pct_nav'),
      'commentary':detail.get('commentary'),
    }
    return {**_valid(fallback),**summary}
