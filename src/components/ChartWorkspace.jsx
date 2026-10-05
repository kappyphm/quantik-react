import {useEffect,useRef,useState} from 'react';
import {AdvancedChart} from './TVWidget.jsx';
import QuantPanel from './QuantPanel.jsx';
import {instrumentFor} from '../market.js';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export default function ChartWorkspace({sym,theme,autoRun=false}) {
 const [opened,setOpened]=useState(()=>autoRun||read('qt.drawer.open',true));
 const [width,setWidth]=useState(()=>Math.min(600,Math.max(320,Number(read('qt.drawer.width',380))||380)));
 const [height,setHeight]=useState(400),[dragging,setDragging]=useState(false),[interval,setInterval]=useState(()=>read('qt.chart.interval','D'));
 const start=useRef(null),frame=useRef(null);const inst=instrumentFor(sym);
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:1000px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:1000px)');const sync=()=>setMobile(media.matches);media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 const small=()=>mobile;
 const maxWidth=()=>Math.min(600,Math.max(320,(frame.current?.clientWidth||1000)-380));
 const changeWidth=value=>setWidth(Math.min(maxWidth(),Math.max(320,value)));
 useEffect(()=>{try{localStorage.setItem('qt.drawer.open',JSON.stringify(opened));localStorage.setItem('qt.drawer.width',JSON.stringify(width));localStorage.setItem('qt.chart.interval',JSON.stringify(interval));}catch{}},[opened,width,interval]);
 const key=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();if(small())setHeight(h=>Math.min(650,Math.max(250,e.key==='Home'?250:e.key==='End'?650:h+(e.key==='ArrowUp'?20:-20))));else changeWidth(e.key==='Home'?320:e.key==='End'?maxWidth():width+(e.key==='ArrowLeft'?20:-20));}};
 const down=e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);start.current={x:e.clientX,y:e.clientY,width,height,mobile:small()};setDragging(true);};
 const move=e=>{if(!start.current)return;const s=start.current;if(s.mobile)setHeight(Math.min(650,Math.max(250,s.height+s.y-e.clientY)));else changeWidth(s.width+s.x-e.clientX);};
 const end=()=>{start.current=null;setDragging(false);};
 return <div className="chart-workspace"><div className="workspace-tools"><b className="workspace-label">Biểu đồ {sym}</b><label>Khung nến <select aria-label="Khung nến" value={interval} onChange={e=>setInterval(e.target.value)}>{[['1','1 phút'],['3','3 phút'],['5','5 phút'],['15','15 phút'],['30','30 phút'],['60','1 giờ'],['120','2 giờ'],['240','4 giờ'],['D','1 ngày'],['W','1 tuần'],['M','1 tháng']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button className="btn ghost" aria-expanded={opened} onClick={()=>setOpened(x=>!x)}>{opened?'Thu gọn phân tích':'Mở phân tích'} ⌁</button></div>
 <p className="chart-source">TradingView có nguồn độc lập · Khung và chỉ báo tùy dữ liệu được hỗ trợ. Đổi khung nhanh tải lại widget; dùng toolbar trong chart để giữ thao tác. Phân tích Quant hiện theo ngày.</p>
 <div ref={frame} className={`chart-split ${opened?'analysis-open':''} ${dragging?'resizing':''}`} style={{'--analysis-width':`${width}px`,'--analysis-height':`${height}px`}}>
 <section className="chart-main" aria-label={`Biểu đồ ${sym}`}><div className="workspace-chart">{inst?.tvSymbol ? <AdvancedChart sym={sym} symbol={inst.tvSymbol} theme={theme} interval={interval}/> : <div className="empty"><b>Chưa có mapping TradingView được cấu hình cho {sym}</b><p>Bảng điện vẫn dùng được. Cần xác minh mã và nguồn chart của sàn {inst?.exchange||'chưa xác định'}.</p></div>}</div></section>
 <aside className="analysis-drawer" hidden={!opened} aria-label={`Phân tích ${sym}`}><div className="resize-handle" role="separator" aria-orientation={mobile?'horizontal':'vertical'} aria-label="Kích thước panel phân tích" aria-valuemin={mobile?250:320} aria-valuemax={mobile?650:maxWidth()} aria-valuenow={Math.round(mobile?height:width)} tabIndex={opened?0:-1} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={key}/><div className="drawer-header"><div><b>Phân tích {sym}</b><small>Khung ngày · Dữ liệu mô phỏng</small></div><button className="iconbtn" aria-label="Thu gọn panel" onClick={()=>setOpened(false)}>›</button></div><div className="drawer-body"><QuantPanel sym={sym} autoRun={autoRun}/></div></aside>
 </div></div>;
}
