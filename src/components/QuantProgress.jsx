export default function QuantProgress({job}){
 const steps=['Lấy dữ liệu','Phân tích mô hình','Đánh giá rủi ro','Tạo báo cáo'];
 const stage={queued:0,fetch:0,models:1,risk:2,backtest:2,visual:3,done:3}[job.phase]??0;
 return <ol className="quant-progress-steps" aria-label="Các bước phân tích">{steps.map((label,index)=><li key={label} className={index<stage?'complete':index===stage?'current':'waiting'} aria-current={index===stage?'step':undefined}><span>{index<stage?'✓':String(index+1).padStart(2,'0')}</span><b>{label}</b></li>)}</ol>;
}
