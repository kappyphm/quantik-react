import MotionDetails from './MotionDetails.jsx';
import {useId} from 'react';
import {displayResult,moduleStatusLabels} from '../quant-modules.js';
import AnnotatedText from './AnnotatedText.jsx';
import {readerModules,actionParagraph} from '../quant-reader.js';

export default function QuantModules({modules,expanded=false,analysis}) {
 const uid=useId();
 if(!modules?.length)return null;
 const visible=readerModules(modules);
 return <section className="quant-modules" aria-label="Phân tích từng module">
  <div className="report-heading"><h3>Hiểu từng mô hình và kết quả</h3><p>Từ dữ liệu đầu vào đến ý nghĩa kết quả, nguyên nhân và vai trò trong khuyến nghị tổng hợp.</p></div>
  {expanded&&<nav className="quant-module-nav" aria-label="Điều hướng module">{visible.map(m=><a key={m.id} href={`#${uid}-${m.id}`}>{m.title}</a>)}</nav>}
  <div className="quant-module-list">{visible.map(m=>m.id==='action'?<section className="quant-module card quant-action" key={m.id} id={`${uid}-${m.id}`} aria-label="Hành động"><h3>HÀNH ĐỘNG</h3><p><AnnotatedText text={actionParagraph(modules,analysis)}/></p></section>:<MotionDetails className="quant-module card" key={m.id} id={`${uid}-${m.id}`} open={expanded||undefined}>
   <span className="motion-module-summary"><b>{m.title}</b><span className={`module-status status-${m.status}`}>{moduleStatusLabels[m.status]||'Chưa xác nhận'}</span></span>
   <div className="module-body">
    <div className="module-guide"><h4>1. Đây là gì, dùng để hiểu điều gì?</h4><p><AnnotatedText text={m.definition||'Chưa có phần giải thích được xác nhận cho báo cáo này.'}/></p></div>
    <div className="module-guide"><h4>2. Đầu vào và điều kiện để sử dụng</h4><p><AnnotatedText text={m.conditions||m.inputs||'Chưa có điều kiện đầu vào được xác nhận.'}/></p></div>
    <div className="module-explanation"><h4>3. Kết quả đang nói điều gì?</h4><p><AnnotatedText text={m.reading||'Báo cáo cũ chưa có diễn giải kết quả; hãy chạy lại phân tích để xem nội dung đầy đủ.'}/></p>
     {!!m.metrics?.length&&<dl className="module-reader-metrics">{m.metrics.map((p,i)=><div key={i}><dt>{p.label}</dt><dd>{displayResult(p.value)} {p.unit}</dd></div>)}</dl>}
    </div>
    <div className="module-guide"><h4>4. Vì sao xuất hiện kết quả này?</h4><p><AnnotatedText text={m.why||m.method||'Chưa có cơ chế được xác nhận.'}/></p></div>
    {!!m.evidence?.length&&<div className="module-evidence"><h4>Đối chiếu trực tiếp với dữ liệu</h4><dl>{m.evidence.map((p,i)=><div key={i}><dt>{p.label}</dt><dd>{displayResult(p.value)} {p.unit}</dd></div>)}</dl></div>}
    <div className="module-limit"><h4>5. Ghép với mô hình khác và dùng trong quyết định</h4><p><AnnotatedText text={m.connection||m.limitations||'Kết quả cần được đọc trong bối cảnh toàn bộ báo cáo.'}/></p></div>
   </div>
  </MotionDetails>)}</div>
 </section>;
}
