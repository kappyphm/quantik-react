import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createQuantJobs} from '../src/quant-jobs.js';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>server.close());
const {demoScan,normalizeScan,selectHighlights,scanFields,formatScanValue}=await server.ssrLoadModule('/src/scan.js');
const {normalizeSnapshot,marketRows}=await server.ssrLoadModule('/src/market.js');
const {demoResearch,normalizeResearch,payoff}=await server.ssrLoadModule('/src/research.js');
const {glossary}=await server.ssrLoadModule('/src/content/glossary.js');
const {default:Highlights}=await server.ssrLoadModule('/src/components/ScanHighlights.jsx');
const {default:Visuals}=await server.ssrLoadModule('/src/components/ResearchVisuals.jsx');
const row=(i,extra={})=>({symbol:`S${String(i).padStart(2,'0')}`,name:'Doanh nghiệp',exchange:'HOSE',score:i,...extra});

test('5/5 stable and non-overlapping; high score AVOID stays a caution; errors excluded',()=>{
 const rows=Array.from({length:20},(_,i)=>row(i+1));
 rows.push(row(21,{score:82,action:'AVOID'}),row(22,{score:100,data_quality_status:'FAIL'}),row(23,{score:null}),row(24,{score:0,analysis_status:'failed'}));
 const selected=selectHighlights({rows});
 assert.equal(selected.opportunities.length,5);assert.equal(selected.cautions.length,5);
 assert.equal(new Set([...selected.opportunities,...selected.cautions].map(r=>r.symbol)).size,10);
 assert(selected.cautions.some(r=>r.symbol==='S21'));assert(!selected.opportunities.some(r=>r.symbol==='S21'));
 assert.equal(selected.eligibleCount,21);assert.equal(selected.excludedCount,3);assert.equal(selected.buyNowCount,0);
 assert.deepEqual(selectHighlights({rows:[...rows].reverse()}),selected);
});
test('small and all-AVOID universes never pad with invalid or duplicate opportunities',()=>{
 for(const n of [0,3,7]){const s=selectHighlights({rows:Array.from({length:n},(_,i)=>row(i))});assert.equal(s.opportunities.length+s.cautions.length,n);}
 const s=selectHighlights({rows:Array.from({length:12},(_,i)=>row(i,{action:'TRÁNH'}))});assert.equal(s.opportunities.length,0);assert.equal(s.cautions.length,5);
});
test('BUY_NOW count requires an explicit gate, score alone never creates BUY',()=>{
 const rows=[row(1,{score:100}),row(2,{action:'BUY_NOW',passed:false}),row(3,{action:'BUY_NOW',gate_pass:true})];
 assert.equal(selectHighlights({rows}).buyNowCount,1);assert.equal(rows[0].action,undefined);
});
test('exactly 50 metric fields preserve zero, units and daily-return scope',()=>{
 assert.equal(scanFields.length,50);assert.equal(new Set(scanFields.map(f=>f.key)).size,50);
 const field=k=>scanFields.find(f=>f.key===k);
 assert.equal(formatScanValue({entry_vnd:16700},field('entry_vnd')),'16,7');
 assert.equal(formatScanValue({adv20_value_vnd:1.2e9},field('adv20_value_vnd')),'1,2');
 assert.equal(formatScanValue({net_forecast_pct:0},field('net_forecast_pct')),'0%');
 assert.equal(formatScanValue({},field('net_forecast_pct')),'—');
 assert(field('up_day_ratio_pct').label.includes('phiên tăng'));
 assert(!field('meta_trust_pct').label.includes('P(win)'));
});
test('server-pinned highlights retain their selected symbols and reject overlaps',()=>{
 const data=demoScan(),pick=selectHighlights(data);
 const snapshot=normalizeScan({...data,rows:[...pick.opportunities,...pick.cautions],highlights:{opportunities:pick.opportunities.map(r=>r.symbol),cautions:pick.cautions.map(r=>r.symbol)}});
 assert.deepEqual(selectHighlights(snapshot).opportunities,pick.opportunities);
 assert.throws(()=>normalizeScan({...snapshot,highlights:{opportunities:['FPT'],cautions:['FPT']}}));
 assert.throws(()=>normalizeScan({...data,rows:[{...data.rows[0],net_forecast_pct:'5%'}]}));
});
test('complete listing >500 survives missing quotes and repeated refresh without demo metadata',()=>{
 const instruments=Array.from({length:1700},(_,i)=>({symbol:`X${i}`,name:`Company ${i}`,exchange:'HNX'}));
 const data={instruments,quotes:[{symbol:'X2',price:16700,ref:16000,value:0,vol:0}],units:{price:'VND'},mode:'live'};
 for(let n=0;n<2;n++){const s=normalizeSnapshot(structuredClone(data)),rows=marketRows(s);assert.equal(rows.length,1700);assert.equal(rows[1000].name,'Company 1000');assert.equal(rows[1000].price,null);assert.equal(rows[2].value,0);assert.equal(s.mode,'unknown');}
 assert.throws(()=>normalizeSnapshot({...data,instruments:undefined}));
});
test('invalid prices stay unavailable while typed ATO quotes remain typed',()=>{
 const [r]=marketRows({instruments:[{symbol:'FPT'}],quotes:[{symbol:'FPT',price:0,ref:null,vol:0,bids:[{kind:'ato',price:null,volume:100}]}]});
 assert.equal(r.price,null);assert.equal(r.ref,null);assert.equal(r.vol,0);assert.equal(r.bids[0].kind,'ato');
});
test('research validates symbol/units, quantile order, probabilities and missing factors',()=>{
 const data=demoResearch('FPT',100000),r=normalizeResearch(data,'FPT');assert.equal(r.cone[0].p50,100000);assert.equal(r.factors.length,5);
 assert.equal(normalizeResearch(data,'HPG'),null);assert.equal(normalizeResearch({...data,units:{price:'thousand-VND'}},'FPT'),null);
 data.cone[1].p05=data.cone[1].p95+1;data.regime[0].probabilities.bull=5;data.factors[2].value=null;
 const checked=normalizeResearch(data,'FPT');assert.equal(checked.cone.length,10);assert.equal(checked.regime.length,19);assert.equal(checked.factors[2].id,'relative');
 assert.equal(demoResearch('ZZZ',null).cone.length,0);
});
test('payoff never uses invalid levels or confuses forecast with TP distance',()=>{
 assert.deepEqual(payoff(100,95,110),{upsidePct:10.000000000000009,downsidePct:-5.000000000000004,rr:2});
 for(const levels of [[100,100,110],[100,105,110],[null,95,110],[0,-1,2]])assert.equal(payoff(...levels),null);
});
test('two entry points share a pending job and reconnect to existing backend ID',async()=>{
 let starts=0,reads=0,release;const hold=new Promise(r=>release=r);
 const jobs=createQuantJobs({start:async()=>{starts++;await hold;return {id:'shared'};},read:async id=>{assert.equal(id,'shared');reads++;return {status:'done',modules:[]};}});
 let notifications=0;const unsubscribe=jobs.subscribe('FPT',()=>notifications++);
 const a=jobs.run('FPT'),b=jobs.run('FPT',['trend']);assert.equal(a,b);unsubscribe();release();await a;
 assert.equal(starts,1);assert.equal(reads,1);assert.equal(jobs.snapshot('FPT').job.status,'done');assert.equal(notifications,1);
});
test('polling errors are recoverable and no local preview overwrites an in-flight job',async()=>{
 const jobs=createQuantJobs({start:async()=>({id:'one'}),read:async()=>{throw Error('offline');}});
 const run=jobs.run('HPG');jobs.preview('HPG',{status:'done',local:true});assert.equal(jobs.snapshot('HPG').job.status,'queued');await run;
 assert.equal(jobs.snapshot('HPG').job.status,'error');assert(jobs.snapshot('HPG').error);
});
test('all registered terms contain an example and usable condition/threshold text',()=>{
 for(const term of glossary){assert(term.example?.length>10,term.id);assert((term.conditions||term.interpretation||term.limitations)?.length>10,term.id);}
});
test('React render shows exactly ten ticker-adjacent Quant actions and six accessible visual panels',()=>{
 const html=renderToStaticMarkup(createElement(Highlights,{snapshot:demoScan(),heading:{current:null},onOpen(){},onQuant(){},onRefresh(){}}));
 assert.equal((html.match(/class="quant-inline"/g)||[]).length,10);assert(html.includes('Tỷ lệ phiên tăng'));
 const report=renderToStaticMarkup(createElement(Visuals,{sym:'FPT',job:{research:demoResearch('FPT',100000),summary:{entry:100,stop:95,tp2:110}}}));
 assert.equal((report.match(/class="research-card"/g)||[]).length,6);assert(report.includes('không phải kết quả mô hình'));assert(!report.includes('NaN'));
 const missing=renderToStaticMarkup(createElement(Visuals,{sym:'FPT',job:{mode:'live'}}));assert(missing.includes('Chưa có dữ liệu'));assert(!missing.includes('Visual mẫu cố định'));
});

