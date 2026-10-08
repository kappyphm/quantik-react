import {useEffect,useState} from 'react';
import {getBoard} from '../api.js';
import {demoSnapshot,emptySnapshot,marketRows,normalizeSnapshot} from '../market.js';
export default function useMarket(){
 const [snapshot,setSnapshot]=useState(emptySnapshot),[status,setStatus]=useState('connecting'),[lastSuccess,setLastSuccess]=useState(null),[flash,setFlash]=useState({});
 useEffect(()=>{
  let alive=true,controller,timer,previous={};
  const load=async()=>{
   controller=new AbortController();
   try{const next=normalizeSnapshot(await getBoard('ALL',controller.signal));if(!alive)return;
    const f={};next.quotes.forEach(r=>{const prev=previous[r.symbol];if(prev!=null&&r.price!=null&&prev!==r.price)f[r.symbol]=r.price>prev?'flash-up':'flash-dn';previous[r.symbol]=r.price;});
    setFlash(f);setSnapshot(next);setLastSuccess(new Date().toISOString());setStatus('connected');
   }catch(e){if(alive&&e.name!=='AbortError')setStatus('offline');}
   if(alive)timer=setTimeout(load,60000);
  };load();return()=>{alive=false;controller?.abort();clearTimeout(timer);};
 },[]);
 const rows=marketRows(snapshot);
 return {snapshot,rows,status,lastSuccess,flash,isStale:snapshot.isStale||status==='offline',showDemo:()=>setSnapshot(normalizeSnapshot(demoSnapshot))};
}
