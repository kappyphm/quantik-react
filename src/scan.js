import demo from '../shared/scan-demo.json';
import fields from '../shared/scan-fields.json';
export const scanFields=fields;

export function normalizeScan(data) {
  if (!data || !['demo','published'].includes(data.mode) ||
      typeof data.runId !== 'string' || !data.runId || typeof data.source !== 'string' || !data.source ||
      typeof data.session !== 'string' || typeof data.publishedAt !== 'string' ||
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data.publishedAt) || !Number.isFinite(Date.parse(data.publishedAt)) ||
      typeof data.dataAsOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.dataAsOf) || !Number.isFinite(Date.parse(data.dataAsOf)) ||
      !Number.isInteger(data.cadenceMinutes) || data.cadenceMinutes <= 0 ||
      !Number.isInteger(data.universeCount) || !Array.isArray(data.rows) ||
      data.rows.length > 10000 || data.universeCount < data.rows.length) {
    throw new Error('Bản công bố chưa đúng định dạng.');
  }
  const symbols = new Set();
  for (const row of data.rows) {
    if (!row || !/^[A-Z0-9]{3,5}$/.test(row.symbol) || symbols.has(row.symbol) ||
        typeof row.name !== 'string' || typeof row.exchange !== 'string' ||
        (row.score != null && (!Number.isFinite(row.score) || row.score < 0 || row.score > 100)) ||
        (row.passed != null && typeof row.passed !== 'boolean') ||
        (row.holdingSessions != null && (!Number.isInteger(row.holdingSessions) || row.holdingSessions < 0)) ||
        ['sector','recommendation','explanation','rating','indexTrend'].some(k=>row[k]!=null && typeof row[k]!=='string')) {
      throw new Error('Kết quả quét chưa đúng định dạng.');
    }
    for(const field of fields){
      const value=row[field.key];
      if(value==null)continue;
      if(['pct','price','number','billions'].includes(field.format)){
        if(!Number.isFinite(value)||(field.format==='price'&&value<=0))throw new Error('Đơn vị hoặc giá trị chỉ số không hợp lệ.');
      }else if(field.key==='gate_pass'){
        if(typeof value!=='boolean')throw new Error('Gate không hợp lệ.');
      }else if(typeof value!=='string'&&!( ['gate_reasons','data_quality_flags'].includes(field.key)&&Array.isArray(value)&&value.every(v=>typeof v==='string'))){
        throw new Error('Nhãn hoặc lý do đánh giá không hợp lệ.');
      }
    }
    symbols.add(row.symbol);
  }
  if(data.highlights){
    const a=data.highlights.opportunities,b=data.highlights.cautions;
    if(!Array.isArray(a)||!Array.isArray(b)||a.length>5||b.length>5||new Set([...a,...b]).size!==a.length+b.length||[...a,...b].some(s=>!symbols.has(s)))throw new Error('Bản highlights không hợp lệ.');
  }
  return {...data, isStale: Date.now()-Date.parse(data.publishedAt) > data.cadenceMinutes*60000};
}

