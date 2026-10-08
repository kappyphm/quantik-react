import {useState} from 'react';
import {normalizeResearch,payoff} from '../research.js';
import {fmt} from '../market.js';
import TermHint from './TermHint.jsx';

const W=480,H=200,P=30;
const scale=(value,min,max,low,high)=>low+(value-min)/(max-min||1)*(high-low);
const colors={bull:'var(--up)',bear:'var(--down)',sideways:'var(--ref)'};
function Panel({title,term,children,rows,columns,note}){
 return <article className="research-card"><h4><TermHint id={term}>{title}</TermHint></h4>{children||<p className="visual-empty">Chưa có dữ liệu có cấu trúc cho biểu đồ này.</p>}{note&&<p className="visual-caption">{note}</p>}
  {!!rows?.length&&<details className="visual-data"><summary>Xem dữ liệu biểu đồ</summary><div className="boardwrap"><table><thead><tr>{columns.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{columns.map(([key])=><td key={key}>{typeof row[key]==='number'?fmt(row[key],2):row[key]??'—'}</td>)}</tr>)}</tbody></table></div></details>}
 </article>;
}
function Cone({data}){
 if(data.length<2)return null;
 const min=Math.min(...data.map(p=>p.p05))/1000,max=Math.max(...data.map(p=>p.p95))/1000;
 const x=p=>scale(p.session,data[0].session,data.at(-1).session,P,W-P),y=v=>scale(v/1000,min,max,H-P,P);
 const line=key=>data.map(p=>`${x(p)},${y(p[key])}`).join(' ');
 const band=(low,high)=>`${line(high)} ${[...data].reverse().map(p=>`${x(p)},${y(p[low])}`).join(' ')}`;
 return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Phân vị giá theo phiên dự báo, đơn vị nghìn đồng"><polygon points={band('p05','p95')} fill="var(--up)" opacity=".09"/><polygon points={band('p25','p75')} fill="var(--up)" opacity=".2"/><polyline points={line('p50')} fill="none" stroke="var(--up)" strokeWidth="2"/>{data.map(p=><circle key={p.session} cx={x(p)} cy={y(p.p50)} r="3" fill="var(--up)"><title>{`Phiên +${p.session}: P05 ${fmt(p.p05/1000)} · P50 ${fmt(p.p50/1000)} · P95 ${fmt(p.p95/1000)} nghìn ₫`}</title></circle>)}<text x={P} y="16">{fmt(max)} nghìn ₫</text><text x={P} y={H-4}>+{data[0].session} phiên</text><text x={W-P} y={H-4} textAnchor="end">+{data.at(-1).session} phiên</text></svg>;
}
function Histogram({data}){
 if(!data.length)return null;
 const max=Math.max(...data.map(p=>p.probabilityPct),1),width=(W-P*2)/data.length;
 return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Phân phối lợi suất cuối kỳ, trục dọc tỷ lệ phần trăm"><text x={P} y="16">Tần suất (%)</text>{data.map((p,i)=>{const h=scale(p.probabilityPct,0,max,0,H-P*2);return <g key={i}><rect x={P+i*width+2} y={H-P-h} width={Math.max(1,width-4)} height={h} fill={p.returnPct<0?'var(--down)':'var(--up)'} opacity=".8"><title>{`Lợi suất ${p.returnPct}%: ${p.probabilityPct}% kịch bản`}</title></rect><text x={P+(i+.5)*width} y={H-8} textAnchor="middle">{p.returnPct}%</text></g>;})}</svg>;
}
function Regime({data}){
 if(!data.length)return null;
 const width=(W-P*2)/data.length,min=Math.min(...data.map(p=>p.price)),max=Math.max(...data.map(p=>p.price));
 const line=data.map((p,i)=>`${P+(i+.5)*width},${scale(p.price,min,max,H-P,P)}`).join(' ');
 const hasProb=data.every(p=>p.probabilities);
 return <><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={hasProb?'Lịch sử xác suất HMM và giá':'Lịch sử nhãn trạng thái HMM và giá'}><text x={P} y="16">{hasProb?'Xác suất 0–100% · Đường giá':'Nhãn trạng thái · Đường giá'}</text>{data.map((p,i)=>{if(!p.probabilities)return <rect key={i} x={P+i*width} y={P} width={width} height={H-P*2} fill={colors[p.state.toLowerCase()==='sideway'?'sideways':p.state.toLowerCase()]} opacity=".22"><title>{`${p.date}: ${p.state}`}</title></rect>;let sum=0;return <g key={i}>{['bear','sideways','bull'].map(k=>{const h=p.probabilities[k]*(H-P*2),y=H-P-sum-h;sum+=h;return <rect key={k} x={P+i*width} y={y} width={width} height={h} fill={colors[k]} opacity=".22"><title>{`${p.date}: ${k} ${fmt(p.probabilities[k]*100)}%`}</title></rect>;})}</g>;})}<polyline points={line} fill="none" stroke="var(--text)" strokeWidth="1.5"/><text x={P} y={H-6}>{data[0].date}</text><text x={W-P} y={H-6} textAnchor="end">{data.at(-1).date}</text></svg><div className="visual-legend"><span className="up">Bull</span><span className="ref">Sideways</span><span className="down">Bear</span></div></>;
}
function Drawdown({data}){
 if(data.length<2)return null;
 const min=Math.min(...data.map(p=>p.valuePct),-1),x=i=>scale(i,0,data.length-1,P,W-P),y=v=>scale(v,min,0,H-P,P);
 const line=data.map((p,i)=>`${x(i)},${y(p.valuePct)}`).join(' ');
 return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sụt giảm lịch sử từ đỉnh, phần trăm âm"><polygon points={`${P},${P} ${line} ${W-P},${P}`} fill="var(--down)" opacity=".12"/><polyline points={line} fill="none" stroke="var(--down)" strokeWidth="2"/>{data.map((p,i)=><circle key={i} cx={x(i)} cy={y(p.valuePct)} r="2" fill="var(--down)"><title>{`${p.date}: ${fmt(p.valuePct)}%`}</title></circle>)}<text x={P} y="16">0%</text><text x={P} y={H-4}>Sụt giảm lớn nhất {fmt(Math.min(...data.map(p=>p.valuePct)))}%</text></svg>;
}
function Factors({data}){
 if(data.length<3)return null;
 const cx=240,cy=110,r=72,point=(i,fraction)=>{const a=-Math.PI/2+2*Math.PI*i/data.length;return [cx+Math.cos(a)*r*fraction,cy+Math.sin(a)*r*fraction];};
 const polygon=fraction=>data.map((_,i)=>point(i,fraction).join(',')).join(' ');
 return <svg viewBox={`0 0 ${W} 235`} role="img" aria-label="Radar các nhân tố, chuẩn hóa theo miền của từng nhân tố">{[.25,.5,.75,1].map(n=><polygon key={n} points={polygon(n)} fill="none" stroke="var(--line)"/>)}{data.map((p,i)=>{const [x,y]=point(i,1.4);return <g key={p.id}><line x1={cx} y1={cy} x2={point(i,1)[0]} y2={point(i,1)[1]} stroke="var(--line)"/><text x={x} y={y} textAnchor="middle">{p.label}</text></g>;})}<polygon points={data.map((p,i)=>point(i,(p.value-p.min)/(p.max-p.min)).join(',')).join(' ')} fill="var(--amber)" fillOpacity=".15" stroke="var(--amber)" strokeWidth="2"/></svg>;
}
export default function ResearchVisuals({sym,job}){
 const [view,setView]=useState('all');
 const research=normalizeResearch(job.research,sym);
 const last=data=>view==='recent'?data.slice(-10):data;
 const levels=job.summary,trade=levels?payoff(levels.entry,levels.stop,levels.tp2):null;
 return <section className="research-visuals" aria-label={`Visual Quant ${sym}`}><div className="report-heading"><span className="eyebrow">BẰNG CHỨNG / RỦI RO / KỊCH BẢN</span><h3>Góc nhìn định lượng</h3><p>{research?.source||'Backend chưa cung cấp bộ dữ liệu visual.'}{research?.horizonSessions&&` · Horizon ${research.horizonSessions} phiên`}{research?.simulationCount&&` · ${research.simulationCount.toLocaleString('vi-VN')} kịch bản`}</p></div>
 {research?.mode==='demo'&&<p className="info-banner">Visual mẫu cố định để kiểm tra giao diện. Các phân vị, xác suất và điểm nhân tố này không phải kết quả mô hình cho {sym}.</p>}
 <div className="research-grid">
  <Panel title="Dải giá dự báo" term="monte_carlo" rows={research?.cone?.map(p=>({...p,p05:p.p05/1000,p50:p.p50/1000,p95:p.p95/1000}))} columns={[['session','Phiên +'],['p05','P05 (nghìn ₫)'],['p50','P50'],['p95','P95']]} note="P05–P95 và P25–P75; đường giữa là P50. Phân vị mô hình phụ thuộc giả định, không đảm bảo giá tương lai.">{research?.cone?.length>=2&&<Cone data={research.cone}/>}</Panel>
  <Panel title="Phân phối lợi suất" term="mc_volatility" rows={research?.distribution} columns={[['returnPct','Lợi suất (%)'],['probabilityPct','Tần suất (%)']]} note="Cùng horizon với dự báo. Đây là phân phối cuối kỳ, không phải xác suất TP chạm trước SL.">{!!research?.distribution?.length&&<Histogram data={research.distribution}/>}</Panel>
  <Panel title="Trạng thái HMM" term="hmm" rows={research?.regime?.map(p=>({date:p.date,price:p.price/1000,state:p.state,bull:p.probabilities?.bull==null?null:p.probabilities.bull*100,bear:p.probabilities?.bear==null?null:p.probabilities.bear*100}))} columns={[['date','Phiên'],['price','Giá (nghìn ₫)'],['state','Trạng thái'],['bull','Bull (%)'],['bear','Bear (%)']]} note="Nguồn chỉ có nhãn trạng thái thì hiển thị nhãn; không tự tạo xác suất lịch sử. Xác suất HMM khác xác suất giao dịch thắng."><div className="visual-controls"><label>Lịch sử <select aria-label="Cửa sổ lịch sử visual" value={view} onChange={e=>setView(e.target.value)}><option value="all">Toàn cửa sổ</option><option value="recent">10 quan sát cuối</option></select></label></div>{!!research?.regime?.length?<Regime data={last(research.regime)}/>:<p className="visual-empty">Chưa có lịch sử trạng thái từ mô hình.</p>}</Panel>
  <Panel title="Sụt giảm từ đỉnh" term="max_drawdown" rows={research?.drawdown} columns={[['date','Phiên'],['valuePct','Drawdown (%)']]} note="Drawdown lịch sử dùng số âm; không đại diện rủi ro tương lai.">{research?.drawdown?.length>=2&&<Drawdown data={last(research.drawdown)}/>}</Panel>
  <Panel title="Hồ sơ nhân tố" term="quant_factor" rows={research?.factors} columns={[['label','Nhân tố'],['value','Giá trị'],['min','Min'],['max','Max']]} note="Mỗi nhân tố giữ tên và miền chuẩn hóa từ backend. Không tự tổng hợp thành điểm mua.">{research?.factors?.length>=3&&<Factors data={research.factors}/>}</Panel>
  <Panel title="Rủi ro và phương án" term="risk_reward" note="R:R gộp chỉ tính khi SL < Entry < TP2; không thay thế lợi nhuận dự báo ròng."><dl className="risk-profile">{research?.riskMetrics?.map(m=><div key={m.id}><dt><TermHint id={m.id}>{m.label}</TermHint></dt><dd>{fmt(m.value)}{m.unit}</dd></div>)}<div><dt>Upside TP2</dt><dd className="up">{trade?`${fmt(trade.upsidePct)}%`:'—'}</dd></div><div><dt>Downside SL</dt><dd className="down">{trade?`${fmt(trade.downsidePct)}%`:'—'}</dd></div><div><dt>R:R gộp TP2</dt><dd>{trade?`${fmt(trade.rr)}x`:'—'}</dd></div></dl></Panel>
 </div></section>;
}
