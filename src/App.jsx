import { useEffect, useRef, useState } from 'react';
import PriceBoard from './components/PriceBoard.jsx';
import StockModal from './components/StockModal.jsx';
import QuantPanel from './components/QuantPanel.jsx';
import { demoRows } from './demo.js';
import NavIcon from './components/NavIcon.jsx';
import ScanPage from './components/ScanPage.jsx';

const pages = [['market','◫','Thị trường'],['board','▦','Bảng điện'],['sectors','◈','Nhóm ngành'],['scan','⌕','Quét toàn sàn'],['watch','☆','Theo dõi'],['quant','⌁','Phân tích Quant'],['guide','?','Hướng dẫn']];
export default function App() {
  const [open,setOpen] = useState(null);
  const [section,setSection] = useState('market');
  const [command,setCommand] = useState('');
  const [notice,setNotice] = useState('');
  const [symbol,setSymbol] = useState('FPT');
  const [theme,setTheme] = useState(()=>{try{return localStorage.getItem('qt.theme') === 'light' ? 'light' : 'dark';}catch{return 'dark';}});
  const [clock,setClock] = useState(new Date());
  const input = useRef(null);
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('qt.theme',theme);}catch{}},[theme]);
  useEffect(()=>{
    const timer=setInterval(()=>setClock(new Date()),1000);
    const key=e=>{if(e.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) && !document.querySelector('[role="dialog"]')){e.preventDefault();input.current?.focus();}};
    document.addEventListener('keydown',key);
    return ()=>{clearInterval(timer);document.removeEventListener('keydown',key);};
  },[]);
  const execute=e=>{
    e.preventDefault();const text=command.trim().toUpperCase();
    if(['WATCH','MARKET'].includes(text)){setSection(text==='WATCH'?'watch':'market');setCommand('');setNotice('');return;}
    const match=text.match(/^([A-Z0-9]{3,5})(?:\s+(Q|CHART))?$/);
    if(match){setOpen({sym:match[1],tab:match[2]==='Q'?'quant':'chart'});setCommand('');setNotice('');}
    else setNotice('Nhập mã như FPT, FPT Q, WATCH hoặc MARKET.');
  };
  const title=pages.find(p=>p[0]===section)[2];
  const subtitle={market:'Theo dõi biến động. Tìm tín hiệu. Khám phá cơ hội.',board:'Bảng điện nhiều mức giá, thanh khoản và dữ liệu theo sàn.',sectors:'So sánh các nhóm ngành trong tập dữ liệu đang xem.',scan:'Mở kết quả từ đợt phân tích đã công bố.',watch:'Tập trung vào những doanh nghiệp bạn quan tâm.',quant:'Khám phá xu hướng, dòng tiền và rủi ro theo từng mô hình.',guide:'Bắt đầu hành trình đầu tư cùng dữ liệu.'}[section];
  return <div className="app-shell">
    <aside className="sidebar"><a href="#" className="brand" onClick={e=>{e.preventDefault();setSection('market');}}><img className="brand-logo" src="/quantik-logo.jpg" alt="QuanTik" width="200" height="200"/></a><div className="nav-label">KHÔNG GIAN ĐẦU TƯ</div><nav aria-label="Điều hướng chính">{pages.map(([id,icon,label])=><button key={id} className={section===id?'active':''} aria-current={section===id?'page':undefined} onClick={()=>setSection(id)}><span aria-hidden="true"><NavIcon id={id}/></span>{label}{section===id&&<i/>}</button>)}</nav><div className="sidebar-bottom"><div className="demo-card"><span className="eyebrow">BẢN TRẢI NGHIỆM</span><b>Hiểu dữ liệu.<br/>Chủ động quyết định.</b><p>Khám phá công cụ phân tích định lượng cho cổ phiếu Việt Nam.</p><button onClick={()=>setSection('guide')}>Khám phá QuanTik ↗</button></div><div className="profile"><span>QT</span><div>Không gian cá nhân<small>Lưu theo dõi trên thiết bị</small></div></div></div></aside>
    <div className="workspace"><header className="topbar"><span className="breadcrumb">Không gian đầu tư <span>/</span> <b>{title}</b></span><div className="top-actions"><span className="demo-badge">Bản thử nghiệm</span><button className="iconbtn" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} aria-label={theme==='dark'?'Chuyển chế độ sáng':'Chuyển chế độ tối'}>{theme==='dark'?'☀':'☾'}</button><img className="avatar brand-avatar" src="/quantik-logo.jpg" alt="QuanTik" width="33" height="33"/></div></header>
    <main id="main"><div className="page-heading"><div><span className="eyebrow">VIETNAM EQUITIES / QUANTIK</span><h1>{title==='Thị trường'?'Toàn cảnh thị trường':title}</h1><p>{subtitle}</p></div><div className="session-time"><b>{clock.toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</b><span>{clock.toLocaleTimeString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'})} ICT</span></div></div>
    <form className="command-line" onSubmit={execute}><label htmlFor="command">⌕ <span>Tra cứu nhanh</span></label><input ref={input} id="command" value={command} onChange={e=>setCommand(e.target.value)} placeholder="Nhập mã cổ phiếu · FPT hoặc FPT Q" autoComplete="off" spellCheck="false"/><kbd>/</kbd><button type="submit">Mở ↗</button></form>{notice&&<p role="status" className="err">{notice}</p>}
    {(['market','watch','board','sectors'].includes(section))&&<PriceBoard section={section} onOpen={sym=>setOpen({sym,tab:'overview'})} onQuant={sym=>setOpen({sym,tab:'quant'})}/>}
    <div hidden={section!=='scan'}><ScanPage onOpen={sym=>setOpen({sym,tab:'overview'})}/></div>
    {section==='quant'&&<section className="analysis-page"><div className="analysis-toolbar"><label htmlFor="analysis-symbol">Cổ phiếu cần phân tích</label><select id="analysis-symbol" value={symbol} onChange={e=>setSymbol(e.target.value)}>{demoRows.map(r=><option key={r.sym} value={r.sym}>{r.sym} · {r.name}</option>)}</select><button className="btn ghost" onClick={()=>setOpen({sym:symbol,tab:'chart'})}>Xem biểu đồ ↗</button></div><div className="info-banner">Phân tích chạy bằng pipeline QUANT thật trên backend. Kết quả mẫu chỉ dùng để trải nghiệm giao diện.</div><QuantPanel key={symbol} sym={symbol}/></section>}
    {section==='guide'&&<div className="guide-grid">{[
      ['01','Đọc bảng giá','Giá hiển thị theo nghìn đồng, khối lượng theo cổ phiếu. Xanh là tăng, đỏ là giảm, vàng là tham chiếu, tím là trần và xanh lam là sàn.'],
      ['02','Tạo danh sách theo dõi','Bấm ngôi sao cạnh mã cổ phiếu rồi mở trang Theo dõi. Danh sách được lưu trên trình duyệt của bạn.'],
      ['03','Khám phá một cổ phiếu','Chọn dòng để xem chi tiết phía dưới. Bấm đúp, nhấn Enter hoặc chọn Xem biểu đồ để mở cửa sổ phân tích.'],
      ['04','Chạy phân tích Quant','Mở panel cạnh chart, kéo mép để thay đổi kích thước. Bấm từng mục báo cáo để mở/thu gọn. Rê vào thuật ngữ gạch chân để xem giải thích và công thức.']
    ].map(([n,t,p])=><article className="guide-card" key={n}><span>{n}</span><h2>{t}</h2><p>{p}</p></article>)}<div className="info-banner">Bảng giá lấy từ backend theo phiên đã công bố. Biểu đồ TradingView sử dụng nguồn riêng và cần kết nối Internet.</div></div>}
    <footer className="page-footer"><span>© {clock.getFullYear()} QuanTik · Quantitative insights</span><span>Dữ liệu theo phiên công bố · Không phải khuyến nghị đầu tư</span></footer></main></div>
    {open&&<StockModal key={open.sym} sym={open.sym} initialTab={open.tab} theme={theme} onClose={()=>setOpen(null)}/>}
  </div>;
}
