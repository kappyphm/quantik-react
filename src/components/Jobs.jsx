import { useEffect, useState } from 'react';
import QuantDiagnostics from './QuantDiagnostics.jsx';
import Pagination from './Pagination.jsx';
import './backtest.css';

const fmt = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
const labels = { queued: 'Đang chờ worker', starting: 'Đang khởi tạo', fetch: 'Thu thập dữ liệu giá và thị trường',
  quality: 'Kiểm tra chất lượng dữ liệu', models: 'Chạy các mô hình định lượng',
  quantifying: 'Chạy QUANT toàn sàn', cross_sectional: 'Mô hình cross-sectional', scoring: 'Chấm điểm toàn sàn',
  validating: 'Kiểm tra điều kiện công bố', collecting: 'Thu thập OHLCV toàn sàn', universe: 'Chốt universe theo sàn',
  risk: 'Đánh giá rủi ro và tín hiệu', visual: 'Tạo báo cáo và biểu đồ',
  done: 'Hoàn tất báo cáo', failed: 'Phân tích thất bại', cancelled: 'Đã hủy' };
const phases = [['fetch', labels.fetch], ['models', labels.models], ['risk', labels.risk],
  ['visual', labels.visual], ['done', labels.done]];
const phaseOrder = ['queued', 'starting', ...phases.map(([key]) => key)];

function Backtest({ result }) {
  if (!result) return null;
  return <section className="analysis-panel backtest-panel"><div className="section-title"><span>KIỂM ĐỊNH KHUYẾN NGHỊ ĐÃ CÔNG BỐ</span><small>{result.status === 'completed' ? `${result.sample_size} mẫu · ${result.horizon_sessions} phiên` : 'CHƯA ĐỦ LỊCH SỬ'}</small></div>{result.status === 'completed' ? <div className="backtest-metrics"><div><small>TỶ LỆ THẮNG</small><strong>{result.win_rate_pct}%</strong></div><div><small>LỢI NHUẬN TB</small><strong>{result.average_return_pct}%</strong></div><div><small>TRUNG VỊ</small><strong>{result.median_return_pct}%</strong></div><div><small>TỆ NHẤT</small><strong>{result.worst_return_pct}%</strong></div></div> : <p>{result.reason}</p>}<p className="quant-caption">Đo từ giá đóng cửa phiên kế tiếp đến sau {result.horizon_sessions} phiên, trừ {result.round_trip_cost_pct ?? 0}% chi phí khứ hồi. Chỉ dùng tín hiệu MUA từ snapshot đã công bố.</p></section>;
}

