import { useEffect, useRef, useState } from 'react';
import PriceBoard from './components/PriceBoard.jsx';
import StockModal from './components/StockModal.jsx';

export default function App() {
  const [open, setOpen] = useState(null);
  const [section, setSection] = useState('market');
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState('Nhập mã + Enter để mở biểu đồ · VD: FPT hoặc FPT Q');
  const [clock, setClock] = useState(new Date());
  const input = useRef(null);
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    const timer = setInterval(() => setClock(new Date()),1000);
    const key = e => { if(e.key === '/' && !['INPUT','TEXTAREA'].includes(e.target.tagName)) {e.preventDefault();input.current?.focus();} };
    document.addEventListener('keydown',key);
    return () => {clearInterval(timer);document.removeEventListener('keydown',key);};
  },[]);
  const execute = e => {
    e.preventDefault();
    const text = command.trim().toUpperCase();
    if(text === 'WATCH' || text === 'MARKET') {setSection(text === 'WATCH' ? 'watch' : 'market');setCommand('');return;}
    const match = text.match(/^([A-Z]{3})(?:\s+(Q|CHART))?$/);
    if(match) {setOpen({sym:match[1],tab:match[2] === 'Q' ? 'quant' : 'chart'});setCommand('');}
    else setNotice('Lệnh: FPT · FPT Q · FPT CHART · WATCH · MARKET');
  };
  return <div className="terminal">
    <header className="terminal-header"><b className="wordmark">QUANTIK<span> TERMINAL</span></b><span className="header-market">VIETNAM / EQUITIES</span><span className="header-right">DEMO DATA <time>{clock.toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'})} ICT</time></span></header>
    <nav className="function-bar" aria-label="Điều hướng"><button className={section === 'market' ? 'active' : ''} onClick={()=>setSection('market')}><b>01</b> BẢNG GIÁ</button><button className={section === 'watch' ? 'active' : ''} onClick={()=>setSection('watch')}><b>02</b> THEO DÕI</button><span>VN EQUITY MONITOR</span><span className="nav-end">LOCAL SESSION</span></nav>
    <form className="command-line" onSubmit={execute}><label htmlFor="command">COMMAND &gt;</label><input ref={input} id="command" value={command} onChange={e=>setCommand(e.target.value)} placeholder="FPT Q" autoComplete="off" spellCheck="false"/><button type="submit">GO ↵</button><span role="status">{notice}</span></form>
    <main><PriceBoard section={section} onOpen={sym=>setOpen({sym,tab:'chart'})} onQuant={sym=>setOpen({sym,tab:'quant'})}/></main>
    <footer className="terminal-footer"><span><b>QT</b> DỮ LIỆU MÔ PHỎNG / KHÔNG PHẢI GIÁ TRỰC TIẾP</span><span>[/] LỆNH &nbsp; [ENTER] CHI TIẾT &nbsp; [ESC] ĐÓNG</span></footer>
    {open && <StockModal sym={open.sym} initialTab={open.tab} theme="dark" onClose={()=>setOpen(null)}/>}
  </div>;
}
