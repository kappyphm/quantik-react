import {useCallback,useEffect,useRef,useState} from 'react';

export function motionEnabled(){
 return document.documentElement.dataset.motion==='on'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Leave the dialog mounted during its short exit, including its focus trap.
export function useDialogExit(onClose){
 const [leaving,setLeaving]=useState(false);
 const timer=useRef(null),callback=useRef(onClose);callback.current=onClose;
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const dismiss=useCallback(()=>{
  if(timer.current)return;
  if(!motionEnabled()){callback.current();return;}
  setLeaving(true);timer.current=setTimeout(()=>callback.current(),180);
 },[]);
 return {leaving,dismiss};
}
