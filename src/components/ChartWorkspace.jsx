import {useEffect,useRef,useState} from 'react';
import QuantPanel from './QuantPanel.jsx';
import useQuantJob from '../hooks/useQuantJob.js';
import {AdvancedChart,tvSymbol} from './TVWidget.jsx';
import {tradingViewIntervals,chartIndicators,defaultIndicators,normalizeInterval,normalizeIndicators} from '../chart-settings.js';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export default function ChartWorkspace({sym,exchange,theme,autoRun=false,onQuant,onExpand}) {
 const {job,run}=useQuantJob(sym);
 const running=['queued','running'].includes(job?.status);
  const [opened,setOpened]=useState(()=>autoRun||read('qt.drawer.open',true));
  useEffect(()=>{if(autoRun)setOpened(true);},[autoRun,sym]);
  const [width,setWidth]=useState(()=>Math.min(600,Math.max(320,Number(read('qt.drawer.width',380))||380)));
  const [height,setHeight]=useState(400),[dragging,setDragging]=useState(false);
  const [tvInterval,setTvInterval]=useState(()=>normalizeInterval(read('qt.chart.tv.interval','D')));
  const [indicators,setIndicators]=useState(()=>normalizeIndicators(read('qt.chart.tv.indicators',defaultIndicators)));
  const mappedSymbol=tvSymbol(sym,exchange);
  const toggleIndicator=id=>setIndicators(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const start=useRef(null),frame=useRef(null);
  const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:1000px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:1000px)');const sync=()=>setMobile(media.matches);media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 const small=()=>mobile;
 const maxWidth=()=>Math.min(600,Math.max(320,(frame.current?.clientWidth||1000)-380));
 const changeWidth=value=>setWidth(Math.min(maxWidth(),Math.max(320,value)));
 useEffect(()=>{try{localStorage.setItem('qt.drawer.open',JSON.stringify(opened));localStorage.setItem('qt.drawer.width',JSON.stringify(width));}catch{}},[opened,width]);
 useEffect(()=>{try{localStorage.setItem('qt.chart.tv.interval',JSON.stringify(tvInterval));localStorage.setItem('qt.chart.tv.indicators',JSON.stringify(indicators));}catch{}},[tvInterval,indicators]);
 const key=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();if(small())setHeight(h=>Math.min(650,Math.max(250,e.key==='Home'?250:e.key==='End'?650:h+(e.key==='ArrowUp'?20:-20))));else changeWidth(e.key==='Home'?320:e.key==='End'?maxWidth():width+(e.key==='ArrowLeft'?20:-20));}};
 const down=e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);start.current={x:e.clientX,y:e.clientY,width,height,mobile:small()};setDragging(true);};
 const move=e=>{if(!start.current)return;const s=start.current;if(s.mobile)setHeight(Math.min(650,Math.max(250,s.height+s.y-e.clientY)));else changeWidth(s.width+s.x-e.clientX);};
 const end=()=>{start.current=null;setDragging(false);};
  return <div className="chart-workspace"><div className="workspace-tools"><b className="workspace-label">Biểu đồ {sym}</b><label>Khung nến <select aria-label="Khung nến" value={tvInterval} onChange={e=>setTvInterval(e.target.value)}>{tradingViewIntervals.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button className="btn workspace-quant-run" disabled={running} onClick={()=>{if(onQuant)onQuant(sym);else{setOpened(true);run(sym,null);}}}>{running?`Đang phân tích ${sym}…`:`Chạy Quant ${sym}`}</button><button className="btn ghost" aria-expanded={opened} onClick={()=>setOpened(x=>!x)}>{opened?'Thu gọn phân tích':'Mở phân tích'} ⌁</button></div>
  {mappedSymbol&&<div className="chart-indicators" role="group" aria-label="Chỉ báo TradingView"><span>Chỉ báo</span>{chartIndicators.map(({id,label})=><button type="button" key={id} className="btn ghost" aria-pressed={indicators.includes(id)} onClick={()=>toggleIndicator(id)}>{label}</button>)}<button type="button" className="btn ghost" onClick={()=>setIndicators([])}>Xóa chỉ báo</button><button type="button" className="btn ghost" onClick={()=>setIndicators([...defaultIndicators])}>Mặc định</button></div>}
  <div ref={frame} className={`chart-split ${opened?'analysis-open':''} ${dragging?'resizing':''}`} style={{'--analysis-width':`${width}px`,'--analysis-height':`${height}px`}}>
  <section className="chart-main" aria-label={`Biểu đồ ${sym}`}><div className="workspace-chart workspace-chart-tv">{mappedSymbol?<AdvancedChart sym={sym} symbol={mappedSymbol} interval={tvInterval} indicators={indicators} theme={theme}/>:<div className="empty"><b>Chưa xác định được sàn giao dịch của {sym}.</b><p>Biểu đồ sẽ xuất hiện khi thông tin mã được tải.</p></div>}</div>{mappedSymbol&&<a className="tradingview-open-link" href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(mappedSymbol)}`} target="_blank" rel="noopener noreferrer">Mở trên TradingView ↗</a>}</section>
 <aside className="analysis-drawer" aria-hidden={!opened} inert={!opened?'':undefined} aria-label={`Phân tích ${sym}`}><div className="resize-handle" role="separator" aria-orientation={mobile?'horizontal':'vertical'} aria-label="Kích thước panel phân tích" aria-valuemin={mobile?250:320} aria-valuemax={mobile?650:maxWidth()} aria-valuenow={Math.round(mobile?height:width)} tabIndex={opened?0:-1} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={key}/><div className="drawer-header"><div><b>Phân tích {sym}</b><small>Khung ngày</small></div><button className="iconbtn" aria-label="Thu gọn panel" onClick={()=>setOpened(false)}>›</button></div><div className="drawer-body"><QuantPanel sym={sym} autoRun={autoRun} onExpand={onExpand}/></div></aside>
 </div></div>;
}
