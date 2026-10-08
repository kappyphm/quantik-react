// One controller per browser session. Closing a popup does not cancel its job.
export function createQuantJobs({start, read, delay=2000, schedule=setTimeout}) {
  const records=new Map();
  const record=symbol=>{
    if(!records.has(symbol)){
      if(records.size>=32){for(const [key,r] of records){if(!r.pending&&!r.listeners.size){records.delete(key);break;}}}
      records.set(symbol,{value:{job:null,error:''},listeners:new Set(),pending:null});
    }
    return records.get(symbol);
  };
  const publish=(r,job,error='')=>{r.value={job,error};r.listeners.forEach(fn=>fn());};
  const run=(symbol,modules=null)=>{
    const r=record(symbol);
    if(r.pending)return r.pending;
    publish(r,{symbol,status:'queued',modules:[]});
    // Assign pending before invoking the API, including synchronous mock responses.
    r.pending=Promise.resolve().then(async()=>{
      try {
        const {id}=await start(symbol,modules);
        for(;;){
          const job=await read(id);
          if(!['queued','running','done','error'].includes(job.status))throw Error('Trạng thái job không hợp lệ.');
          publish(r,job,job.status==='error'?(job.error||'Pipeline báo lỗi.'):'');
          if(['done','error'].includes(job.status))break;
          await new Promise(resolve=>schedule(resolve,delay));
        }
      }catch(error){publish(r,{symbol,status:'error',modules:[]},error?.status>=400&&error?.status<500?error.message:'Mất kết nối dịch vụ Quant. Bấm thử lại để nối lại job hoặc chạy phân tích.');}
      finally{r.pending=null;}
    });
    return r.pending;
  };
  return {run, snapshot:symbol=>record(symbol).value,
    subscribe:(symbol,fn)=>{const r=record(symbol);r.listeners.add(fn);return()=>r.listeners.delete(fn);},
    preview:(symbol,job)=>{const r=record(symbol);if(!r.pending)publish(r,job);}};
}
