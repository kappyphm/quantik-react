import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>server.close());
const {default:ChartWorkspace}=await server.ssrLoadModule('/src/components/ChartWorkspace.jsx');
const {default:QuantPanel}=await server.ssrLoadModule('/src/components/QuantPanel.jsx');
const {getSymbolDetail}=await server.ssrLoadModule('/src/api.js');
const {startQuantAnalysis}=await server.ssrLoadModule('/src/hooks/useQuantJob.js');
const {normalizeLiveBoard}=await server.ssrLoadModule('/src/market.js');

test('old backend-source preference cannot hide the TradingView chart or indicators',()=>{
 const savedWindow=globalThis.window,savedStorage=globalThis.localStorage;
 globalThis.window={matchMedia:()=>({matches:false})};
 globalThis.localStorage={getItem:key=>key==='qt.chart.source'?'"backend"':null};
 try{
  const html=renderToStaticMarkup(createElement(ChartWorkspace,{sym:'A32',exchange:'UPCOM'}));
  assert(html.includes('widget-host'));assert(html.includes('Chỉ báo TradingView'));
  assert(html.includes('Mở trên TradingView'));assert(html.includes('UPCOM%3AA32'));
  assert(!html.includes('Nguồn biểu đồ'));assert(!html.includes('Dữ liệu Quantik'));
  assert(!html.includes('Không tải được nến'));assert(!html.includes('Chưa xác định được sàn'));
 }finally{globalThis.window=savedWindow;globalThis.localStorage=savedStorage;}
});
test('a listed ticker absent from the published scan gets venue metadata without starting a job',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return String(url).includes('/market/symbols/')?new Response(JSON.stringify({symbol:'A32',exchange:'UPCOM',tv_symbol:'UPCOM:A32'})):new Response(JSON.stringify({detail:'no published row'}),{status:404});};
 try{const detail=await getSymbolDetail('A32');assert.equal(detail.exchange,'UPCOM');assert.equal(calls.length,2);assert(!calls.some(url=>url.includes('/quant/jobs')));}
 finally{globalThis.fetch=original;}
});
test('board metadata retains TradingView venues for HNX and UPCoM',()=>{
 const snapshot=normalizeLiveBoard([{items:[{symbol:'A32',exchange:'UPCOM'},{symbol:'SHS',exchange:'HNX'}]}],new Map());
 assert.deepEqual(snapshot.instruments.map(i=>i.tvSymbol),['UPCOM:A32','HNX:SHS']);
});
test('screened-out Quant result displays liquidity evidence, with no invented price plan or forecasts',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('/quant/reports/')?{
  symbol:'A32',analysis_status:'screened_out',analysis_outcome:{code:'LIQUIDITY_FAIL'},action:'AVOID',
  score:null,synthesis:{headline:'Tránh mở vị thế mới theo kết quả hiện tại'},module_reports:[{id:'liquidity',title:'Thanh khoản',status:'computed',result:{pass:false,adv20_value_vnd:1000000},reading:'Giá trị giao dịch chưa đạt ngưỡng.'}]
 }:String(url).includes('/quant/jobs/')?{job_id:'SCREENED',symbol:'A32',status:'succeeded'}:{job_id:'SCREENED'}));
 try{
  await startQuantAnalysis('A32');const html=renderToStaticMarkup(createElement(QuantPanel,{sym:'A32',expanded:true}));
  assert(html.includes('Thanh khoản chưa đạt điều kiện'));assert(html.includes('Giá trị giao dịch chưa đạt ngưỡng'));
  assert(!html.includes('keyrow'));assert(!html.includes('Dải giá dự báo'));assert(!html.includes('RuntimeError'));
 }finally{globalThis.fetch=original;}
});
