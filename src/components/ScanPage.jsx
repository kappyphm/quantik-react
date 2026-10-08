import {useEffect, useRef, useState} from 'react';
import {getScanHighlights} from '../api.js';
import ScanHighlights from './ScanHighlights.jsx';
import {demoScan, normalizeScan} from '../scan.js';

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

export default function ScanPage({onOpen,onQuant}) {
  const [snapshot,setSnapshot] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const request = useRef(null);
  const heading = useRef(null);
  useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);
  const load = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current=controller;
    const timeout = setTimeout(()=>controller.abort(),15000);
    setBusy(true);setError('');
    try {
      const result = normalizeScan(await getScanHighlights(controller.signal));
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
  return <section className="scan-page" aria-label="Quét toàn sàn" aria-busy={busy}>
    {!snapshot ? <div className="scan-gate">
      <div className="scan-gate-copy"><span className="scan-tag"><i/> PHÂN TÍCH TOÀN THỊ TRƯỜNG</span>
        <h2>Khai mở góc nhìn<br/><em>toàn sàn.</em></h2>
        <p>Mở bản công bố từ đợt phân tích gần nhất. Kích hoạt để xem 5 mã nổi bật, 5 mã cần thận trọng và các tỷ suất đánh giá.</p>
        <button className="btn scan-activate" onClick={load} disabled={busy}>{busy ? 'Đang lấy kết quả…' : 'Kích hoạt kết quả'} <span aria-hidden="true">↗</span></button>
        <small>Đọc bản công bố có sẵn · Lịch cập nhật theo pipeline</small>
      </div>
      <div className="scan-gate-art"><ScanArtwork/><span>KHÔNG CÓ NGÀY MAI,<br/>CHỈ CÓ <b>XÁC SUẤT.</b></span></div>
      <div className="scan-gate-features"><div><b>01 / TOÀN THỊ TRƯỜNG</b><span>Tổng hợp theo sàn và doanh nghiệp</span></div><div><b>02 / BẢN CÔNG BỐ</b><span>Xem thời điểm dữ liệu và phiên phân tích</span></div><div><b>03 / TỪNG CỔ PHIẾU</b><span>Mở chi tiết đánh giá cho mã bạn chọn</span></div></div>
    </div> : <ScanHighlights snapshot={snapshot} heading={heading} onOpen={onOpen} onQuant={onQuant} onRefresh={load} busy={busy}/> }
    {error && <div className="scan-error"><p role="alert">{error}</p>{!snapshot && <button className="btn ghost" disabled={busy} onClick={()=>{setSnapshot(demoScan());setError('');requestAnimationFrame(()=>heading.current?.focus());}}>Xem bản mẫu minh họa</button>}</div>}
  </section>;
}
