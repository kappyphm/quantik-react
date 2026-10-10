import {useEffect,useState} from 'react';
import {listModules} from '../api.js';
import useQuantJob,{resumeQuantAnalysis} from '../hooks/useQuantJob.js';
import ResearchVisuals from './ResearchVisuals.jsx';
import AnalysisReport from './AnalysisReport.jsx';
import AnnotatedText from './AnnotatedText.jsx';
import TermHint from './TermHint.jsx';
import {fmt} from '../market.js';
import QuantModules from './QuantModules.jsx';
export default function QuantPanel({sym,autoRun=false,expanded=false,onExpand}){
 const [mods,setMods]=useState([]),[failed,setFailed]=useState(false),[selected,setSelected]=useState([]),[imageError,setImageError]=useState(false);
 const {job,error,run,preview}=useQuantJob(sym);
 useEffect(()=>{let alive=true;listModules().then(m=>{if(alive){setMods(m);setSelected(m.map(x=>x.id));}}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[]);
 useEffect(()=>{if(autoRun)resumeQuantAnalysis(sym);},[sym,autoRun]);
 useEffect(()=>setImageError(false),[job?.id]);
 const running=job?.status==='queued'||job?.status==='running',s=job?.summary;
 return <>
 {onExpand&&<button className="btn ghost quant-expand" onClick={()=>onExpand(sym)}>Mở trang Quant toàn màn hình ↗</button>}
 {!job&&<section className="card quant-controls"><h3>Phân tích Quant {sym}</h3><p className="dim">Phân tích xu hướng, dòng tiền và rủi ro theo từng mô hình.</p>
 {failed&&<p role="status" className="err">Chưa kết nối được dịch vụ phân tích. Bạn có thể xem bản mẫu giao diện.</p>}
 <div className="mods">{mods.map(m=><div className="mod" key={m.id}><input type="checkbox" aria-label={`Chọn module ${m.name}`} disabled={running} checked={selected.includes(m.id)} onChange={e=>setSelected(a=>e.target.checked?[...a,m.id]:a.filter(id=>id!==m.id))}/><span><b><AnnotatedText text={m.name}/></b><small><AnnotatedText text={m.desc}/></small></span></div>)}</div>
 <div className="quant-actions"><button className="btn" disabled={running||!selected.length} onClick={()=>run(sym,selected)}>Chạy Quant {sym}</button><button className="btn ghost" onClick={()=>preview(sym)}>Xem kết quả mẫu</button></div></section>}
 {running&&<section className="card" role="status"><h3>Đang chạy {sym}</h3><p>{job.phaseLabel||'Đang chờ worker lấy dữ liệu và chạy pipeline.'}</p><progress max="100" value={job.progress_pct||0} aria-label="Tiến độ phân tích Quant"/><div className="mods">{(job.modules||[]).map(m=><div className={`mod ${m.state}`} key={m.id}><b><AnnotatedText text={m.name}/></b><span className="st">{m.state==='done'?'✓ Hoàn tất':m.state==='running'?'Đang chạy':'Chờ'}</span></div>)}</div></section>}
 {job?.status==='error'&&<section className="card"><p role="alert" className="err">{error}</p><div className="quant-actions"><button className="btn ghost" onClick={()=>run(sym,selected.length?selected:null)}>Thử lại</button><button className="btn ghost" onClick={()=>preview(sym)}>Xem kết quả mẫu</button></div></section>}
 {job?.status==='done'&&<>
 <div className="ctl"><span className="dim">Hoàn tất pipeline Quant</span><span style={{flex:1}}/><button className="btn ghost" onClick={()=>job.local?preview(sym):run(sym,selected.length?selected:null)}>Chạy lại</button></div>
 <div className="info-banner">{job.mode==='demo'?'Kết quả mô phỏng':job.mode==='live'||job.mode==='eod'?'Kết quả từ API':'Nguồn mô hình chưa xác nhận'} · {job.asOf?new Date(job.asOf).toLocaleString('vi-VN'):'Chưa có thời điểm dữ liệu'}{job.local&&' · Mẫu tĩnh, không chạy mô hình'}</div>
 {job.dataLineage&&<section className="card quant-lineage"><h3>Dữ liệu của lần phân tích</h3><p>{job.dataLineage.observations} nến {job.dataLineage.interval} · {job.dataLineage.start} → {job.dataLineage.end} · Giá theo {job.dataLineage.price_unit}</p><details><summary>Nguồn dữ liệu và luồng xử lý</summary><p>{job.dataLineage.collector||job.dataSourceMode||'Báo cáo đã lưu'} → {job.dataLineage.analyzer||'Mô hình Quant'} → {job.dataLineage.visualizer||'Báo cáo và visual'}</p></details></section>}
 {job.scoreComparable===false&&<p className="info-banner">Điểm job một mã không so sánh trực tiếp với xếp hạng toàn sàn. {job.scoreComparabilityReason}</p>}{job.reportError&&<p className="err" role="status">{job.reportError}</p>}{s&&<div className="keyrow">{[['quant_score','Điểm Quant',s.score,' / 100'],[null,'Khuyến nghị',s.action,''],['entry','Điểm vào',fmt(s.entry),' nghìn ₫'],['stop_loss','Cắt lỗ',fmt(s.stop),' nghìn ₫'],['take_profit','Chốt lời 1',fmt(s.tp1),' nghìn ₫'],['take_profit','Chốt lời 2',fmt(s.tp2),' nghìn ₫'],['risk_reward','Lãi/lỗ ròng',fmt(s.net_r),'x'],['atr','ATR / Giá',fmt(s.atr_pct),'%']].map(([id,label,value,unit])=><div key={label}><small>{id?<TermHint id={id}>{label}</TermHint>:label}</small><b>{value==null?'—':`${value}${unit}`}</b></div>)}</div>}
 {/* Keep the original main pipeline image output and its position below the summary. */}
  {!job.local&&job.imageUrl&&!imageError&&<img className="qimg" src={job.imageUrl} onError={()=>setImageError(true)} alt={`Tổng quan mô hình quant của ${sym}`}/>}
 {imageError&&<p className="err">Ảnh tổng quan chưa tải được; báo cáo dạng chữ vẫn có thể xem.</p>}
 {job.local&&<p className="quant-visual-note">Bản mẫu minh họa bố cục; chưa chạy mô hình cho mã này.</p>}
 {expanded&&<QuantModules modules={job.modelReports} expanded/>}<ResearchVisuals sym={sym} job={job}/>{!expanded&&<QuantModules modules={job.modelReports}/>}<AnalysisReport sym={sym} job={job}/>
 {expanded&&!!job.chartManifest?.length&&<section className="quant-artifact-gallery" aria-label="Biểu đồ các mô hình">{job.chartManifest.map(chart=><figure key={chart.id}><figcaption>{chart.kind}</figcaption><a href={chart.url} target="_blank" rel="noopener noreferrer"><img loading="lazy" src={chart.url} alt={`Biểu đồ ${chart.kind} của ${sym}`}/></a></figure>)}</section>}
 </>}
 </>;
}
