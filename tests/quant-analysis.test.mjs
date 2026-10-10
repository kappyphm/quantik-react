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
const {default:Synthesis}=await server.ssrLoadModule('/src/components/QuantSynthesis.jsx');

test('Quant choice presents sidebar and full-page without starting jobs during render',()=>{
  const html=renderToStaticMarkup(createElement(Picker,{symbol:'FPT',onChoose(){throw Error('render must not run')},onClose(){}}));
  assert(html.includes('Thanh bên chart'));assert(html.includes('Trang toàn màn hình'));assert(html.includes('aria-modal="true"'));
});
test('modules explain five reader questions without rendering code, technical keys or JSON',()=>{
  const modules=[{id:'flow',title:'CMF',status:'computed',definition:'Áp lực giá–khối lượng',conditions:'OHLCV 20 phiên',reading:'CMF −0,2: đóng cửa thiên phía thấp',why:'Đóng góp âm lớn hơn dương',connection:'Không đo tiền rút thực tế',metrics:[{label:'CMF của lần chạy',value:-.2,unit:''}],evidence:[{label:'Tổng khối lượng',value:1000,unit:'cổ phiếu'}],result:{cmf:-.2,buy_p:.4,__secret:'print(code)'}},
  {id:'lgbm',title:'LightGBM',status:'unavailable',reading:'Không đủ nhiều mã để huấn luyện',result:{available:false,reason:'insufficient_symbol_universe'}}];
  const html=renderToStaticMarkup(createElement(Modules,{modules,expanded:true}));
  assert.equal((html.match(/class="quant-module card"/g)||[]).length,2);
  assert.equal((html.match(/open=""/g)||[]).length,2);
  for(const text of ['Đây là gì','Đầu vào và điều kiện','Kết quả đang nói','Vì sao xuất hiện','Ghép với mô hình khác','Không khả dụng','Không đo tiền rút thực tế'])assert(html.includes(text));
  for(const text of ['<pre','<code','buy_p','__secret','print(code)','insufficient_symbol_universe','NaN','undefined'])assert(!html.includes(text));
});
test('synthesis renders linked reasoning, recommendation and conditions instead of technical payloads',()=>{
 const html=renderToStaticMarkup(createElement(Synthesis,{expanded:true,analysis:{headline:'Tiếp tục theo dõi',recommendation:'Dự báo tăng nhưng CMF âm chưa xác nhận',sections:[{title:'Xu hướng và dòng tiền',paragraphs:['ER thấp; giá vòng vèo','CMF âm làm yếu xác nhận hướng tăng'],module_ids:['flow','trend']}],reasons:['Thời điểm chưa sẵn sàng'],conditions:['Chờ xác nhận'],limitations:['LightGBM'],result:{__code:'raw_json'}}}));
 const text=html.replace(/<[^>]*>/g,'');assert(text.includes('Dự báo tăng nhưng CMF âm'));assert(text.includes('CMF âm làm yếu'));assert(html.includes('Chờ xác nhận'));assert(html.includes('open=""'));assert(!html.includes('raw_json'));
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
    symbol:'FPT',as_of:'2026-10-09',module_reports:reports,synthesis:{headline:'Theo dõi'},flow:{cmf:-.2},data_source_mode:'crawl_data_live',data_lineage:{observations:252},chart_manifest:[{id:'a',url:'/a'},{id:'b',url:'/b'}],commentary:'Nhận định'
  }:{job_id:'Q',symbol:'FPT',status:'succeeded'}));
  try{const job=await getJob('Q');assert.deepEqual(job.modelReports,reports);assert.equal(job.synthesis.headline,'Theo dõi');assert.equal(job.summary.action,'Theo dõi');assert.equal(job.dataLineage.observations,252);assert.equal(job.metrics.find(m=>m.id==='cmf').value,-.2);assert.equal(job.chartManifest.length,2);}finally{globalThis.fetch=original;}
});
