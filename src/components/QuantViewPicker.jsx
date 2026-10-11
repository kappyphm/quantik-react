import {useEffect,useRef} from 'react';
import {useDialogExit} from '../motion.js';

export default function QuantViewPicker({symbol,onChoose,onClose}) {
  const {leaving,dismiss}=useDialogExit(onClose);
  const host=useRef(null);
  useEffect(()=>{
    const previous=document.activeElement;
    host.current?.querySelector('button')?.focus();
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}
      if(e.key==='Tab'){
        const buttons=[...host.current.querySelectorAll('button')];
        const first=buttons[0],last=buttons.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key,true);
    return()=>{document.removeEventListener('keydown',key,true);previous?.isConnected&&previous.focus();};
  },[dismiss]);
  return <div className={`scrim quant-picker-scrim ${leaving?'motion-leaving':''}`} onMouseDown={e=>e.target===e.currentTarget&&dismiss()}>
    <section ref={host} className="quant-picker card" role="dialog" aria-modal="true" aria-labelledby="quant-view-title">
      <div className="quant-picker-heading"><h2 id="quant-view-title">Phân tích Quant {symbol}</h2><button className="iconbtn" aria-label="Đóng lựa chọn cách xem" onClick={dismiss}>×</button></div>
      <p>Chọn không gian xem báo cáo và từng mô hình.</p>
      <div className="quant-view-options">
        <button className="quant-view-option" onClick={()=>onChoose('sidebar')}><b>01 · Thanh bên chart</b><span>Đối chiếu biểu đồ giá với báo cáo Quant trong cửa sổ cổ phiếu.</span></button>
        <button className="quant-view-option" onClick={()=>onChoose('page')}><b>02 · Trang toàn màn hình</b><span>Xem toàn bộ model, nguồn dữ liệu, giải thích và kết quả từng module.</span></button>
      </div>
    </section>
  </div>;
}
