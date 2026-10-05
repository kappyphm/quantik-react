import {useEffect, useMemo, useRef, useState} from 'react';
import {getLatestScan} from '../api.js';
import {demoScan, filterScan, normalizeScan} from '../scan.js';
import AnnotatedText from './AnnotatedText.jsx';

const initialFilters = {query:'',exchange:'ALL',recommendation:'ALL',passed:'ALL',direction:'desc'};
const display = value => value == null || value === '' ? '—' : value;
const dateTime = value => new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false});

function ScanArtwork() {
  return <svg className="scan-artwork" viewBox="0 0 540 320" fill="none" aria-hidden="true">
    <defs><linearGradient id="scan-beam" x1="0" y1="320" x2="540" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#ff6a1a" stopOpacity="0"/><stop offset=".5" stopColor="#ff6a1a"/><stop offset="1" stopColor="#ff6a1a" stopOpacity="0"/></linearGradient></defs>
    <path d="M40 230 290 88 500 210 250 352Z" fill="#0f3528" fillOpacity=".42" stroke="#2d7758"/>
    <path d="M40 190 290 48 500 170 250 312Z" stroke="#2d7758" strokeOpacity=".45"/>
    <path d="M10 253 294 87 539 227" stroke="url(#scan-beam)" strokeWidth="3"/>
    {[70,118,166,214,262,310,358,406].map((x,i)=><g key={x} transform={`translate(${x} ${190-i*13})`} stroke={i===3||i===6?'#ff762b':'#45d89c'}><path d="M0-30V38"/><rect x="-6" y={i%2?-9:-17} width="12" height={i%2?30:23} fill="currentColor" className={i===3||i===6?'amber':'up'}/></g>)}
    <circle cx="292" cy="122" r="55" stroke="#7be8b7" strokeOpacity=".6"/><path d="m330 163 45 44" stroke="#ff762b" strokeWidth="8"/>
    <path d="M292 43V60M292 184V201M213 122H230M354 122H371" stroke="#7be8b7"/>
  </svg>;
}

