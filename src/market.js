import sample from '../shared/market-demo.json';
export const instruments=sample.instruments;
export const sectors=sample.sectors;
export const demoSnapshot=sample;
export const instrumentFor=sym=>instruments.find(x=>x.symbol===sym);
export const sectorName=id=>sectors.find(x=>x.id===id)?.name || 'Chưa xác định';
export const fmt=(v,d=2)=>v==null || !Number.isFinite(Number(v))?'—':Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
export const priceClass=(v,r)=>v==null?'dim':r.ceil!=null&&v>=r.ceil?'ceil':r.floor!=null&&v<=r.floor?'floor':v>r.ref?'up':v<r.ref?'down':'ref';
export const change=r=>Number.isFinite(r.price)&&r.ref>0?r.price/r.ref-1:null;
export function normalizeSnapshot(data) {
 if(Array.isArray(data))return {source:'Legacy API · nguồn chưa xác nhận',mode:'unknown',asOf:null,isStale:false,units:{price:'VND',volume:'shares',value:'VND'},instruments,quotes:data.map(r=>({...r,symbol:r.sym,ref:r.ref==null?null:r.ref*1000,ceil:r.ceil==null?null:r.ceil*1000,floor:r.floor==null?null:r.floor*1000,price:r.price==null?null:r.price*1000,spark:r.spark?.map(x=>x*1000)}))};
 if(!data||!Array.isArray(data.quotes)||data.units?.price!=='VND')throw Error('Quote schema hoặc đơn vị không hợp lệ');
 return {...data,mode:data.mode||'unknown',instruments:data.instruments||instruments};
}
export function sectorSummary(rows) {
 return [...new Set(rows.map(r=>r.sectorId||'unknown'))].map(id=>{
  const a=rows.filter(r=>(r.sectorId||'unknown')===id),valid=a.map(change).filter(x=>x!=null),liquid=a.filter(r=>Number.isFinite(r.value)),score=a.filter(r=>Number.isFinite(r.score));
  return {id,name:sectorName(id),rows:a,count:a.length,valid:valid.length,up:valid.filter(x=>x>0).length,down:valid.filter(x=>x<0).length,flat:valid.filter(x=>x===0).length,mean:valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null,value:liquid.length?liquid.reduce((s,r)=>s+r.value,0):null,valueCoverage:liquid.length,score:score.length?score.reduce((s,r)=>s+r.score,0)/score.length:null};
 });
}