test('v1 board loads all 1700 listings without a scan and retains metadata every refresh',async()=>{
 const {getBoard}=await server.ssrLoadModule('/src/api.js');const {normalizeLiveBoard}=await server.ssrLoadModule('/src/market.js');
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{
  const u=new URL(url,'http://test');
  if(u.pathname.includes('/scans/'))return new Response(JSON.stringify({detail:'No publication'}),{status:404});
  calls++;const page=Number(u.searchParams.get('page')),size=Number(u.searchParams.get('page_size'));
  const items=Array.from({length:Math.min(size,1700-(page-1)*size)},(_,i)=>({symbol:`X${(page-1)*size+i}`,price:10000,reference:10000,volume:0,exchange:'HNX'}));
  return new Response(JSON.stringify({total:1700,items,as_of:'2026-10-08T08:00:00Z'}));
 };
 try{for(let i=0;i<2;i++){const data=await getBoard();assert.equal(data.instruments.length,1700);assert.equal(marketRows(normalizeSnapshot(data))[1699].symbol,'X1699');assert.equal(data.quotes[0].vol,0);assert.equal(data.mode,'unknown');}assert.equal(calls,68);
 const missing=normalizeLiveBoard([{items:[{symbol:'FPT',price:null,reference:null,volume:null}]}],new Map());assert.equal(missing.quotes[0].price,null);assert.equal(missing.quotes[0].ref,null);
 }finally{globalThis.fetch=original;}
});

