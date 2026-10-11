import {useEffect,useRef,useState} from 'react';
import {motionEnabled} from '../motion.js';

// Retain native details/summary semantics and keyboard behavior.
export default function MotionDetails({children,open=false,...props}){
 const host=useRef(null),animation=useRef(null),target=useRef(Boolean(open));
 const [expanded,setExpanded]=useState(Boolean(open));
 useEffect(()=>()=>animation.current?.cancel(),[]);
 const toggle=event=>{
  event.preventDefault();const element=host.current;
  const next=!target.current;target.current=next;
  const from=element.getBoundingClientRect().height;
  animation.current?.cancel();animation.current=null;
  element.classList.remove('motion-details-animating');
  if(!motionEnabled()||!element.animate){element.open=next;setExpanded(next);return;}
  element.open=true;
  const style=getComputedStyle(element),summary=element.querySelector(':scope > summary');
  const collapsed=summary.getBoundingClientRect().height+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
  const to=next?element.getBoundingClientRect().height:collapsed;
  element.classList.add('motion-details-animating');
  const current=element.animate([{height:`${from}px`},{height:`${to}px`}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'});
  animation.current=current;
  current.onfinish=()=>{
   if(animation.current!==current)return;
   element.classList.remove('motion-details-animating');
   element.open=next;setExpanded(next);animation.current=null;
  };
 };
 const parts=Array.isArray(children)?children:[children];
 return <details {...props} ref={host} open={expanded}>
  <summary onClick={toggle}>{parts[0]}</summary>{parts.slice(1)}
 </details>;
}
