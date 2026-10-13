import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMarketPolling,MARKET_REFRESH_MS} from '../src/market-polling.js';

function clock(){
 let id=0;const tasks=new Map();
 return {tasks,schedule(fn,ms){tasks.set(++id,{fn,ms});return id;},cancel(id){tasks.delete(id);},
  run(ms){const [id,task]=[...tasks].find(([,t])=>t.ms===ms);tasks.delete(id);return task.fn();}};
}
test('quotes update periodically without reload; failed refresh preserves the last snapshot',async()=>{
 const timer=clock(),snapshots=[],errors=[];let requests=0;
 const polling=createMarketPolling({...timer,fetchSnapshot:async()=>{if(++requests===3)throw Error('offline');return {price:requests};},onSnapshot:s=>snapshots.push(s),onError:e=>errors.push(e)});
 await polling.refresh();await timer.run(MARKET_REFRESH_MS);await timer.run(MARKET_REFRESH_MS);
 assert.deepEqual(snapshots,[{price:1},{price:2}]);assert.equal(errors.length,1);
 polling.stop();assert.equal(timer.tasks.size,0);
});
test('focus requests coalesce; unmount aborts and rejects late updates',async()=>{
 const timer=clock(),snapshots=[];let release,signal,requests=0;
 const polling=createMarketPolling({...timer,fetchSnapshot:s=>{signal=s;requests++;return new Promise(resolve=>release=resolve);},onSnapshot:s=>snapshots.push(s),onError(){}});
 const first=polling.refresh();assert.equal(polling.refresh(),first);await Promise.resolve();
 polling.stop();assert(signal.aborted);release({price:3});await first;
 assert.equal(requests,1);assert.deepEqual(snapshots,[]);assert.equal(timer.tasks.size,0);
});
test('hidden tab pauses loads and resuming refreshes immediately; hung request times out',async()=>{
 const timer=clock();let active=false,requests=0;const errors=[];
 const polling=createMarketPolling({...timer,isActive:()=>active,fetchSnapshot:signal=>{requests++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}));},onSnapshot(){},onError:e=>errors.push(e)});
 await polling.refresh();assert.equal(requests,0);active=true;
 const pending=polling.refresh();await Promise.resolve();timer.run(60000);await pending;
 assert.equal(requests,1);assert.equal(errors.length,1);assert.equal([...timer.tasks.values()].filter(t=>t.ms===MARKET_REFRESH_MS).length,1);
 polling.stop();
});
