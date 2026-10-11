import {useEffect,useRef,useState} from 'react';
import ChartWorkspace from './ChartWorkspace.jsx';
import {getSymbolDetail} from '../api.js';
import {instrumentFor} from '../market.js';
export default function StockModal({sym,initialTab='overview',theme,scan,onClose}){
  const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
  const [full,setFull]=useState(false);const inst=instrumentFor(sym);
  const [detail,setDetail]=useState(null);
  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    getSymbolDetail(sym,controller.signal).then(data=>{if(alive)setDetail(data);}).catch(()=>{});
    return ()=>{alive=false;controller.abort();};
  },[sym]);
  const exchange=detail?.exchange||inst?.exchange||'—';
  const name=detail?.name||inst?.name||sym;
 useEffect(()=>{const previous=document.activeElement;dialog.current?.querySelector('button')?.focus();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const key=e=>{if(e.defaultPrevented||document.querySelector('.term-detail'))return;if(e.key==='Escape')close.current();if(e.key==='Tab'){const nodes=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select,iframe,[tabindex="0"]')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;previous?.focus();};},[]);
 return <div className="scrim" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div ref={dialog} className={`modal stock-workspace ${full?'full-workspace':''}`} role="dialog" aria-modal="true" aria-labelledby="stock-title"><div className="mh"><h2 className="t" id="stock-title">{sym}</h2><span className="n">{exchange} · {name}</span><span className="sp"/><button className="iconbtn" aria-label={full?'Thu nhỏ cửa sổ':'Toàn màn hình'} onClick={()=>setFull(x=>!x)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5"/></svg></button><button className="iconbtn" aria-label="Đóng" onClick={onClose}>×</button></div>{scan&&<div className="scan-modal-context"><b>Bản quét {scan.runId}</b><span>{scan.row.recommendation||scan.row.action||'Chưa có hành động'} · Điểm {scan.row.score??'—'} · Dữ liệu {scan.dataAsOf}</span><small>Job chi tiết chạy riêng; điểm một mã không thay xếp hạng toàn sàn.</small></div>}<ChartWorkspace sym={sym} theme={theme} autoRun={initialTab==='quant'}/></div></div>;
}