export function actionKind(row){
 const text=searchKey(row.action||row.recommendation||'').toUpperCase().trim();
 return ['AVOID','TRANH','BAN','SELL'].includes(text)?'AVOID':['BUY_NOW','MUA NGAY','MUA'].includes(text)?'BUY_NOW':['BUY_SETUP','BUY','CANH MUA'].includes(text)?'BUY_SETUP':text.includes('WATCH')||text.includes('THEO DOI')?'WATCH':'UNKNOWN';
}
export function selectHighlights(snapshot){
 const rows=snapshot?.rows||[];
 if(snapshot?.highlights){const map=new Map(rows.map(r=>[r.symbol,r]));return {opportunities:snapshot.highlights.opportunities.map(s=>map.get(s)),cautions:snapshot.highlights.cautions.map(s=>map.get(s)),eligibleCount:snapshot.eligibleCount,excludedCount:snapshot.excludedCount,buyNowCount:snapshot.buyNowCount};}
 const eligible=rows.filter(r=>Number.isFinite(r.score)&&!['FAIL','FAILED','ERROR'].includes(String(r.data_quality_status||'').toUpperCase())&&!['failed','error'].includes(String(r.analysis_status||'').toLowerCase()));
 const priority={BUY_NOW:0,BUY_SETUP:1,WATCH:2,UNKNOWN:3};
 const rank=r=>['BUY_NOW','BUY_SETUP'].includes(actionKind(r))&&(r.gate_pass??r.passed)!==true?3:priority[actionKind(r)];
 const opportunities=eligible.filter(r=>actionKind(r)!=='AVOID').sort((a,b)=>(rank(a)-rank(b))||b.score-a.score||a.symbol.localeCompare(b.symbol)).slice(0,5);
 const picked=new Set(opportunities.map(r=>r.symbol));
 const cautions=eligible.filter(r=>!picked.has(r.symbol)).sort((a,b)=>(actionKind(a)==='AVOID'?0:1)-(actionKind(b)==='AVOID'?0:1)||a.score-b.score||a.symbol.localeCompare(b.symbol)).slice(0,5);
 return {opportunities,cautions,eligibleCount:eligible.length,excludedCount:rows.length-eligible.length,buyNowCount:eligible.filter(r=>actionKind(r)==='BUY_NOW'&&(r.gate_pass??r.passed)===true).length};
}
export function scanValue(row,key){
 const aliases={action:'recommendation',gate_pass:'passed',gate_reasons:'explanation',holding_sessions:'holdingSessions',index_trend:'indexTrend'};
 return row[key]??row[aliases[key]]??null;
}
export function formatScanValue(row,field){
 const value=scanValue(row,field.key);
 if(value==null||value==='')return '—';
 if(field.key==='action'&&['BUY_NOW','BUY_SETUP'].includes(actionKind(row))&&scanValue(row,'gate_pass')!==true)return `${value} · gate chưa xác nhận`;
 if(typeof value==='boolean')return value?'✓ Đã đạt':'Chưa đạt';
 if(Array.isArray(value))return value.join(' · ')||'—';
 if(typeof value!=='number')return String(value);
 const n=field.format==='price'?value/1000:field.format==='billions'?value/1e9:value;
 return n.toLocaleString('vi-VN',{maximumFractionDigits:2})+(field.format==='pct'?'%':'');
}

export const demoScan = () => normalizeScan(demo);

const holdingSessions = value => {
  const match = /(\d+)\s*phiên/i.exec(String(value ?? ''));
  return match ? parseInt(match[1], 10) : null;
};

const validScore = value => {
  if(value==null||value===''||typeof value==='boolean')return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
};

/**
 * Map bản quét backend (/api/v1/scans/latest + results) về envelope mà
 * normalizeScan/ScanPage đang dùng. Mã chưa phân tích xong giữ hàng với
 * score null để bộ lọc "Chưa có kết quả" vẫn thấy.
 */
export function mapBackendScan(meta, items) {
  const rows = [];
  const seen = new Set();
  for (const item of items || []) {
    const symbol = String(item.symbol || '').toUpperCase();
    if (!/^[A-Z0-9]{3,5}$/.test(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    const completed = item.analysis_status === 'completed';
    rows.push({
      ...item,
      symbol,
      name: item.name || symbol,
      exchange: item.exchange || '—',
      score: completed ? validScore(item.score) : null,
      passed: completed ? (typeof item.gate_pass==='boolean'?item.gate_pass:null) : null,
      holdingSessions: completed ? holdingSessions(item.hold_plan) : null,
      recommendation: completed ? (item.recommendation || null) : null,
      explanation: item.gate_explanation || null,
      rating: completed ? (item.rating || null) : null,
      indexTrend: item.vni_trend || null,
      sector: item.sector || null,
    });
  }
  return {
    mode: 'published',
    runId: meta.id,
    source: meta.source_version || 'quantik-backend',
    session: meta.slot || 'MANUAL',
    publishedAt: meta.published_at,
    dataAsOf: String(meta.data_as_of || '').slice(0, 10),
    cadenceMinutes: 720,
    universeCount: meta.universe_count || rows.length,
    rows,
  };
}
const searchKey = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
export function filterScan(rows, {query='',exchange='ALL',recommendation='ALL',passed='ALL',direction='desc'} = {}) {
  const key = searchKey(query.trim());
  return rows.filter(r => (!key || searchKey(`${r.symbol} ${r.name}`).includes(key)) &&
    (exchange==='ALL' || r.exchange===exchange) &&
    (recommendation==='ALL' || r.recommendation===recommendation) &&
    (passed==='ALL' || (passed==='unknown' ? r.passed==null : r.passed===(passed==='yes'))))
    .sort((a,b) => a.score==null ? (b.score==null ? a.symbol.localeCompare(b.symbol) : 1) :
      b.score==null ? -1 : (direction==='desc' ? b.score-a.score : a.score-b.score) || a.symbol.localeCompare(b.symbol));
}
