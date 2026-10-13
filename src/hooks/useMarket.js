import {useEffect,useState} from 'react';
import {getBoard} from '../api.js';
import {demoSnapshot,emptySnapshot,marketRows,normalizeSnapshot} from '../market.js';
import {createMarketPolling} from '../market-polling.js';
export default function useMarket(){
 const [snapshot,setSnapshot]=useState(emptySnapshot),[status,setStatus]=useState('connecting'),[lastSuccess,setLastSuccess]=useState(null),[flash,setFlash]=useState({});
 useEffect(()=>{
  const previous={};let flashTimer;
  const polling=createMarketPolling({
   isActive:()=>document.visibilityState!=='hidden',
   fetchSnapshot:async signal=>normalizeSnapshot(await getBoard('ALL',signal)),
   onSnapshot:next=>{
    const f={};next.quotes.forEach(r=>{const prev=previous[r.symbol];if(prev!=null&&r.price!=null&&prev!==r.price)f[r.symbol]=r.price>prev?'flash-up':'flash-dn';previous[r.symbol]=r.price;});
    setFlash(f);setSnapshot(next);setLastSuccess(new Date().toISOString());setStatus('connected');
    clearTimeout(flashTimer);flashTimer=setTimeout(()=>setFlash({}),900);
   },onError:()=>setStatus('offline')});
  const resume=()=>{if(document.visibilityState!=='hidden')polling.refresh();};
  polling.refresh();window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{polling.stop();clearTimeout(flashTimer);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[]);
 const rows=marketRows(snapshot);
 return {snapshot,rows,status,lastSuccess,flash,isStale:snapshot.isStale||status==='offline',showDemo:()=>setSnapshot(normalizeSnapshot(demoSnapshot))};
}
