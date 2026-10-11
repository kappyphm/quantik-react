import {useEffect,useState} from 'react';
import QuantPanel from './QuantPanel.jsx';

export default function QuantPage({sym,onAnalyze,onSidebar,onExit}) {
  const [draft,setDraft]=useState(sym);
  useEffect(()=>setDraft(sym),[sym]);
  return <section className="quant-page" aria-label="Phân tích Quant toàn màn hình">
    <div className="quant-page-toolbar"><div><span className="eyebrow">QUANT / MODEL WORKSPACE</span><h2>Phân tích chuyên sâu · {sym}</h2></div><div className="quant-actions"><button className="btn ghost" onClick={()=>onSidebar(sym)}>Xem cạnh chart</button><button className="btn ghost" onClick={onExit}>Về thị trường</button></div></div>
    <form className="quant-symbol-search" onSubmit={e=>{e.preventDefault();if(/^[A-Z0-9]{3,5}$/.test(draft))onAnalyze(draft);}}>
      <label htmlFor="quant-symbol">Mã cổ phiếu</label><input id="quant-symbol" value={draft} onChange={e=>setDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={5} placeholder="VD: FPT" required pattern="[A-Z0-9]{3,5}"/>
      <button className="btn" type="submit">Phân tích Quant</button>
    </form>
    <p className="chart-source">Lấy dữ liệu giá và khối lượng → chạy các mô hình → tạo báo cáo và biểu đồ cho mã bạn chọn.</p>
    <QuantPanel key={sym} sym={sym} expanded/>
  </section>;
}
