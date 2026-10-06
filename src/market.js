import sample from '../shared/market-demo.json';
export const instruments=sample.instruments;
export const sectors=sample.sectors;
export const demoSnapshot=sample;
/** Registry mã live từ backend (bổ sung cho danh mục demo, không thay thế). */
const liveInstruments=new Map();
export const instrumentFor=sym=>liveInstruments.get(sym) || instruments.find(x=>x.symbol===sym);
export const sectorName=id=>sectors.find(x=>x.id===id)?.name || id || 'Chưa xác định';
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

const liveNum = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Dựng snapshot bảng điện từ overview backend (/api/v1/market/overview, giá
 * đã là VND) ghép với hàng quét đã công bố (tên/nhóm ngành/điểm). Backend
 * không trả tham chiếu/trần/sàn nên suy giá tham chiếu từ change_pct để
 * vẫn tính được độ rộng tăng/giảm; nến spark và dư mua/bán để trống.
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
      const changePct = liveNum(item.change_pct);
      const ref = liveNum(item.reference)
        ?? (price != null && changePct != null ? price / (1 + changePct / 100) : null);
      const exchange = item.exchange && item.exchange !== '—' ? item.exchange : (scan.exchange || '—');
      const inst = {
        symbol, name: scan.name || symbol, exchange,
        sectorId: scan.sector || 'unknown', active: true,
      };
      if (exchange === 'HOSE') inst.tvSymbol = `HOSE:${symbol}`;
      if (!liveInstruments.has(symbol)) {
        liveInstruments.set(symbol, inst);
        insts.push(inst);
      }
      quotes.push({
        symbol, ref,
        ceil: liveNum(item.ceiling), floor: liveNum(item.floor),
        price, vol: item.volume == null ? null : Math.max(0, Math.trunc(Number(item.volume))) || null,
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
    mode: 'live', source: 'vnstock_price_board', asOf, isStale: false,
    units: {price: 'VND', volume: 'shares', value: 'VND'},
    classification: {mode: 'live'}, instruments: insts, quotes,
  };
}
