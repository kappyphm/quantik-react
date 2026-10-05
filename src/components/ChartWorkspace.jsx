import {useEffect,useRef,useState} from 'react';
import BackendChart from './BackendChart.jsx';
import QuantPanel from './QuantPanel.jsx';
import {getSymbolOhlcv} from '../api.js';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const intervals=['D','W','M'];
export default function ChartWorkspace({sym,theme,autoRun=false}) {
  const [opened,setOpened]=useState(()=>autoRun||read('qt.drawer.open',true));
  const [width,setWidth]=useState(()=>Math.min(600,Math.max(320,Number(read('qt.drawer.width',380))||380)));
  const [height,setHeight]=useState(400),[dragging,setDragging]=useState(false);
  const [interval,setInterval]=useState(()=>{const v=read('qt.chart.interval','D');return intervals.includes(v)?v:'D';});
  const [bars,setBars]=useState(null),[chartError,setChartError]=useState('');
  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    setBars(null);setChartError('');
    getSymbolOhlcv(sym,260,controller.signal)
      .then(data=>{if(alive)setBars(data.bars||[]);})
      .catch(err=>{if(alive&&err.name!=='AbortError')setChartError(err.message||'Không tải được nến.');});
    return ()=>{alive=false;controller.abort();};
  },[sym]);
  const start=useRef(null),frame=useRef(null);
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
  return <div className="chart-workspace"><div className="workspace-tools"><b className="workspace-label">Biểu đồ {sym}</b><label>Khung nến <select aria-label="Khung nến" value={interval} onChange={e=>setInterval(e.target.value)}>{[['D','Ngày'],['W','Tuần'],['M','Tháng']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button className="btn ghost" aria-expanded={opened} onClick={()=>setOpened(x=>!x)}>{opened?'Thu gọn phân tích':'Mở phân tích'} ⌁</button></div>
  <p className="chart-source">Nến từ snapshot đã công bố của backend · Khớp đúng dữ liệu dùng để phân tích Quant.</p>
  <div ref={frame} className={`chart-split ${opened?'analysis-open':''} ${dragging?'resizing':''}`} style={{'--analysis-width':`${width}px`,'--analysis-height':`${height}px`}}>
  <section className="chart-main" aria-label={`Biểu đồ ${sym}`}><div className="workspace-chart" style={{padding: 12}}>{chartError ? <div className="empty"><b>Không tải được nến {sym}</b><p>{chartError}</p></div> : !bars ? <div className="empty"><p>Đang tải nến…</p></div> : !bars.length ? <div className="empty"><b>Mã {sym} chưa có OHLCV trong bản công bố</b></div> : <BackendChart symbol={sym} bars={bars} interval={interval} theme={theme}/>}</div></section>
 <aside className="analysis-drawer" hidden={!opened} aria-label={`Phân tích ${sym}`}><div className="resize-handle" role="separator" aria-orientation={mobile?'horizontal':'vertical'} aria-label="Kích thước panel phân tích" aria-valuemin={mobile?250:320} aria-valuemax={mobile?650:maxWidth()} aria-valuenow={Math.round(mobile?height:width)} tabIndex={opened?0:-1} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={key}/><div className="drawer-header"><div><b>Phân tích {sym}</b><small>Khung ngày · Theo phiên phân tích đã công bố</small></div><button className="iconbtn" aria-label="Thu gọn panel" onClick={()=>setOpened(false)}>›</button></div><div className="drawer-body"><QuantPanel sym={sym} autoRun={autoRun}/></div></aside>
 </div></div>;
}
