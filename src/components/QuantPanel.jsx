import {useEffect,useState} from 'react';
import {listModules} from '../api.js';
import useQuantJob,{resumeQuantAnalysis} from '../hooks/useQuantJob.js';
import ResearchVisuals from './ResearchVisuals.jsx';
import AnalysisReport from './AnalysisReport.jsx';
import AnnotatedText from './AnnotatedText.jsx';
import TermHint from './TermHint.jsx';
import {fmt} from '../market.js';
import QuantModules from './QuantModules.jsx';
import QuantSynthesis from './QuantSynthesis.jsx';
import QuantProgress from './QuantProgress.jsx';
export default function QuantPanel({sym,autoRun=false,expanded=false,onExpand}){
 const [mods,setMods]=useState([]),[failed,setFailed]=useState(false),[selected,setSelected]=useState([]),[imageError,setImageError]=useState(false);
 const {job,error,run,preview}=useQuantJob(sym);
 useEffect(()=>{let alive=true;listModules().then(m=>{if(alive){setMods(m);setSelected(m.map(x=>x.id));}}).catch(()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[]);
 useEffect(()=>{if(autoRun)resumeQuantAnalysis(sym);},[sym,autoRun]);
 useEffect(()=>setImageError(false),[job?.id]);
 const running=job?.status==='queued'||job?.status==='running',s=job?.summary,screenedOut=job?.analysisStatus==='screened_out';
 return <>
 {onExpand&&<button className="btn ghost quant-expand" onClick={()=>onExpand(sym)}>Mở trang Quant toàn màn hình ↗</button>}
 {!job&&<section className="card quant-controls"><h3>Phân tích Quant {sym}</h3><p className="dim">Phân tích xu hướng, dòng tiền và rủi ro theo từng mô hình.</p>
 {failed&&<p role="status" className="err">Chưa kết nối được dịch vụ phân tích. Bạn có thể xem bản mẫu giao diện.</p>}
 <div className="mods">{mods.map(m=><div className="mod" key={m.id}><input type="checkbox" aria-label={`Chọn module ${m.name}`} disabled={running} checked={selected.includes(m.id)} onChange={e=>setSelected(a=>e.target.checked?[...a,m.id]:a.filter(id=>id!==m.id))}/><span><b><AnnotatedText text={m.name}/></b><small><AnnotatedText text={m.desc}/></small></span></div>)}</div>
 <div className="quant-actions"><button className="btn" disabled={running||!selected.length} onClick={()=>run(sym,selected)}>Chạy Quant {sym}</button><button className="btn ghost" onClick={()=>preview(sym)}>Xem kết quả mẫu</button></div></section>}
 {running&&<section className="card" role="status"><h3>Đang phân tích {sym}</h3>{job.status==='queued'&&<p>Đang chờ đến lượt phân tích…</p>}<QuantProgress job={job}/><progress max="100" value={job.progress_pct||0} aria-label="Tiến độ phân tích Quant"/></section>}
 {job?.status==='error'&&<section className="card"><p role="alert" className="err">{error}</p><div className="quant-actions"><button className="btn ghost" onClick={()=>run(sym,selected.length?selected:null)}>Thử lại</button><button className="btn ghost" onClick={()=>preview(sym)}>Xem kết quả mẫu</button></div></section>}
 {job?.status==='done'&&<div className="quant-result">
 <div className="ctl">{job.mode==='demo'&&<span className="demo-badge">Kết quả minh họa</span>}<span style={{flex:1}}/><button className="btn ghost" onClick={()=>job.local?preview(sym):run(sym,selected.length?selected:null)}>Chạy lại</button></div>
 {screenedOut&&<section className="card quant-screened-out" role="status"><h3>Thanh khoản chưa đạt điều kiện</h3><p>Mã {sym} chưa đạt điều kiện thanh khoản để đánh giá cơ hội giao dịch. Xem các chỉ số thanh khoản bên dưới.</p></section>}
 {job.reportError&&<p className="err" role="status">Chưa tải được báo cáo. Bấm Chạy lại để thử lại.</p>}{s&&!screenedOut&&<div className="keyrow">{[[null,'Khuyến nghị',s.action,''],['entry','Điểm vào',fmt(s.entry),' nghìn ₫'],['stop_loss','Cắt lỗ',fmt(s.stop),' nghìn ₫'],['take_profit','Chốt lời 1',fmt(s.tp1),' nghìn ₫'],['take_profit','Chốt lời 2',fmt(s.tp2),' nghìn ₫'],['risk_reward','Lãi/lỗ ròng',fmt(s.net_r),'x'],['atr','ATR / Giá',fmt(s.atr_pct),'%']].map(([id,label,value,unit])=><div key={label}><small>{id?<TermHint id={id}>{label}</TermHint>:label}</small><b>{value==null?'—':`${value}${unit}`}</b></div>)}</div>}
 {/* Keep the original main pipeline image output and its position below the summary. */}
  {!job.local&&job.imageUrl&&!imageError&&<img className="qimg" src={job.imageUrl} onError={()=>setImageError(true)} alt={`Tổng quan mô hình quant của ${sym}`}/>}
 {imageError&&<p className="err">Ảnh tổng quan chưa tải được; báo cáo dạng chữ vẫn có thể xem.</p>}
 <QuantSynthesis modules={job.modelReports} analysis={job.synthesis} expanded={expanded}/>{expanded&&<QuantModules analysis={job.synthesis} modules={job.modelReports} expanded/>}{!screenedOut&&<ResearchVisuals sym={sym} job={job}/>}{!expanded&&<QuantModules analysis={job.synthesis} modules={job.modelReports}/>}{!job.synthesis&&<AnalysisReport sym={sym} job={job}/>}
 {expanded&&!!job.chartManifest?.length&&<section className="quant-artifact-gallery" aria-label="Biểu đồ các mô hình">{job.chartManifest.map(chart=><figure key={chart.id}><figcaption>{chart.kind}</figcaption><a href={chart.url} target="_blank" rel="noopener noreferrer"><img loading="lazy" src={chart.url} alt={`Biểu đồ ${chart.kind} của ${sym}`}/></a></figure>)}</section>}
 </div>}
 </>;
}
