import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {flattenResult,displayResult} from '../src/quant-modules.js';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>server.close());
const {default:Modules}=await server.ssrLoadModule('/src/components/QuantModules.jsx');
const {default:Picker}=await server.ssrLoadModule('/src/components/QuantViewPicker.jsx');

test('Quant choice presents sidebar and full-page without starting jobs during render',()=>{
  const html=renderToStaticMarkup(createElement(Picker,{symbol:'FPT',onChoose(){throw Error('render must not run')},onClose(){}}));
  assert(html.includes('Thanh bên chart'));assert(html.includes('Trang toàn màn hình'));assert(html.includes('aria-modal="true"'));
});
test('full-page modules expose origins, method, evidence, missing models and original results',()=>{
  const modules=[{id:'flow',title:'CMF',status:'computed',inputs:'OHLCV 20 phiên',method:'Vị trí đóng cửa có trọng số khối lượng',explanation:'CMF −0,2 đến từ đóng cửa gần đáy nến',limitations:'Không đo tiền rút thực tế',evidence:[{label:'Tổng khối lượng',value:1000,unit:'cổ phiếu'}],result:{cmf:-.2,buy_p:.4}},
  {id:'lgbm',title:'LightGBM',status:'unavailable',explanation:'Không đủ universe',result:{available:false,reason:'insufficient_symbol_universe'}}];
  const html=renderToStaticMarkup(createElement(Modules,{modules,expanded:true}));
  assert.equal((html.match(/class="quant-module card"/g)||[]).length,2);
  assert.equal((html.match(/open=""/g)||[]).length,2);
  for(const text of ['Vì sao có kết quả này?','Cách tính / phương pháp','Bằng chứng từ dữ liệu','Không khả dụng','Không đo tiền rút thực tế','insufficient_symbol_universe'])assert(html.includes(text));
  assert(!html.includes('NaN'));assert(!html.includes('undefined'));
});
test('module diagnostics preserve zero, false, null and nested forecasts',()=>{
  assert.deepEqual(flattenResult({value:0,available:false,p:null,forecast:[1,2]}),[
    {key:'value',value:0},{key:'available',value:false},{key:'p',value:null},{key:'forecast.0',value:1},{key:'forecast.1',value:2}]);
  assert.equal(displayResult(0),'0');assert.equal(displayResult(false),'Không');assert.equal(displayResult(null),'Chưa có');
});
test('API report mapping keeps modules, lineage, CMF and all chart artifacts',async()=>{
  const {getJob}=await server.ssrLoadModule('/src/api.js');const original=globalThis.fetch;
  const reports=[{id:'flow',title:'Dòng tiền CMF',result:{cmf:-.2}}];
  globalThis.fetch=async url=>new Response(JSON.stringify(String(url).endsWith('/session')?{ok:true}:String(url).includes('/reports/')?{
    symbol:'FPT',as_of:'2026-10-09',module_reports:reports,flow:{cmf:-.2},data_source_mode:'crawl_data_live',data_lineage:{observations:252},chart_manifest:[{id:'a',url:'/a'},{id:'b',url:'/b'}],commentary:'Nhận định'
  }:{job_id:'Q',symbol:'FPT',status:'succeeded'}));
  try{const job=await getJob('Q');assert.deepEqual(job.modelReports,reports);assert.equal(job.dataLineage.observations,252);assert.equal(job.metrics.find(m=>m.id==='cmf').value,-.2);assert.equal(job.chartManifest.length,2);}finally{globalThis.fetch=original;}
});
