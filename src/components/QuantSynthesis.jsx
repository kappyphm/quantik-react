import AnnotatedText from './AnnotatedText.jsx';

export default function QuantSynthesis({analysis,expanded=false}){
 if(!analysis)return null;
 return <section className="quant-synthesis card" aria-label="Tổng hợp và khuyến nghị">
  <div className="report-heading"><span className="eyebrow">TỔNG HỢP BẰNG CHỨNG</span><h3>Xâu chuỗi các mô hình và khuyến nghị</h3><p>Đọc cả yếu tố ủng hộ, điểm mâu thuẫn và phần còn thiếu trước khi dùng kết luận.</p></div>
  <div className="synthesis-recommendation"><h4>{analysis.headline}</h4><p><AnnotatedText text={analysis.recommendation}/></p>{!!analysis.reasons?.length&&<ul>{analysis.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul>}</div>
  <div className="synthesis-chain">{analysis.sections?.map((section,index)=><details key={section.title} open={expanded||undefined}><summary><span>{String(index+1).padStart(2,'0')}</span><b>{section.title}</b></summary><div>{section.paragraphs?.map((text,i)=><p key={i} className={i===section.paragraphs.length-1?'synthesis-link':''}><AnnotatedText text={text}/></p>)}</div></details>)}</div>
  <div className="synthesis-conditions"><h4>Điều kiện cần theo dõi để đánh giá lại</h4><ul>{analysis.conditions?.map((text,i)=><li key={i}>{text}</li>)}</ul></div>
  {!!analysis.limitations?.length&&<div className="synthesis-missing"><h4>Phần bằng chứng còn hạn chế</h4><p>{analysis.limitations.join(' · ')}</p><p>Những phần này không được tính như mô hình đã xác nhận và không được thay bằng dự báo giả.</p></div>}
  <p className="module-limit">{analysis.note}</p>
 </section>;
}
