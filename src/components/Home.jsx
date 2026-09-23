import { useEffect, useState } from 'react';
import MarketBoard from './MarketBoard.jsx';

const stamp = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có';

export default function Home({go,apiReady=false}){
  const [latest,setLatest]=useState(null);
  const [scanStatus,setScanStatus]=useState(null);
  useEffect(()=>{if(!apiReady)return;let active=true;const refresh=()=>{fetch('/api/v1/scans/latest').then(r=>r.ok?r.json():null).then(data=>{if(active)setLatest(data);}).catch(()=>{});fetch('/api/v1/scans/status').then(r=>r.json()).then(data=>{if(active)setScanStatus(data);}).catch(()=>{});};refresh();const timer=setInterval(refresh,15000);return()=>{active=false;clearInterval(timer);};},[apiReady]);
  return <div className="page home">
    <div className="home-copy"><div className="eyebrow"><span className="eyebrow-line"/> QUANTIK / VIETNAM EQUITIES</div>
      <h1>Nhìn toàn sàn.<br/><em>Hiểu từng mã.</em></h1>
      <p className="hero-desc">Một điểm đến cho kết quả sàng lọc và phân tích định lượng cổ phiếu Việt Nam. Theo dõi bối cảnh thị trường, mở bản quét mới nhất và đi sâu vào từng mã.</p>
      <button className="primary big-cta" onClick={()=>go('/scan')}>XEM BẢN QUÉT TOÀN SÀN <span>↗</span></button>
      <div className="home-meta"><span>ĐỢT CÔNG BỐ GẦN NHẤT</span><strong>{stamp(latest?.published_at)}</strong><span className="meta-sep"/><span>{latest?.universe_count??scanStatus?.universe_count??'—'} MÃ {latest?'TRONG BẢN QUÉT':'TRONG UNIVERSE ĐANG QUÉT'}</span>{scanStatus?.status==='running'&&<span> · ĐANG QUÉT THẬT {scanStatus.progress_pct}%</span>}{scanStatus?.status==='failed'&&<span> · QUÉT LỖI</span>}</div>
    </div>
    <MarketBoard apiReady={apiReady}/>
    <div className="home-steps"><div><span>01 /</span><b>Quét toàn sàn</b><p>Sàng lọc, tổng hợp tín hiệu và điểm đánh giá.</p></div><div><span>02 /</span><b>Đọc chi tiết</b><p>Điều kiện, xu hướng và bối cảnh từng mã.</p></div><div><span>03 /</span><b>Phân tích QUANT</b><p>Tạo báo cáo chuyên sâu và theo dõi tiến độ.</p></div></div>
  </div>;
}
