import { useEffect, useState } from 'react';
import Home from './components/Home.jsx';
import Scan from './components/Scan.jsx';
import Detail from './components/Detail.jsx';
import { JobDetail, Reports } from './components/Jobs.jsx';
import Admin from './components/Admin.jsx';

function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = next => {
    if (next !== window.location.pathname) window.history.pushState({}, '', next);
    setPath(next);
    window.scrollTo(0, 0);
  };
  return [path, go];
}

const toJob = row => ({ ...row, createdAt: Date.parse(row.requested_at), id: row.job_id || row.id });
export default function App() {
  const [path, go] = usePath();
  const [jobs, setJobs] = useState([]);
  const [apiReady, setApiReady] = useState(false);
  const [connection, setConnection] = useState('loading');
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/v1/session', { method: 'POST', credentials: 'same-origin' })
      .then(response => { if (!response.ok) throw new Error('API chưa sẵn sàng'); return fetch('/api/v1/quant/jobs', { credentials: 'same-origin' }); })
      .then(response => { if (!response.ok) throw new Error('Không mở được phiên API'); return response.json(); })
      .then(data => { if (active) { setApiReady(true); setConnection('api'); setJobs((data.items || []).map(toJob)); } })
      .catch(() => { if (active) setConnection('offline'); });
    return () => { active = false; };
  }, []);

  const startJob = async symbol => {
    try {
      setApiError('');
      const response = await fetch('/api/v1/quant/jobs', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, include_backtest: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail?.message || data.detail || 'Không tạo được job');
      setJobs(old => [{ id: data.job_id, symbol, createdAt: Date.now(), status: 'queued' }, ...old]);
      go(`/quant/jobs/${data.job_id}`);
    } catch (error) {
      setApiError(error.message);
    }
  };

  const route = connection === 'loading' ? <div className="page not-found"><h1>Đang kết nối API…</h1></div>
    : connection === 'offline' ? <div className="page not-found"><h1>Không kết nối được backend.</h1><p>Khởi động API tại cổng 8000 rồi tải lại trang.</p><button className="primary" onClick={() => window.location.reload()}>THỬ LẠI ↗</button></div>
    : path === '/' ? <Home go={go} apiReady={apiReady} />
    : path === '/scan' ? <Scan go={go} apiReady={apiReady} />
    : path.startsWith('/stocks/') ? <Detail symbol={decodeURIComponent(path.split('/')[2]).toUpperCase()} go={go} startJob={startJob} jobs={jobs} apiReady={apiReady} />
    : path.startsWith('/quant/jobs/') ? <JobDetail id={path.split('/')[3]} jobs={jobs} go={go} apiReady={apiReady} startJob={startJob} />
    : path === '/quant/reports' ? <Reports jobs={jobs} go={go} apiReady={apiReady} />
    : path === '/admin' ? <Admin />
    : <div className="page not-found"><h1>Không có dữ liệu cho đường dẫn này.</h1><button className="primary" onClick={() => go('/scan')}>VỀ KẾT QUẢ QUÉT ↗</button></div>;

  return <div className="app-shell"><header className="site-header"><button className="brand" onClick={() => go('/')} aria-label="QuanTik — trang chủ"><span className="brand-mark">Q<span>↗</span></span><span>QUANTIK<small>MARKET INTELLIGENCE</small></span></button><nav aria-label="Điều hướng chính"><button className={path === '/' ? 'selected' : ''} onClick={() => go('/')}>Tổng quan</button><button className={path === '/scan' ? 'selected' : ''} onClick={() => go('/scan')}>Quét toàn sàn</button><button className={path.startsWith('/quant/') ? 'selected' : ''} onClick={() => go('/quant/reports')}>Báo cáo của tôi {jobs.length > 0 && <i>{jobs.length}</i>}</button><button className={path === '/admin' ? 'selected' : ''} onClick={() => go('/admin')}>Quản trị</button></nav><span className="header-demo"><span className="live-dot" /> {connection === 'api' ? 'API · KẾT NỐI' : connection === 'loading' ? 'ĐANG KẾT NỐI' : 'API OFFLINE'}</span></header>{apiError && <div className="api-error" role="alert">{apiError} <button onClick={() => setApiError('')}>×</button></div>}<main>{route}</main><footer className="site-footer"><span>© 2026 QUANTIK</span><span>Dữ liệu theo nguồn và thời điểm hiển thị · không phải khuyến nghị đầu tư</span><span>VIETNAM / EQUITIES</span></footer></div>;
}
