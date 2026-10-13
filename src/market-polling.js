export const MARKET_REFRESH_MS=30000;

// Coalesce focus/visibility events with the periodic request; never overlap loads.
export function createMarketPolling({fetchSnapshot,onSnapshot,onError,isActive=()=>true,
 interval=MARKET_REFRESH_MS,timeout=60000,schedule=setTimeout,cancel=clearTimeout}){
 let stopped=false,pending=null,controller=null,timer=null,deadline=null;
 const next=()=>{if(!stopped)timer=schedule(refresh,interval);};
 const refresh=()=>{
  if(stopped)return Promise.resolve();
  if(pending)return pending;
  cancel(timer);timer=null;
  if(!isActive()){next();return Promise.resolve();}
  controller=new AbortController();
  deadline=schedule(()=>controller?.abort(),timeout);
  pending=Promise.resolve().then(()=>fetchSnapshot(controller.signal))
   .then(snapshot=>{if(!stopped)onSnapshot(snapshot);})
   .catch(error=>{if(!stopped)onError(error);})
   .finally(()=>{cancel(deadline);deadline=null;controller=null;pending=null;next();});
  return pending;
 };
 return {refresh,stop(){stopped=true;controller?.abort();cancel(timer);cancel(deadline);}};
}
