import { useEffect, useMemo, useRef, useState } from 'react';
import { run, stocks } from '../demo.js';
import Pagination from './Pagination.jsx';

const columns=[['symbol','Mã'],['recommendation','Khuyến nghị'],['gatePass','Đạt bộ lọc'],['gateExplanation','Giải thích điều kiện'],['score','Điểm'],['rating','Đánh giá'],['holdPlan','Thời gian nắm giữ'],['vniTrend','Xu hướng VN-Index'],['sector','Nhóm ngành'],['sectorTrend','Xu hướng ngành']];
export const tone = x => /^(MUA|Tăng|🟢)/i.test(x || '') ? 'positive' : /^(TRÁNH|THẬN TRỌNG|Giảm|🔴)/i.test(x || '') ? 'negative' : 'neutral';
export default function Scan({go,apiReady=false}){
  const initial=new URLSearchParams(window.location.search);
  const [query,setQuery]=useState(initial.get('q')||'');
  const [rec,setRec]=useState(initial.get('rec')||'Tất cả');
  const [gate,setGate]=useState(initial.get('gate')||'Tất cả');
  const [exchange,setExchange]=useState(initial.get('exchange')||'Tất cả');
  const [sector,setSector]=useState(initial.get('sector')||'Tất cả');
  const [min,setMin]=useState(Number(initial.get('min')||0));
  const [sort,setSort]=useState(columns.some(([key])=>key===initial.get('sort'))?initial.get('sort'):'score'); const [asc,setAsc]=useState(initial.get('order')==='asc');
  const [page,setPage]=useState(Math.max(1,Number(initial.get('page'))||1));
  const [pageSize,setPageSize]=useState([5,10,20].includes(Number(initial.get('page_size')))?Number(initial.get('page_size')):10);
  const [remote,setRemote]=useState(null);
  const [activeRun,setActiveRun]=useState(null);
  const [facets,setFacets]=useState(null);
  const [apiError,setApiError]=useState('');
  const mounted=useRef(false);
  useEffect(()=>{if(mounted.current)setPage(1);else mounted.current=true;},[query,rec,gate,exchange,sector,min,sort,asc]);
  useEffect(()=>{const p=new URLSearchParams();if(query)p.set('q',query);if(rec!=='Tất cả')p.set('rec',rec);if(gate!=='Tất cả')p.set('gate',gate);if(exchange!=='Tất cả')p.set('exchange',exchange);if(sector!=='Tất cả')p.set('sector',sector);if(min)p.set('min',min);if(sort!=='score')p.set('sort',sort);if(asc)p.set('order','asc');if(page>1)p.set('page',page);if(pageSize!==10)p.set('page_size',pageSize);window.history.replaceState({},'',`/scan${p.size?`?${p}`:''}`);},[query,rec,gate,exchange,sector,min,sort,asc,page,pageSize]);
  const localResults=useMemo(()=>stocks.filter(s=>`${s.symbol} ${s.name}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))&&(rec==='Tất cả'||s.recommendation===rec)&&(gate==='Tất cả'||s.gatePass===(gate==='Đạt'))&&(exchange==='Tất cả'||s.exchange===exchange)&&(sector==='Tất cả'||s.sector===sector)&&s.score>=min).sort((a,b)=>{const x=a[sort],y=b[sort];return (typeof x==='number'||typeof x==='boolean'?Number(x)-Number(y):String(x).localeCompare(String(y),'vi'))*(asc?1:-1);}),[query,rec,gate,exchange,sector,min,sort,asc]);
  useEffect(()=>{if(!apiReady)return;fetch('/api/v1/scans/latest').then(r=>r.ok?r.json():null).then(setActiveRun).catch(()=>{});fetch('/api/v1/scans/latest/facets').then(r=>r.ok?r.json():null).then(setFacets).catch(()=>{});},[apiReady]);
  useEffect(()=>{
    if(!apiReady)return;
    const controller=new AbortController();
    const keys={gatePass:'gate_pass',gateExplanation:'gate_explanation',holdPlan:'hold_plan',vniTrend:'vni_trend',sectorTrend:'sector_trend'};
    const p=new URLSearchParams({page:String(page),page_size:String(pageSize),sort:keys[sort]||sort,order:asc?'asc':'desc'});
    if(query)p.set('q',query);if(rec!=='Tất cả')p.set('recommendation',rec);if(gate!=='Tất cả')p.set('gate_pass',String(gate==='Đạt'));if(exchange!=='Tất cả')p.set('exchange',exchange);if(sector!=='Tất cả')p.set('sector',sector);if(min)p.set('score_min',String(min));
    fetch(`/api/v1/scans/latest/results?${p}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Chưa có bản quét được công bố');return r.json();}).then(data=>{setRemote(data);setApiError('');}).catch(e=>{if(e.name!=='AbortError'){setRemote(null);setApiError(e.message);}});
    return()=>controller.abort();
  },[apiReady,query,rec,gate,exchange,sector,min,sort,asc,page,pageSize]);
  const results=apiReady?(remote?.items||[]).map(s=>({...s,gatePass:s.gate_pass,gateExplanation:s.gate_explanation,holdPlan:s.hold_plan,vniTrend:s.vni_trend,sectorTrend:s.sector_trend})):localResults;
  const total=apiReady?remote?.total??0:localResults.length;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));
  const currentPage=Math.min(page,pageCount);
  const visible=apiReady?results:results.slice((currentPage-1)*pageSize,currentPage*pageSize);
  useEffect(()=>{if(page>pageCount)setPage(pageCount);},[page,pageCount]);
  const reset=()=>{setQuery('');setRec('Tất cả');setGate('Tất cả');setExchange('Tất cả');setSector('Tất cả');setMin(0);};
  const sortBy=key=>{if(sort===key)setAsc(!asc);else{setSort(key);setAsc(key==='symbol');}};
  return <div className="page scan-page"><div className="page-heading"><div><div className="eyebrow">PHÂN TÍCH TOÀN SÀN / BẢN CÔNG BỐ MỚI NHẤT</div><h1>Kết quả quét <span>toàn sàn</span></h1><p>Dữ liệu từ đợt phân tích đã công bố. Chọn một mã để xem chi tiết đánh giá.</p></div><div className="run-stamp"><span>RUN ID</span><strong>{apiReady?activeRun?.id||'—':run.id}</strong><small>{apiReady?activeRun?.published_at?.slice(0,16).replace('T',' ')||'—':run.published}</small></div></div>
    <div className="scan-stats"><div><span>TRẠNG THÁI</span><strong className="positive">● Đã công bố</strong></div><div><span>PHIÊN PHÂN TÍCH</span><strong>{apiReady?activeRun?.slot||'—':run.slot}</strong></div><div><span>DỮ LIỆU ĐẾN</span><strong>{apiReady?activeRun?.data_as_of||'—':run.asOf}</strong></div><div><span>SỐ MÃ HIỂN THỊ</span><strong>{total} <i>/ {apiReady?activeRun?.universe_count??0:stocks.length}</i></strong></div></div>
    <div className="scan-layout"><aside className="filter-panel"><div className="aside-title"><b>BỘ LỌC</b><button onClick={reset}>Đặt lại ↺</button></div><label className="field"><span>TÌM MÃ / DOANH NGHIỆP</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ví dụ: FPT, Hòa Phát..."/></label><label className="field"><span>SÀN GIAO DỊCH</span><select value={exchange} onChange={e=>setExchange(e.target.value)}>{['Tất cả',...(apiReady?facets?.exchange||[]:['HOSE','HNX','UPCoM'])].map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>KHUYẾN NGHỊ</span><select value={rec} onChange={e=>setRec(e.target.value)}>{['Tất cả',...(apiReady?facets?.recommendation||[]:['MUA','THEO DÕI','TRUNG LẬP','THẬN TRỌNG'])].map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>ĐẠT BỘ LỌC</span><select value={gate} onChange={e=>setGate(e.target.value)}>{['Tất cả','Đạt','Chưa đạt'].map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>NHÓM NGÀNH</span><select value={sector} onChange={e=>setSector(e.target.value)}>{['Tất cả',...(apiReady?facets?.sector||[]:[...new Set(stocks.map(s=>s.sector))])].map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>ĐIỂM TỐI THIỂU <b>{min}</b></span><input type="range" min="0" max="100" step="5" value={min} onChange={e=>setMin(Number(e.target.value))}/></label><div className="filter-note">{apiReady?'Bộ lọc và phân trang được xử lý trên API.':'Dữ liệu minh họa được lọc trong trình duyệt.'}</div></aside>
      <section className="results-panel"><div className="results-title"><div><span className="eyebrow">DANH SÁCH ĐÁNH GIÁ</span><strong>{total} mã phù hợp</strong></div><span className="demo-label">{apiReady?activeRun?.id?.startsWith('DEMO')?'SNAPSHOT MẪU':'SNAPSHOT ĐÃ CÔNG BỐ':'DỮ LIỆU MẪU'}</span></div>{apiReady&&apiError&&<div className="market-api-empty" role="alert">{apiError}</div>}<div className="table-scroll"><table className="scan-table"><thead><tr>{columns.map(([key,label])=><th key={key}><button onClick={()=>sortBy(key)}>{label} {sort===key?asc?'↑':'↓':''}</button></th>)}</tr></thead><tbody>{visible.map(s=><tr key={s.symbol} onClick={()=>go(`/stocks/${s.symbol}`)} tabIndex={0} onKeyDown={e=>e.key==='Enter'&&go(`/stocks/${s.symbol}`)}><td><b className="symbol">{s.symbol}</b><small>{s.exchange} · {s.name}</small></td><td><span className={`pill ${tone(s.recommendation)}`}>{s.recommendation}</span></td><td><span className={s.gatePass?'positive':'muted'}>{s.gatePass?'✓ Đạt':'— Chưa đạt'}</span></td><td className="explain" title={s.gateExplanation}>{s.gateExplanation}</td><td><strong className={s.score>=75?'positive':s.score<60?'negative':''}>{s.score}</strong><span className="mini-meter"><i style={{width:`${s.score}%`}}/></span></td><td>{s.rating}</td><td>{s.holdPlan}</td><td className={tone(s.vniTrend)}>{s.vniTrend}</td><td>{s.sector}</td><td className={tone(s.sectorTrend)}>{s.sectorTrend}</td></tr>)}</tbody></table>{!total&&remote&&<div className="no-results">Không có mã phù hợp. <button onClick={reset}>Xóa bộ lọc</button></div>}</div><Pagination total={total} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></section></div>
  </div>;
}