function LiveQuantReport({ symbol, jobId }) {
  const [state, setState] = useState({ loading: true, report: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, report: null, error: '' });
    fetch(`/api/v1/quant/reports/${jobId}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.detail?.message || body.detail || `HTTP ${response.status}`);
        }
        return response.json();
      }).then(report => setState({ loading: false, report, error: '' }))
      .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, report: null, error: error.message }); });
    return () => controller.abort();
  }, [jobId]);
  if (state.loading) return <section className="analysis-panel quant-live-state" role="status">Đang tải báo cáo {symbol}…</section>;
  if (state.error) return <section className="analysis-panel quant-live-state" role="alert">Không lấy được báo cáo QUANT: {state.error}</section>;
  const r = state.report;
  const artifacts = r.chart_manifest || [];
  const visualErrors = Object.entries(r.visual_errors || {});
  return <section className="report-section"><div className="section-title"><span>BÁO CÁO QUANT / {symbol}</span><small>PHÂN TÍCH QUANT-CORE · DỮ LIỆU ĐẾN {r.as_of}</small></div><div className="report-hero"><div><span>ĐIỂM QUANT</span><strong>{r.score ?? '—'}<small> / 100</small></strong></div><div><span>QUYẾT ĐỊNH</span><strong>{r.action || '—'}</strong></div><div><span>ĐÁNH GIÁ</span><strong>{r.rating || '—'}</strong></div><div><span>LỢI NHUẬN DỰ BÁO</span><strong>{r.fcast?.ensemble_ret_pct ?? '—'}%</strong></div></div><QuantDiagnostics report={r} /><Backtest result={r.backtest} />
    <section className="analysis-panel artifact-section"><div className="section-title"><span>BỘ BIỂU ĐỒ TỪ WORKER</span><small>{artifacts.length} biểu đồ</small></div>{artifacts.length
      ? <div className="quant-artifacts">{artifacts.map(item => <figure key={item.id}><a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={`Biểu đồ ${item.kind} của ${symbol}`} loading="lazy" /><figcaption>{item.kind} ↗</figcaption></a></figure>)}</div>
      : <p className="quant-caption">Worker không tạo được artifact hình ảnh cho báo cáo này.</p>}
      {visualErrors.length > 0 && <div className="artifact-errors" role="status"><strong>Biểu đồ bị bỏ qua</strong>{visualErrors.map(([kind, reason]) => <span key={kind}>{kind}: {String(reason)}</span>)}</div>}
    </section>
  </section>;
}

export function JobDetail({ id, go, startJob }) {
  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let stream;
    const refresh = () => fetch(`/api/v1/quant/jobs/${id}`)
      .then(async r => { if (!r.ok) throw new Error('Không tìm thấy job'); return r.json(); })
      .then(data => { if (active) { setJob(data); setLoadError(''); if (['succeeded', 'failed', 'cancelled'].includes(data.status)) stream?.close(); } })
      .catch(e => { if (active) setLoadError(e.message); });
    refresh();
    const timer = setInterval(refresh, 5000);
    stream = new EventSource(`/api/v1/quant/jobs/${id}/events`);
    const onProgress = event => {
      const data = JSON.parse(event.data);
      setJob(old => old && ({ ...old, phase: data.phase, progress_pct: data.progress_pct,
        status: event.type === 'job.succeeded' ? 'succeeded' : event.type === 'job.failed' ? 'failed' : old.status }));
      if (event.type !== 'job.progress') { stream.close(); refresh(); }
    };
    ['job.progress', 'job.succeeded', 'job.failed', 'job.cancelled'].forEach(name => stream.addEventListener(name, onProgress));
    return () => { active = false; clearInterval(timer); stream.close(); };
  }, [id]);
  const cancelJob = async () => {
    setActionBusy(true); setActionError('');
    try {
      const response = await fetch(`/api/v1/quant/jobs/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail?.message || data.detail || 'Không hủy được job');
      setJob(old => ({ ...old, status: 'cancelled', phase: 'cancelled', finished_at: new Date().toISOString() }));
    } catch (error) { setActionError(error.message); }
    finally { setActionBusy(false); }
  };
  if (!job) return <div className="page not-found"><h1>{loadError || 'Đang tải job…'}</h1><button className="primary" onClick={() => go('/quant/reports')}>XEM LỊCH SỬ ↗</button></div>;
  const p = { status: job.status, phase: job.phase, pct: job.progress_pct,
    label: labels[job.phase] || job.phase, step: Math.max(0, phaseOrder.indexOf(job.phase)) };
  return <div className="page job-page"><button className="back-link" onClick={() => go(`/stocks/${job.symbol}`)}>← Trở lại {job.symbol}</button><div className="page-heading"><div><div className="eyebrow">QUANT JOB / {job.id}</div><h1>Phân tích <span>{job.symbol}</span></h1><p>{job.symbol} · Tạo lúc {fmt(job.requested_at)}</p></div><div className="job-head-actions"><span className={`job-status ${p.status === 'succeeded' ? 'complete' : ''}`}>{p.status === 'succeeded' ? '✓ HOÀN TẤT' : p.status === 'failed' ? '× THẤT BẠI' : p.status === 'cancelled' ? 'ĐÃ HỦY' : p.status === 'queued' ? '◷ ĐANG CHỜ' : '◉ ĐANG XỬ LÝ'}</span>{p.status === 'queued' && <button disabled={actionBusy} onClick={cancelJob}>HỦY JOB</button>}{p.status === 'failed' && <button className="primary" disabled={actionBusy} onClick={() => startJob(job.symbol)}>CHẠY LẠI ↗</button>}</div></div>{actionError && <p className="admin-message" role="alert">{actionError}</p>}<div className="job-grid"><section className="analysis-panel progress-panel"><div className="section-title"><span>TIẾN ĐỘ PHÂN TÍCH</span><small>TỪ WORKER · SSE</small></div><div className="progress-number">{p.pct}<span>%</span></div><div className="progress-track"><i style={{ width: `${p.pct}%` }} /></div><p role="status" aria-live="polite">{job.error || p.label}</p><div className="phase-list">{phases.map(([key, label], index) => { const done = p.status === 'succeeded' || p.step > phaseOrder.indexOf(key), current = !done && p.phase === key; return <div className={done ? 'finished' : current ? 'current' : ''} key={key}><span>{String(index + 1).padStart(2, '0')}</span><b>{label}</b><small>{done ? '✓' : current ? 'Đang chạy' : 'Chờ'}</small></div>; })}</div></section><aside className="analysis-panel job-aside"><div className="section-title"><span>THÔNG TIN TÁC VỤ</span></div><div className="text-grid"><span>Mã</span><strong>{job.symbol}</strong><span>Job ID</span><strong>{job.id}</strong><span>Bắt đầu</span><strong>{fmt(job.requested_at)}</strong><span>Nguồn tham chiếu</span><strong>{job.reference_run_id || 'Bản quét đã công bố'}</strong><span>Kiểm định phân phối</span><strong>Trong báo cáo Python</strong></div><p className="info-note">Bạn có thể rời trang và mở lại từ “Báo cáo của tôi”. Tiến độ và kết quả được lưu trên server.</p></aside></div>{p.status === 'succeeded' && <LiveQuantReport symbol={job.symbol} jobId={job.id} />}</div>;
}

