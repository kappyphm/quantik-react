import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advancedChartConfig,backendIntervals,tradingViewIntervals,normalizeInterval,normalizeIndicators} from '../src/chart-settings.js';

test('TradingView supports intraday without passing intraday into daily snapshots',()=>{
  for(const [interval] of tradingViewIntervals) assert.equal(advancedChartConfig({symbol:'HOSE:FPT',interval}).interval,interval);
  for(const interval of ['1','60','240',null,'invalid']) assert.equal(normalizeInterval(interval,backendIntervals),'D');
});
test('study toggles allow an empty chart, deduplicate and reject stale stored IDs',()=>{
  assert.deepEqual(normalizeIndicators(['rsi','rsi','unknown','bb']),['rsi','bb']);
  assert.deepEqual(normalizeIndicators('rsi'),['sma','rsi']);
  assert.deepEqual(advancedChartConfig({symbol:'HOSE:FPT',indicators:[]}).studies,[]);
  assert.deepEqual(advancedChartConfig({symbol:'HOSE:FPT',indicators:['ema','macd','bb','atr']}).studies,
    ['MAExp@tv-basicstudies','MACD@tv-basicstudies','BB@tv-basicstudies','ATR@tv-basicstudies']);
});
test('widget keeps ticker pinned to Quant panel and exposes native chart controls',()=>{
  const config=advancedChartConfig({symbol:'HOSE:FPT',theme:'light',interval:'60',indicators:['macd']});
  assert.equal(config.symbol,'HOSE:FPT'); assert.equal(config.allow_symbol_change,false);
  assert.equal(config.hide_top_toolbar,false); assert.equal(config.hide_side_toolbar,false);
  assert.equal(config.theme,'light'); assert.equal(config.timezone,'Asia/Ho_Chi_Minh');
  assert.deepEqual(config.studies,['MACD@tv-basicstudies']);
  assert.deepEqual(advancedChartConfig({symbol:'HOSE:FPT',compact:true}).studies,[]);
  assert.deepEqual(advancedChartConfig({symbol:'HOSE:FPT'}).studies,['MASimple@tv-basicstudies','RSI@tv-basicstudies']);
});
