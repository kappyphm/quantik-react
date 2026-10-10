import {useEffect,useRef,useState} from 'react';
import BackendChart from './BackendChart.jsx';
import QuantPanel from './QuantPanel.jsx';
import useQuantJob from '../hooks/useQuantJob.js';
import {getSymbolOhlcv} from '../api.js';
import {AdvancedChart,tvSymbol} from './TVWidget.jsx';
import {backendIntervals,tradingViewIntervals,chartIndicators,defaultIndicators,normalizeInterval,normalizeIndicators} from '../chart-settings.js';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export default function ChartWorkspace({sym,theme,autoRun=false,onQuant,onExpand}) {
 const {job,run}=useQuantJob(sym);
 const running=['queued','running'].includes(job?.status);
  const [opened,setOpened]=useState(()=>autoRun||read('qt.drawer.open',true));
  useEffect(()=>{if(autoRun)setOpened(true);},[autoRun,sym]);
  const [width,setWidth]=useState(()=>Math.min(600,Math.max(320,Number(read('qt.drawer.width',380))||380)));
  const [height,setHeight]=useState(400),[dragging,setDragging]=useState(false);
  const [interval,setInterval]=useState(()=>normalizeInterval(read('qt.chart.interval','D'),backendIntervals));
  const [source,setSource]=useState(()=>read('qt.chart.source','backend')==='tradingview'?'tradingview':'backend');
  const [tvInterval,setTvInterval]=useState(()=>normalizeInterval(read('qt.chart.tv.interval','D')));
  const [indicators,setIndicators]=useState(()=>normalizeIndicators(read('qt.chart.tv.indicators',defaultIndicators)));
  const tradingView=source==='tradingview';
  const mappedSymbol=tvSymbol(sym);
  const toggleIndicator=id=>setIndicators(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const [bars,setBars]=useState(null),[chartError,setChartError]=useState('');
  useEffect(()=>{
    if(tradingView)return;
    let alive=true;const controller=new AbortController();
    setBars(null);setChartError('');
    getSymbolOhlcv(sym,260,controller.signal)
      .then(data=>{if(alive)setBars(data.bars||[]);})
      .catch(err=>{if(alive&&err.name!=='AbortError')setChartError(err.message||'Không tải được nến.');});
    return ()=>{alive=false;controller.abort();};
  },[sym,tradingView]);
  const start=useRef(null),frame=useRef(null);
  const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:1000px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:1000px)');const sync=()=>setMobile(media.matches);media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 const small=()=>mobile;
 const maxWidth=()=>Math.min(600,Math.max(320,(frame.current?.clientWidth||1000)-380));
 const changeWidth=value=>setWidth(Math.min(maxWidth(),Math.max(320,value)));
 useEffect(()=>{try{localStorage.setItem('qt.drawer.open',JSON.stringify(opened));localStorage.setItem('qt.drawer.width',JSON.stringify(width));localStorage.setItem('qt.chart.interval',JSON.stringify(interval));}catch{}},[opened,width,interval]);
 useEffect(()=>{try{localStorage.setItem('qt.chart.source',JSON.stringify(source));localStorage.setItem('qt.chart.tv.interval',JSON.stringify(tvInterval));localStorage.setItem('qt.chart.tv.indicators',JSON.stringify(indicators));}catch{}},[source,tvInterval,indicators]);
 const key=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();if(small())setHeight(h=>Math.min(650,Math.max(250,e.key==='Home'?250:e.key==='End'?650:h+(e.key==='ArrowUp'?20:-20))));else changeWidth(e.key==='Home'?320:e.key==='End'?maxWidth():width+(e.key==='ArrowLeft'?20:-20));}};
 const down=e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);start.current={x:e.clientX,y:e.clientY,width,height,mobile:small()};setDragging(true);};
 const move=e=>{if(!start.current)return;const s=start.current;if(s.mobile)setHeight(Math.min(650,Math.max(250,s.height+s.y-e.clientY)));else changeWidth(s.width+s.x-e.clientX);};
 const end=()=>{start.current=null;setDragging(false);};
  return <div className="chart-workspace"><div className="workspace-tools"><b className="workspace-label">Biểu đồ {sym}</b><label>Nguồn biểu đồ <select aria-label="Nguồn biểu đồ" value={source} onChange={e=>setSource(e.target.value)}><option value="backend">Dữ liệu Quantik</option><option value="tradingview">TradingView</option></select></label><label>Khung nến <select aria-label="Khung nến" value={tradingView?tvInterval:interval} onChange={e=>(tradingView?setTvInterval:setInterval)(e.target.value)}>{(tradingView?tradingViewIntervals:backendIntervals).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button className="btn workspace-quant-run" disabled={running} onClick={()=>{if(onQuant)onQuant(sym);else{setOpened(true);run(sym,null);}}}>{running?`Đang phân tích ${sym}…`:`Chạy Quant ${sym}`}</button><button className="btn ghost" aria-expanded={opened} onClick={()=>setOpened(x=>!x)}>{opened?'Thu gọn phân tích':'Mở phân tích'} ⌁</button></div>
  {tradingView&&mappedSymbol&&<div className="chart-indicators" role="group" aria-label="Chỉ báo TradingView"><span>Chỉ báo</span>{chartIndicators.map(({id,label})=><button type="button" key={id} className="btn ghost" aria-pressed={indicators.includes(id)} onClick={()=>toggleIndicator(id)}>{label}</button>)}<button type="button" className="btn ghost" onClick={()=>setIndicators([])}>Xóa chỉ báo</button><button type="button" className="btn ghost" onClick={()=>setIndicators([...defaultIndicators])}>Mặc định</button></div>}
  <p className="chart-source">{tradingView?'Dữ liệu TradingView · Khung intraday tùy mã và quyền dữ liệu của TradingView. Job Quant dùng dữ liệu khung ngày của lần chạy; xem thời điểm trong báo cáo.':'Chart dùng snapshot đã công bố · Job Quant tra cứu lấy dữ liệu mới, thời điểm có thể khác chart.'}</p>
  <div ref={frame} className={`chart-split ${opened?'analysis-open':''} ${dragging?'resizing':''}`} style={{'--analysis-width':`${width}px`,'--analysis-height':`${height}px`}}>
  <section className="chart-main" aria-label={`Biểu đồ ${sym}`}><div className={`workspace-chart ${tradingView?'workspace-chart-tv':''}`} style={{padding: tradingView?0:12}}>{tradingView ? mappedSymbol ? <AdvancedChart sym={sym} symbol={mappedSymbol} interval={tvInterval} indicators={indicators} theme={theme}/> : <div className="empty"><b>Chưa có mapping TradingView cho {sym}</b><p>Bạn có thể xem nến từ dữ liệu Quantik.</p><button className="btn ghost" onClick={()=>setSource('backend')}>Xem dữ liệu Quantik</button></div> : chartError ? <div className="empty"><b>Không tải được nến {sym}</b><p>{chartError}</p></div> : !bars ? <div className="empty"><p>Đang tải nến…</p></div> : !bars.length ? <div className="empty"><b>Mã {sym} chưa có OHLCV trong bản công bố</b></div> : <BackendChart symbol={sym} bars={bars} interval={interval} theme={theme}/>}</div></section>
 <aside className="analysis-drawer" hidden={!opened} aria-label={`Phân tích ${sym}`}><div className="resize-handle" role="separator" aria-orientation={mobile?'horizontal':'vertical'} aria-label="Kích thước panel phân tích" aria-valuemin={mobile?250:320} aria-valuemax={mobile?650:maxWidth()} aria-valuenow={Math.round(mobile?height:width)} tabIndex={opened?0:-1} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={key}/><div className="drawer-header"><div><b>Phân tích {sym}</b><small>Khung ngày · Dữ liệu của job phân tích</small></div><button className="iconbtn" aria-label="Thu gọn panel" onClick={()=>setOpened(false)}>›</button></div><div className="drawer-body"><QuantPanel sym={sym} autoRun={autoRun} onExpand={onExpand}/></div></aside>
 </div></div>;
}