export function Reports({ jobs, go }) {
  const blank = { symbol: '', status: '', dateFrom: '', dateTo: '' };
  const [filters, setFilters] = useState(blank);
  const [query, setQuery] = useState(blank);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [remote, setRemote] = useState({ items: null, total: 0, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (query.symbol) params.set('symbol', query.symbol.trim().toUpperCase());
    if (query.status) params.set('status', query.status);
    if (query.dateFrom) params.set('date_from', query.dateFrom);
    if (query.dateTo) params.set('date_to', query.dateTo);
    setRemote(old => ({ ...old, loading: true, error: '' }));
    fetch(`/api/v1/quant/jobs?${params}`, { credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail?.message || body.detail || `HTTP ${response.status}`);
        return body;
      })
      .then(data => setRemote({ items: data.items || [], total: data.total || 0, loading: false, error: '' }))
      .catch(error => { if (error.name !== 'AbortError') setRemote(old => ({ ...old, loading: false, error: error.message })); });
    return () => controller.abort();
  }, [query, page, pageSize]);
  const list = remote.items ?? jobs;
  const apply = event => { event.preventDefault(); setPage(1); setQuery({ ...filters }); };
  const reset = () => { setFilters(blank); setQuery(blank); setPage(1); };
  return <div className="page reports-page"><div className="page-heading"><div><div className="eyebrow">QUANT / LỊCH SỬ CÁ NHÂN</div><h1>Báo cáo <span>của tôi</span></h1><p>Job và báo cáo được lưu trên server để bạn quay lại xem.</p></div><span className="demo-label">SERVER</span></div><section className="analysis-panel"><div className="section-title"><span>DANH SÁCH JOB</span><small>{remote.total} tác vụ phù hợp</small></div>
    <form className="report-filters" onSubmit={apply}><label>MÃ CỔ PHIẾU<input value={filters.symbol} maxLength="5" placeholder="FPT" onChange={event => setFilters(old => ({ ...old, symbol: event.target.value.toUpperCase() }))} /></label><label>TRẠNG THÁI<select value={filters.status} onChange={event => setFilters(old => ({ ...old, status: event.target.value }))}><option value="">Tất cả</option><option value="queued">Đang chờ</option><option value="running">Đang xử lý</option><option value="succeeded">Hoàn tất</option><option value="failed">Thất bại</option><option value="cancelled">Đã hủy</option></select></label><label>TỪ NGÀY<input type="date" value={filters.dateFrom} onChange={event => setFilters(old => ({ ...old, dateFrom: event.target.value }))} /></label><label>ĐẾN NGÀY<input type="date" min={filters.dateFrom || undefined} value={filters.dateTo} onChange={event => setFilters(old => ({ ...old, dateTo: event.target.value }))} /></label><button className="primary" type="submit">LỌC</button><button type="button" onClick={reset}>ĐẶT LẠI</button></form>
    {remote.error && <p className="admin-message" role="alert">Không tải được lịch sử: {remote.error}</p>}{remote.loading && remote.items === null ? <div className="no-results" role="status">Đang tải lịch sử job…</div> : list.length ? <><div className="report-list">{list.map(j => <button key={j.id} onClick={() => go(`/quant/jobs/${j.id}`)}><b className="symbol">{j.symbol}</b><span>{j.id}</span><span>{fmt(j.createdAt || j.requested_at)}</span><span className={j.status === 'succeeded' ? 'positive' : j.status === 'failed' ? 'negative' : 'amber'}>{j.status === 'succeeded' ? 'Đã hoàn tất' : labels[j.phase] || j.phase}</span><span>↗</span></button>)}</div><Pagination total={remote.total} page={page} pageSize={pageSize} itemLabel="tác vụ" onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></> : <div className="no-results">Không có job phù hợp. <button onClick={() => go('/scan')}>Xem kết quả quét toàn sàn ↗</button></div>}</section></div>;
}
