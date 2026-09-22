import { useEffect, useState } from 'react';
import { run, stocks } from '../demo.js';
import { progress } from '../mockJobs.js';
import { tone } from './Scan.jsx';
import PriceChart from './PriceChart.jsx';

export default function Detail({symbol,go,startJob,jobs,now,apiReady=false}){
  const [remote,setRemote]=useState(null);
  const [ohlcv,setOhlcv]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!apiReady)return;
    const controller=new AbortController();
    setRemote(null);setOhlcv(null);setError('');
    Promise.all([
      fetch(`/api/v1/scans/latest/results/${symbol}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Không tìm thấy mã trong bản quét');return r.json();}),
      fetch(`/api/v1/scans/latest/results/${symbol}/ohlcv`,{signal:controller.signal}).then(r=>r.ok?r.json():null),
    ]).then(([detail,prices])=>{setRemote(detail);setOhlcv(prices);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[apiReady,symbol]);
  const s=apiReady?remote&&({...remote,gatePass:remote.gate_pass,gateExplanation:remote.gate_explanation,holdPlan:remote.hold_plan,vniTrend:remote.vni_trend,sectorTrend:remote.sector_trend}):stocks.find(x=>x.symbol===symbol);
  if(apiReady&&!s&&!error)return <div className="page not-found"><h1>Đang tải dữ liệu {symbol}…</h1></div>;
  if(!s)return <div className="page not-found"><h1>{error||`Không tìm thấy mã ${symbol}`}</h1><button className="primary" onClick={()=>go('/scan')}>VỀ KẾT QUẢ QUÉT ↗</button></div>;
  const previous=jobs.filter(j=>j.symbol===symbol);
  const checks=apiReady?Object.entries(s.screener?.strong?.criteria||{}).slice(0,4).map(([label,passed])=>[label,!!passed]):[['Xu hướng giá',s.score>=65],['Động lượng',s.score>=70],['Thanh khoản',!['SHS','VHM'].includes(symbol)],['Rủi ro',!['VIC','GAS','VHM'].includes(symbol)]];
  return <div className="page detail-page"><button className="back-link" onClick={()=>go('/scan')}>← Trở lại kết quả toàn sàn</button><div className="detail-head"><div><div className="eyebrow">{s.exchange} / {s.sector} / {apiReady?s.run_id:run.id}</div><h1><span>{s.symbol}</span> <small>{s.name}</small></h1><p>Kết quả đánh giá từ đợt {apiReady?s.run_id?'đã công bố':'—':run.slot.toLowerCase()} · dữ liệu đến {apiReady?s.data_as_of:run.asOf}</p></div><button className="primary" onClick={()=>startJob(symbol)}>CHẠY PHÂN TÍCH QUANT <span>↗</span></button></div>
    <div className="detail-summary"><div><span>KHUYẾN NGHỊ</span><strong className={tone(s.recommendation)}>{s.recommendation}</strong></div><div><span>ĐIỂM ĐÁNH GIÁ</span><strong>{s.score}<small> / 100</small></strong></div><div><span>BỘ LỌC</span><strong className={s.gatePass?'positive':'muted'}>{s.gatePass?'✓ Đạt':'— Chưa đạt'}</strong></div><div><span>THỜI GIAN NẮM GIỮ</span><strong>{s.holdPlan}</strong></div></div>
    <div className="detail-grid"><section className="analysis-panel"><div className="section-title"><span>01 / BIỂU ĐỒ GIÁ & KHỐI LƯỢNG</span><small>Lightweight Charts · {apiReady?(s.run_id?.startsWith('DEMO')?'dữ liệu mẫu':'snapshot đã công bố'):'dữ liệu mẫu'}</small></div><div className="stock-chart">{(!apiReady||ohlcv?.bars?.length)?<PriceChart symbol={symbol} score={s.score} ohlcvBars={ohlcv?.bars} sourceLabel={apiReady&&!s.run_id?.startsWith('DEMO')?'SNAPSHOT ĐÃ CÔNG BỐ':'DỮ LIỆU MẪU'}/>:<div className='market-api-empty'>Chưa có OHLCV cho mã này.</div>}</div></section><div className="detail-side"><section className="analysis-panel"><div className="section-title"><span>02 / LUẬN ĐIỂM</span></div><p className="reason">{s.gateExplanation}.</p><div className="text-grid"><span>Đánh giá</span><strong>{s.rating}</strong><span>Xu hướng VN-Index</span><strong className={tone(s.vniTrend)}>{s.vniTrend}</strong><span>Xu hướng ngành</span><strong className={tone(s.sectorTrend)}>{s.sectorTrend}</strong><span>Nhóm ngành</span><strong>{s.sector}</strong></div></section><section className="analysis-panel"><div className="section-title"><span>03 / ĐIỀU KIỆN SÀNG LỌC</span><small>{apiReady ? s.run_id?.startsWith('DEMO') ? 'Snapshot mẫu' : 'Snapshot đã công bố' : 'Bản demo'}</small></div><div className="check-list">{!checks.length&&<div className='empty-history'>Chưa có chi tiết điều kiện sàng lọc.</div>}{checks.map(([label,passed])=><div key={label}><span>{label}</span><strong className={passed?'positive':'negative'}>{passed?'✓ Đạt ngưỡng':'× Chưa đạt'}</strong></div>)}</div></section><section className="analysis-panel quant-cta"><div className="eyebrow">PHÂN TÍCH CHUYÊN SÂU</div><h2>Cần nhiều hơn một tín hiệu?</h2><p>Chạy mô hình QUANT, kiểm định lịch sử và tạo biểu đồ báo cáo cho {symbol}.</p><button className="primary" onClick={()=>startJob(symbol)}>CHẠY PHÂN TÍCH QUANT ↗</button></section></div></div>
    <section className="history-section"><div className="section-title"><span>04 / LỊCH SỬ BÁO CÁO QUANT</span><button onClick={()=>go('/quant/reports')}>Xem tất cả ↗</button></div>{previous.length?<div className="history-list">{previous.map(j=>{const p=apiReady?{status:j.status,label:j.status==='failed'?'Thất bại':j.status==='queued'?'Đang chờ xử lý':'Đang xử lý'}:progress(j,now);return <button key={j.id} onClick={()=>go(`/quant/jobs/${j.id}`)}><span className="symbol">{symbol}</span><span>{new Date(j.createdAt).toLocaleString('vi-VN')}</span><span className={p.status==='succeeded'?'positive':'amber'}>{p.status==='succeeded'?'Đã hoàn tất':p.label}</span><span>↗</span></button>;})}</div>:<p className="empty-history">{apiReady?'Chưa có báo cáo QUANT nào cho mã này.':'Chưa có báo cáo QUANT nào cho mã này trong bản demo.'}</p>}</section>
  </div>;
}


