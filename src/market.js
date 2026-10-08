import sample from '../shared/market-demo.json';
export const instruments=sample.instruments;
export const sectors=sample.sectors;
export const demoSnapshot=sample;
let currentInstruments=new Map(instruments.map(i=>[i.symbol,i]));
let currentSectors=new Map(sectors.map(s=>[s.id,s]));
export const instrumentFor=sym=>currentInstruments.get(sym);
export const sectorName=id=>currentSectors.get(id)?.name || 'Chưa xác định';
export const fmt=(v,d=2)=>v==null || v==='' || typeof v==='boolean'||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
export const priceClass=(v,r)=>!Number.isFinite(v)||v<=0?'dim':Number.isFinite(r.ceil)&&r.ceil>0&&v>=r.ceil?'ceil':Number.isFinite(r.floor)&&r.floor>0&&v<=r.floor?'floor':!Number.isFinite(r.ref)||r.ref<=0?'dim':v>r.ref?'up':v<r.ref?'down':'ref';
export const change=r=>Number.isFinite(r.price)&&r.price>0&&Number.isFinite(r.ref)&&r.ref>0?r.price/r.ref-1:null;
export function normalizeSnapshot(data) {
 if(Array.isArray(data))return {source:'Legacy API · nguồn chưa xác nhận',mode:'unknown',asOf:null,isStale:false,units:{price:'VND',volume:'shares',value:'VND'},instruments,quotes:data.map(r=>({...r,symbol:r.sym,ref:r.ref==null?null:r.ref*1000,ceil:r.ceil==null?null:r.ceil*1000,floor:r.floor==null?null:r.floor*1000,price:r.price==null?null:r.price*1000,spark:r.spark?.map(x=>x*1000)}))};
 if(!data||!Array.isArray(data.quotes)||data.units?.price!=='VND')throw Error('Quote schema hoặc đơn vị không hợp lệ');
 if(!Array.isArray(data.instruments))throw Error('Thiếu danh mục bảng điện');
 const symbols=new Set(data.instruments.map(i=>i.symbol));
 if(symbols.size!==data.instruments.length||data.instruments.some(i=>typeof i.symbol!=='string'||!/^[A-Z0-9]{1,12}$/.test(i.symbol))||data.quotes.some(q=>!symbols.has(q.symbol))||new Set(data.quotes.map(q=>q.symbol)).size!==data.quotes.length)throw Error('Danh mục hoặc quotes bị trùng/không khớp');
 currentInstruments=new Map(data.instruments.map(i=>[i.symbol,i]));
 currentSectors=new Map((data.sectors||[]).map(s=>[s.id,s]));
 return {...data,mode:data.mode==='live'&&data.verifiedLive!==true?'unknown':data.mode||'unknown'};
}
export const emptySnapshot={source:'Đang chờ nguồn bảng điện',mode:'unknown',asOf:null,units:{price:'VND',volume:'shares',value:'VND'},instruments:[],quotes:[],sectors:[]};
export function marketRows(snapshot){
 const quotes=new Map(snapshot.quotes.map(q=>[q.symbol,q]));
 const numeric=(value,price=false)=>Number.isFinite(value)&&(price?value>0:value>=0)?value:null;
 return snapshot.instruments.map(i=>{
  const q=quotes.get(i.symbol)||{},row={...q,...i,name:i.name||i.symbol,sectorId:i.sectorId||'unknown',exchange:i.exchange||'UNKNOWN'};
  for(const key of ['price','ref','ceil','floor','open','high','low'])row[key]=numeric(q[key],true);
  for(const key of ['vol','value','lastVolume','foreignBuy','foreignSell','foreignRoom'])row[key]=numeric(q[key]);
  row.score=Number.isFinite(q.score)?q.score:null;
  row.spark=Array.isArray(q.spark)?q.spark.filter(v=>Number.isFinite(v)&&v>0):[];
  for(const side of ['bids','asks'])row[side]=(Array.isArray(q[side])?q[side]:[]).slice(0,3).map(x=>({...x,price:numeric(x?.price,true),volume:numeric(x?.volume)}));
  return row;
 });
}
export function sectorSummary(rows) {
 return [...new Set(rows.map(r=>r.sectorId||'unknown'))].map(id=>{
  const a=rows.filter(r=>(r.sectorId||'unknown')===id),valid=a.map(change).filter(x=>x!=null),liquid=a.filter(r=>Number.isFinite(r.value)),score=a.filter(r=>Number.isFinite(r.score));
   return {id,name:sectorName(id),rows:a,count:a.length,valid:valid.length,up:valid.filter(x=>x>0).length,down:valid.filter(x=>x<0).length,flat:valid.filter(x=>x===0).length,mean:valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null,value:liquid.length?liquid.reduce((s,r)=>s+r.value,0):null,valueCoverage:liquid.length,score:score.length?score.reduce((s,r)=>s+r.score,0)/score.length:null};
  });
}

const liveNum = value => {
  if(value==null||value===''||typeof value==='boolean')return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Dựng snapshot bảng điện từ overview backend (/api/v1/market/overview, giá
 * đã là VND) ghép với hàng quét đã công bố (tên/nhóm ngành/điểm). Backend
 * trả tham chiếu/trần/sàn và ba mức book. Không suy giá thiếu từ biến động.
 */
export function normalizeLiveBoard(pages, scanBySymbol) {
  const quotes = [];
  const insts = [];
  const seen = new Set();
  for (const page of pages || []) {
    for (const item of page.items || []) {
      const symbol = String(item.symbol || '').toUpperCase();
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      const scan = (scanBySymbol && scanBySymbol.get(symbol)) || {};
      const price = liveNum(item.price);
      const ref = liveNum(item.reference);
      const exchange = item.exchange && item.exchange !== '—' ? item.exchange : (scan.exchange || '—');
      const inst = {
        symbol, name: scan.name || symbol, exchange,
        sectorId: scan.sector || 'unknown', active: true,
      };
      if (exchange === 'HOSE') inst.tvSymbol = `HOSE:${symbol}`;
      insts.push(inst);
      quotes.push({
        symbol, ref,
        ceil: liveNum(item.ceiling), floor: liveNum(item.floor),
        price, vol: item.volume == null ? null : Math.max(0, Math.trunc(Number(item.volume))),
        value: liveNum(item.total_value),
        open: liveNum(item.open), high: liveNum(item.high), low: liveNum(item.low),
        bids: (item.bids || []).map(level => ({price: liveNum(level.price), volume: liveNum(level.volume)})),
        asks: (item.asks || []).map(level => ({price: liveNum(level.price), volume: liveNum(level.volume)})),
        foreignBuy: liveNum(item.foreign_buy), foreignSell: liveNum(item.foreign_sell),
        foreignRoom: liveNum(item.foreign_room),
        score: scan.score ?? null,
      });
    }
  }
  const asOf = pages.map(p => p.as_of).filter(Boolean).sort().pop() || null;
  return {
    mode: 'unknown', source: pages[0]?.source || 'vnstock_price_board', asOf, isStale: false,
    units: {price: 'VND', volume: 'shares', value: 'VND'},
    classification: {mode: 'published-scan'}, instruments: insts, quotes,
    sectors: [...new Set(insts.map(i=>i.sectorId))].map(id=>({id,name:id==='unknown'?'Chưa xác định':id})),
    delayDisclosure: pages[0]?.delay_disclosure || 'not_disclosed_by_provider',
  };
}
