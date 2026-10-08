import {useCallback,useSyncExternalStore} from 'react';
import {createQuantJobs} from '../quant-jobs.js';
import {getJob,startQuant} from '../api.js';
import {demoSnapshot} from '../market.js';
import {demoResearch} from '../research.js';

const jobs=createQuantJobs({start:startQuant,read:getJob});
export default function useQuantJob(symbol){
 const subscribe=useCallback(fn=>jobs.subscribe(symbol,fn),[symbol]);
 const getSnapshot=useCallback(()=>jobs.snapshot(symbol),[symbol]);
 const state=useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
 const run=useCallback((_symbol=symbol,modules=null)=>jobs.run(symbol,modules),[symbol]);
 const preview=useCallback(()=>{
  const r=demoSnapshot.quotes.find(x=>x.symbol===symbol);
  jobs.preview(symbol,{symbol,status:'done',mode:'demo',local:true,asOf:demoSnapshot.asOf,
   modules:[],research:demoResearch(symbol,r?.price),metrics:[],
   summary:r?{score:r.score,action:'Theo dõi (mẫu giao diện)',entry:r.price/1000,
    stop:r.price*.95/1000,tp1:r.price*1.1/1000,tp2:r.price*1.15/1000,net_r:2,atr_pct:null}:null});
 },[symbol]);
 return {...state,run,preview};
}
