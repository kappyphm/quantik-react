import {useId} from 'react';
import {displayResult,flattenResult,moduleStatusLabels} from '../quant-modules.js';
import AnnotatedText from './AnnotatedText.jsx';

export default function QuantModules({modules,expanded=false}) {
  const uid=useId();
  if(!modules?.length)return null;
  return <section className="quant-modules" aria-label="Phân tích từng module">
    <div className="report-heading"><h3>Từng model · Nguồn gốc và ý nghĩa</h3><p>Mở module để xem đầu vào, cách tính, bằng chứng và giới hạn của nhận định.</p></div>
    {expanded&&<nav className="quant-module-nav" aria-label="Điều hướng module">{modules.map(m=><a key={m.id} href={`#${uid}-${m.id}`}>{m.title}</a>)}</nav>}
    <div className="quant-module-list">{modules.map(m=>{
      const rows=flattenResult(m.result||{});
      return <details className="quant-module card" key={m.id} id={`${uid}-${m.id}`} open={expanded||undefined}>
        <summary><b>{m.title}</b><span className={`module-status status-${m.status}`}>{moduleStatusLabels[m.status]||'Chưa xác nhận'}</span></summary>
        <div className="module-body"><p className="module-input"><b>Đầu vào:</b> {m.inputs}</p>
          <div className="module-explanation"><h4>Vì sao có kết quả này?</h4><p><AnnotatedText text={m.explanation}/></p></div>
          <div className="module-method"><h4>Cách tính / phương pháp</h4><p>{m.method}</p></div>
          {!!m.evidence?.length&&<div className="module-evidence"><h4>Bằng chứng từ dữ liệu</h4><dl>{m.evidence.map((p,i)=><div key={i}><dt>{p.label}</dt><dd>{displayResult(p.value)} {p.unit}</dd></div>)}</dl></div>}
          <p className="module-limit"><b>Điều kiện diễn giải:</b> {m.limitations}</p>
          <details className="module-values"><summary>Kết quả và chẩn đoán chi tiết ({rows.length})</summary>{rows.length?<div className="boardwrap"><table><thead><tr><th>Trường kết quả</th><th>Giá trị</th></tr></thead><tbody>{rows.slice(0,80).map((row,i)=><tr key={i}><td>{row.key}</td><td>{displayResult(row.value)}</td></tr>)}</tbody></table></div>:<p>Module chưa trả kết quả.</p>}
            {rows.length>80&&<p>Hiển thị 80 trường đầu; xem toàn bộ kết quả bên dưới.</p>}
            <details><summary>Xem toàn bộ kết quả gốc của module</summary><pre>{JSON.stringify(m.result||{},null,2)}</pre></details>
          </details>
        </div>
      </details>;
    })}</div>
  </section>;
}