export default function ScanPage({onOpen}) {
  const [snapshot,setSnapshot] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [filters,setFilters] = useState(initialFilters);
  const request = useRef(null);
  const heading = useRef(null);
  useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
  const load = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current=controller;
    const timeout = setTimeout(()=>controller.abort(),15000);
    setBusy(true);setError('');
    try {
      const result = normalizeScan(await getLatestScan(controller.signal));
      if (request.current!==controller) return;
      setSnapshot(result);
      // The result heading receives focus when the activation card disappears.
      requestAnimationFrame(()=>heading.current?.focus());
    } catch {
      if (request.current===controller) setError(snapshot ? 'Chưa tải được bản mới. Kết quả đang xem vẫn được giữ lại.' : 'Chưa lấy được kết quả đã công bố. Bạn có thể thử lại hoặc xem bản mẫu.');
    } finally {
      clearTimeout(timeout);
      if (request.current===controller) {request.current=null;setBusy(false);}
    }
  };
  const filtered = useMemo(()=>filterScan(snapshot?.rows||[],filters),[snapshot,filters]);
  const change = (key,value) => setFilters(previous=>({...previous,[key]:value}));
  const exchanges = [...new Set(snapshot?.rows.map(r=>r.exchange)||[])];
  const recommendations = [...new Set(snapshot?.rows.map(r=>r.recommendation).filter(Boolean)||[])];
  return <section className="scan-page" aria-label="Quét toàn sàn" aria-busy={busy}>
    {!snapshot ? <div className="scan-gate">
      <div className="scan-gate-copy"><span className="scan-tag"><i/> PHÂN TÍCH TOÀN THỊ TRƯỜNG</span>
        <h2>Khai mở góc nhìn<br/><em>toàn sàn.</em></h2>
        <p>Mở bản công bố từ đợt phân tích gần nhất. Kích hoạt để xem danh sách cổ phiếu, bộ lọc và đánh giá theo từng mã.</p>
        <button className="btn scan-activate" onClick={load} disabled={busy}>{busy ? 'Đang lấy kết quả…' : 'Kích hoạt kết quả'} <span aria-hidden="true">↗</span></button>
        <small>Đọc bản công bố có sẵn · Chu kỳ dự kiến 2 giờ</small>
      </div>
      <div className="scan-gate-art"><ScanArtwork/><span>KHÔNG CÓ NGÀY MAI,<br/>CHỈ CÓ <b>XÁC SUẤT.</b></span></div>
      <div className="scan-gate-features"><div><b>01 / TOÀN THỊ TRƯỜNG</b><span>Tổng hợp theo sàn và doanh nghiệp</span></div><div><b>02 / BẢN CÔNG BỐ</b><span>Xem thời điểm dữ liệu và phiên phân tích</span></div><div><b>03 / TỪNG CỔ PHIẾU</b><span>Mở chi tiết đánh giá cho mã bạn chọn</span></div></div>
    </div> : <div id="scan-results">
      <div className="scan-result-heading"><div><span className="eyebrow">PHÂN TÍCH TOÀN SÀN / BẢN CÔNG BỐ</span><h2 ref={heading} tabIndex={-1}>Kết quả quét <em>toàn sàn</em></h2><p>Dữ liệu từ đợt phân tích đã công bố. Chọn một mã để xem chi tiết đánh giá.</p></div><button className="btn ghost" onClick={load} disabled={busy}>{busy?'Đang lấy bản mới…':'Lấy bản công bố mới'} ↻</button></div>
      <div className="scan-metadata"><div><small>TRẠNG THÁI</small><b className="up">{snapshot.mode==='demo'?'Bản mẫu minh họa':'Đã công bố'}</b></div><div><small>PHIÊN PHÂN TÍCH</small><b>{snapshot.session || '—'}</b></div><div><small>DỮ LIỆU ĐẾN</small><b>{snapshot.dataAsOf}</b></div><div><small>SỐ MÃ TRONG BẢN CÔNG BỐ</small><b>{snapshot.rows.length.toLocaleString('vi-VN')} <span>/ {snapshot.universeCount.toLocaleString('vi-VN')}</span></b></div></div>
      <div className="scan-provenance"><span>RUN ID <b>{snapshot.runId}</b></span><span>Công bố: {dateTime(snapshot.publishedAt)} ICT</span><span>Chu kỳ: {snapshot.cadenceMinutes} phút</span><span>Nguồn: {snapshot.source}</span></div>
      {snapshot.mode==='demo' ? <p className="info-banner">Dữ liệu mẫu · {snapshot.rows.length} mã minh họa, không đại diện toàn thị trường. Điểm lấy từ fixture; chưa có khuyến nghị từ pipeline thật.</p> : snapshot.isStale && <p className="info-banner" role="status">Bản công bố đã quá chu kỳ cập nhật. Thời điểm dữ liệu được giữ nguyên; bạn vẫn có thể xem kết quả này.</p>}
      <div className="scan-layout"><aside className="scan-filters" aria-label="Bộ lọc quét toàn sàn"><div className="scan-filter-title"><b>BỘ LỌC</b><button onClick={()=>setFilters(initialFilters)}>Đặt lại ↺</button></div>
        <label>TÌM MÃ / DOANH NGHIỆP<input type="search" value={filters.query} onChange={e=>change('query',e.target.value)} placeholder="Ví dụ: FPT, Hòa Phát…"/></label>
        <label>SÀN GIAO DỊCH<select aria-label="SÀN GIAO DỊCH" value={filters.exchange} onChange={e=>change('exchange',e.target.value)}><option value="ALL">Tất cả</option>{exchanges.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>KHUYẾN NGHỊ<select aria-label="KHUYẾN NGHỊ" value={filters.recommendation} onChange={e=>change('recommendation',e.target.value)}><option value="ALL">Tất cả</option>{recommendations.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>ĐẠT BỘ LỌC<select aria-label="ĐẠT BỘ LỌC" value={filters.passed} onChange={e=>change('passed',e.target.value)}><option value="ALL">Tất cả</option><option value="yes">Đã đạt</option><option value="no">Chưa đạt</option><option value="unknown">Chưa có kết quả</option></select></label>
        <p>Kết quả theo bản công bố đang xem. Các trường chưa có dữ liệu hiển thị “—”.</p>
      </aside><div className="market-panel scan-table-panel"><div className="window-title"><div><span className="eyebrow">DANH SÁCH ĐÁNH GIÁ</span><h3 aria-live="polite">{filtered.length.toLocaleString('vi-VN')} mã phù hợp</h3></div><span className="scan-tag">{snapshot.mode==='demo'?'SNAPSHOT MẪU':'SNAPSHOT ĐÃ CÔNG BỐ'}</span></div>
        <div className="boardwrap scan-table-wrap" tabIndex={0} role="region" aria-label="Bảng kết quả quét, cuộn ngang để xem thêm"><table className="scan-table"><thead><tr><th scope="col">Mã</th><th scope="col">Khuyến nghị</th><th scope="col">Đạt bộ lọc</th><th scope="col">Giải thích điều kiện</th><th scope="col" aria-sort={filters.direction==='desc'?'descending':'ascending'}><button className="sort-button" onClick={()=>change('direction',filters.direction==='desc'?'asc':'desc')}>Điểm {filters.direction==='desc'?'↓':'↑'}</button></th><th scope="col">Đánh giá</th><th scope="col">Thời gian nắm giữ</th><th scope="col">Xu hướng VN-Index</th><th scope="col">Nhóm ngành</th></tr></thead><tbody>{filtered.map(row=><tr key={row.symbol}><td><button className="symbol-link" aria-label={`Xem đánh giá ${row.symbol}`} onClick={()=>onOpen(row.symbol)}>{row.symbol}</button><small title={row.name}>{row.exchange} · {row.name}</small></td><td>{display(row.recommendation)}</td><td className={row.passed===true?'up':'dim'}>{row.passed==null?'—':row.passed?'✓ Đã đạt':'— Chưa đạt'}</td><td className="scan-explanation"><AnnotatedText text={display(row.explanation)}/></td><td><b className="up">{display(row.score)}</b>{row.score!=null && <span className="scan-score-bar" aria-hidden="true"><i style={{width:`${row.score}%`}}/></span>}</td><td>{display(row.rating)}</td><td>{row.holdingSessions==null?'—':`${row.holdingSessions} phiên`}</td><td>{display(row.indexTrend)}</td><td>{display(row.sector)}</td></tr>)}</tbody></table>{!filtered.length&&<div className="empty">{snapshot.rows.length?'Không có mã phù hợp với bộ lọc.':'Bản công bố này chưa có kết quả.'}</div>}</div>
        <div className="table-footer"><span>{filtered.length} / {snapshot.rows.length} mã</span><span>Chọn mã để xem chi tiết ↗</span></div>
      </div></div>
    </div>}
    {error && <div className="scan-error"><p role="alert">{error}</p>{!snapshot && <button className="btn ghost" disabled={busy} onClick={()=>{setSnapshot(demoScan());setError('');requestAnimationFrame(()=>heading.current?.focus());}}>Xem bản mẫu minh họa</button>}</div>}
  </section>;
}
