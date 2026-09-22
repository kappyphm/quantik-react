import { useEffect, useState } from 'react';
import MarketBoard from './MarketBoard.jsx';
import { run, stocks } from '../demo.js';

export default function Home({go,apiReady=false}){
  const [latest,setLatest]=useState(null);
  useEffect(()=>{if(apiReady)fetch('/api/v1/scans/latest').then(r=>r.ok?r.json():null).then(setLatest).catch(()=>{});},[apiReady]);
  return <div className="page home">
    <div className="home-copy"><div className="eyebrow"><span className="eyebrow-line"/> QUANTIK / VIETNAM EQUITIES</div>
      <h1>Nhìn toàn sàn.<br/><em>Hiểu từng mã.</em></h1>
      <p className="hero-desc">Một điểm đến cho kết quả sàng lọc và phân tích định lượng cổ phiếu Việt Nam. Theo dõi bối cảnh thị trường, mở bản quét mới nhất và đi sâu vào từng mã.</p>
      <button className="primary big-cta" onClick={()=>go('/scan')}>QUÉT TOÀN SÀN <span>↗</span></button>
      <div className="home-meta"><span>ĐỢT CÔNG BỐ GẦN NHẤT</span><strong>{apiReady?latest?.published_at?.slice(0,16).replace('T',' ')||'Chưa có':run.published}</strong><span className="meta-sep"/><span>{apiReady?latest?.universe_count??'—':stocks.length} MÃ {apiReady?'TRONG BẢN QUÉT':'TRONG BẢN DEMO'}</span></div>
    </div>
    <MarketBoard apiReady={apiReady}/>
    <div className="home-steps"><div><span>01 /</span><b>Quét toàn sàn</b><p>Sàng lọc, tổng hợp tín hiệu và điểm đánh giá.</p></div><div><span>02 /</span><b>Đọc chi tiết</b><p>Điều kiện, xu hướng và bối cảnh từng mã.</p></div><div><span>03 /</span><b>Phân tích QUANT</b><p>Tạo báo cáo chuyên sâu và theo dõi tiến độ.</p></div></div>
  </div>;
}
