import {useId,useState} from 'react';
import TermHint from './TermHint.jsx';
import AnnotatedText from './AnnotatedText.jsx';
import {getTerm} from '../content/glossary.js';

const groups = [
  {id:'performance',title:'Hiệu suất giá và rủi ro',metrics:['annual_return','sharpe','sortino','calmar','win_rate','max_drawdown']},
  {id:'market',title:'Biến động và dòng tiền',metrics:['volatility_regime','cmf','rsi']},
  {id:'signals',title:'Trạng thái và tín hiệu dự báo',metrics:['hmm','ensemble_return','confidence','mc_volatility']},
  {id:'risk',title:'Rủi ro và điều kiện giao dịch',metrics:['var','cvar','kurtosis','lock_drawdown','probability_loss','kelly','risk_reward','entry_quality']},
];
const formatMetric = metric => {
  if(metric?.value==null)return '—';
  if(typeof metric.value==='number')return `${metric.value.toLocaleString('vi-VN',{maximumFractionDigits:3})}${metric.unit||''}`;
  return String(metric.value);
};

export default function AnalysisReport({sym,job}) {
  const [expanded,setExpanded]=useState(['performance']);
  const uid=useId();
  // A real pipeline may supply narrative sections. Preserve those words.
  const sections=job?.reportSections?.length?job.reportSections:groups;
  const metrics=job?.metrics||[];
  const toggle=id=>setExpanded(items=>items.includes(id)?items.filter(x=>x!==id):[...items,id]);
  return <section className="analysis-report" aria-label={`Báo cáo phân tích ${sym}`}>
    <div className="report-heading"><h3>Báo cáo {sym}</h3><p>Bấm từng tiêu đề để mở/thu gọn · Rê vào thuật ngữ gạch chân để xem giải thích.</p></div>
    {sections.map((section,index)=>{
      const isOpen=expanded.includes(section.id),panelId=`${uid}-${index}`;
      return <article className="report-section" key={section.id}>
        <h4><button type="button" className="report-toggle" aria-expanded={isOpen} aria-controls={panelId} onClick={()=>toggle(section.id)}>
          <span className="report-index">{String(index+1).padStart(2,'0')}</span><span>{section.title}</span><small>{sym}</small>
          <svg className={isOpen?'expanded':''} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button></h4>
        <div id={panelId} className="report-content" hidden={!isOpen}>
          {section.text ? <p className="preserve-lines"><AnnotatedText text={section.text}/></p> : <>
            <p>{(section.metrics||[]).map((id,i)=>{
              const metric=metrics.find(m=>m.id===id),term=getTerm(id);
              return <span key={id}>{i>0?' · ':''}<TermHint id={id} parameters={metric?.parameters} methodId={metric?.methodId}>{id==='hmm'?'HMM':term?.en||id}</TermHint>{' '}<strong>{formatMetric(metric)}</strong></span>;
            })}</p>
            {section.id==='signals'&&<p className="dim"><TermHint id="quant_factor">Quant Factor</TermHint> và kết quả <TermHint id="hmm">HMM</TermHint> sẽ lấy từ pipeline của mã {sym}.</p>}
            {!metrics.some(m=>(section.metrics||[]).includes(m.id)&&m.value!=null)&&<p className="report-pending">Chưa có kết quả tính toán cho mục này. Công thức chỉ xuất hiện trong popup của thuật ngữ.</p>}
          </>}
        </div>
      </article>;
    })}
  </section>;
}
