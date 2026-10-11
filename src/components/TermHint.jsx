import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { getTerm } from '../content/glossary.js';

export function Formula({ latex }) {
  const html=useMemo(()=>katex.renderToString(latex || String.raw`\text{Chưa xác định}`,{throwOnError:false,trust:false,displayMode:true,output:'htmlAndMathml'}),[latex]);
  return <div className="formula" dangerouslySetInnerHTML={{__html:html}}/>;
}
export default function TermHint({ id, children, parameters, methodId }) {
  const term=getTerm(id);
  const anchor=useRef(null), popup=useRef(null), timer=useRef(null);
  const [mode,setMode]=useState(null),[position,setPosition]=useState({left:12,top:12});
  const uid=useId();
  const hide=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>setMode(m=>m==='pinned'?m:null),180);};
  const show=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>setMode(m=>m==='pinned'?m:'hover'),250);};
  const close=()=>{clearTimeout(timer.current);setMode(null);};
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{
    if(!mode)return;
    const place=()=>{
      const r=anchor.current?.getBoundingClientRect();if(!r)return;
      const w=Math.min(390,window.innerWidth-24);
      const h=popup.current?.offsetHeight || 220;
      setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-w-12)),top:Math.max(12,Math.min(r.bottom+8,window.innerHeight-h-12)),width:w,maxHeight:window.innerHeight-24});
    };
    place();window.addEventListener('resize',place);document.addEventListener('scroll',place,true);
    const dismiss=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
    const outside=e=>{if(!popup.current?.contains(e.target)&&!anchor.current?.contains(e.target))close();};
    document.addEventListener('keydown',dismiss,true);document.addEventListener('pointerdown',outside);
    return()=>{window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);document.removeEventListener('keydown',dismiss,true);document.removeEventListener('pointerdown',outside);};
  },[mode]);
  if(!term)return <span>{children||id}</span>;
  return <><button ref={anchor} type="button" className="term-trigger" aria-describedby={mode?uid:undefined} onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide} onClick={e=>{e.preventDefault();e.stopPropagation();clearTimeout(timer.current);setMode(m=>m==='pinned'?null:'pinned');}}>{children||term.en}</button>
  {mode&&createPortal(<div ref={popup} id={uid} className="term-popover" style={position} role="tooltip" onPointerEnter={()=>clearTimeout(timer.current)} onPointerLeave={hide}>
    <div className="term-title"><strong>{term.en}</strong></div><small>{term.vi}</small>
    <h4>01 · Lý thuyết</h4><p>{term.short}</p>
    <h4>02 · Công thức</h4><Formula latex={term.formulaLatex}/><p className="term-note preserve-lines">{term.variables}</p>
    <p className="term-note preserve-lines"><b>Tham số:</b> {parameters?Object.entries(parameters).map(([k,v])=>`${k}: ${v}`).join(' · '):term.parameters}</p>
    <h4>03 · Ví dụ minh họa</h4><p>{term.example}</p>
    <h4>04 · Ngưỡng và điều kiện</h4><p className="term-note preserve-lines">{term.conditions||term.interpretation||'Không có ngưỡng chung. Đối chiếu cửa sổ, đơn vị và cấu hình của mô hình đang dùng.'}</p><small>Ngưỡng tài liệu là tham khảo; cấu hình pipeline và mục tiêu kiểm định quyết định ngưỡng thực.</small>
    <h4>05 · Cách sử dụng</h4><p className="term-note">{term.usage}</p><p className="term-note">{term.limitations}</p>
    {methodId&&methodId!==term.methodId&&<p className="term-note">Công thức tham chiếu; kết quả đang dùng phương pháp {methodId}.</p>}
    {term.source&&<small>Nguồn: {term.source.file} · {term.source.sheet} · dòng {term.source.row}.</small>}
  </div>,document.body)}</>;
}
