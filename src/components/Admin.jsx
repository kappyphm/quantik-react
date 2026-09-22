import { useEffect, useState } from 'react';
import './admin.css';

const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const stamp = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';

export default function Admin() {
  const [key, setKey] = useState('');
  const [verified, setVerified] = useState(false);
  const [runs, setRuns] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [audit, setAudit] = useState([]);
  const [slot, setSlot] = useState('MANUAL');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = async (path, options = {}) => {
    const response = await fetch(`/api/v1/admin/${path}`, {
      ...options,
      headers: { 'X-Admin-Key': key, 'Content-Type': 'application/json', ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail?.message || data.detail || `HTTP ${response.status}`);
    return data;
  };
  const refresh = async () => {
    const [runData, jobData, auditData] = await Promise.all([
      request('scan-runs'), request('jobs'), request('audit'),
    ]);
    setRuns(runData.items || []);
    setJobs(jobData.items || []);
    setAudit(auditData.items || []);
  };
  const unlock = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try { await request('session'); await refresh(); setVerified(true); }
    catch (reason) { setError(reason.message); setVerified(false); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!verified) return undefined;
    const timer = setInterval(() => refresh().catch(reason => setError(reason.message)), 10000);
    return () => clearInterval(timer);
  }, [verified, key]);
  const runAction = async (path, body) => {
    setBusy(true); setError('');
    try {
      await request(path, { method: 'POST', body: JSON.stringify(body || {}) });
      await refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  const create = event => { event.preventDefault(); runAction('scan-runs', { slot, trading_date: date }); };
  const rerun = run => runAction('scan-runs', { slot: run.slot, trading_date: run.trading_date, rerun_of: run.id });

  return <div className="page admin-page">
    <div className="page-heading"><div><div className="eyebrow">VẬN HÀNH / QUẢN TRỊ</div><h1>Trạng thái <span>hệ thống</span></h1><p>Theo dõi bản quét, hàng đợi và thao tác quản trị.</p></div></div>
    {!verified ? <form className="admin-unlock" onSubmit={unlock}><label>Khóa quản trị
      <input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} required />
    </label><button className="primary" disabled={busy}>MỞ BẢNG QUẢN TRỊ ↗</button><small>Khóa chỉ giữ trong bộ nhớ của trang này.</small></form> : <>
      <div className="admin-toolbar"><form onSubmit={create}><label>Slot <select value={slot} onChange={event => setSlot(event.target.value)}><option>MANUAL</option><option>PRE_OPEN</option><option>POST_CLOSE</option></select></label><label>Ngày giao dịch <input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><button className="primary" disabled={busy}>TẠO LƯỢT QUÉT ↗</button></form><button onClick={() => refresh().catch(reason => setError(reason.message))}>LÀM MỚI</button></div>
      <section className="analysis-panel"><div className="section-title"><span>LƯỢT QUÉT</span><small>{runs.length} lượt gần nhất</small></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Ngày / slot</th><th>Trạng thái</th><th>Độ phủ</th><th>Bắt đầu</th><th>Dữ liệu đến</th><th>Lỗi</th><th></th></tr></thead><tbody>{runs.map(run => <tr key={run.id}><td><b>{run.trading_date}</b><small>{run.slot} · lần {run.attempt}</small><small>{run.id}</small></td><td>{run.status}<small>{run.job_phase || '—'} · {run.progress_pct ?? 0}%</small></td><td>{run.analyzed_count}/{run.universe_count} · lỗi {run.failed_count}</td><td>{stamp(run.started_at)}</td><td>{run.data_as_of || '—'}</td><td className="admin-error">{run.error || '—'}</td><td>{['failed', 'published'].includes(run.status) && <button disabled={busy} onClick={() => rerun(run)}>CHẠY LẠI</button>}</td></tr>)}</tbody></table></div></section>
      <section className="analysis-panel"><div className="section-title"><span>HÀNG ĐỢI</span><small>{jobs.length} job gần nhất</small></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Loại / mã</th><th>Trạng thái</th><th>Tiến độ</th><th>Yêu cầu</th><th>Lỗi</th><th></th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td><b>{job.kind} {job.symbol || ''}</b><small>{job.id}</small></td><td>{job.status}</td><td>{job.phase} · {job.progress_pct}%</td><td>{stamp(job.requested_at)}</td><td className="admin-error">{job.error || '—'}</td><td>{job.kind === 'quant' && job.status === 'failed' && <button disabled={busy} onClick={() => runAction(`jobs/${job.id}/retry`)}>CHẠY LẠI</button>}</td></tr>)}</tbody></table></div></section>
      <section className="analysis-panel"><div className="section-title"><span>NHẬT KÝ QUẢN TRỊ</span></div><div className="admin-audit">{audit.map(item => <div key={item.id}><b>{item.action}</b><span>{item.target_id}</span><span>{stamp(item.created_at)}</span></div>)}</div></section>
    </>}
    {error && <p className="admin-message" role="alert">{error}</p>}
  </div>;
}