test('v1 highlights keep gate enum, zero ratios and backend-selected ticker IDs',async()=>{
 const {getScanHighlights}=await server.ssrLoadModule('/src/api.js');const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({id:'PINNED',slot:'POST_CLOSE',data_as_of:'2026-10-08',published_at:'2026-10-08T09:00:00Z',universe_count:20,items:[{symbol:'FPT',name:'FPT',exchange:'HOSE',analysis_status:'completed',score:80,action:'BUY_NOW',gate_pass:false,entry_vnd:16700,net_forecast_pct:0}],highlights:{opportunities:['FPT'],cautions:[]},eligibleCount:20,excludedCount:0,analyzedCount:20,buyNowCount:0}));
 try{const data=await getScanHighlights();assert.equal(data.runId,'PINNED');assert.equal(data.rows[0].entry_vnd,16700);assert.equal(data.rows[0].net_forecast_pct,0);assert.equal(data.rows[0].passed,false);assert.equal(selectHighlights(data).opportunities[0].symbol,'FPT');}finally{globalThis.fetch=original;}
});

test('saved v1 report renders hard HMM labels without fabricating posterior probabilities',async()=>{
 const {mapBackendResearch}=await server.ssrLoadModule('/src/research.js');
 const research=mapBackendResearch({symbol:'FPT',charts:{regime:[{date:'2026-10-08',close:100000,state:'BULL'}],probability_cone:{p10:[1,2],p50:[2,3],p90:[3,4]}}});
 assert.equal(normalizeResearch(research,'FPT').regime.length,1);assert.equal(research.cone.length,0);
 const html=renderToStaticMarkup(createElement(Visuals,{sym:'FPT',job:{research}}));assert(html.includes('Nhãn trạng thái'));assert(!html.includes('NaN'));
});
