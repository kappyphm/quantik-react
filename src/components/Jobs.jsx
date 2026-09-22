import { useEffect, useState } from 'react';
import QuantDiagnostics from './QuantDiagnostics.jsx';
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
  return <section className="report-section"><div className="section-title"><span>BÁO CÁO QUANT / {symbol}</span><small>{r.analysis_mode === 'synthetic_demo' ? 'BÁO CÁO MINH HỌA · KHÔNG CHẠY QUANT-CORE' : 'PHÂN TÍCH QUANT-CORE'} · DỮ LIỆU ĐẾN {r.as_of}</small></div><div className="report-hero"><div><span>ĐIỂM QUANT</span><strong>{r.score ?? '—'}<small> / 100</small></strong></div><div><span>QUYẾT ĐỊNH</span><strong>{r.action || '—'}</strong></div><div><span>ĐÁNH GIÁ</span><strong>{r.rating || '—'}</strong></div><div><span>LỢI NHUẬN DỰ BÁO</span><strong>{r.fcast?.ensemble_ret_pct ?? '—'}%</strong></div></div><QuantDiagnostics report={r} /><Backtest result={r.backtest} /><div className="quant-artifacts">{r.chart_manifest?.map(item => <a key={item.id} href={item.url} target="_blank" rel="noreferrer">Biểu đồ {item.kind} ↗</a>)}</div></section>;
}

export function JobDetail({ id, go }) {
  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState('');
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
  if (!job) return <div className="page not-found"><h1>{loadError || 'Đang tải job…'}</h1><button className="primary" onClick={() => go('/quant/reports')}>XEM LỊCH SỬ ↗</button></div>;
  const p = { status: job.status, phase: job.phase, pct: job.progress_pct,
    label: labels[job.phase] || job.phase, step: Math.max(0, phaseOrder.indexOf(job.phase)) };
  return <div className="page job-page"><button className="back-link" onClick={() => go(`/stocks/${job.symbol}`)}>← Trở lại {job.symbol}</button><div className="page-heading"><div><div className="eyebrow">QUANT JOB / {job.id}</div><h1>Phân tích <span>{job.symbol}</span></h1><p>{job.symbol} · Tạo lúc {fmt(job.requested_at)}</p></div><span className={`job-status ${p.status === 'succeeded' ? 'complete' : ''}`}>{p.status === 'succeeded' ? '✓ HOÀN TẤT' : p.status === 'failed' ? '× THẤT BẠI' : p.status === 'cancelled' ? 'ĐÃ HỦY' : p.status === 'queued' ? '◷ ĐANG CHỜ' : '◉ ĐANG XỬ LÝ'}</span></div><div className="job-grid"><section className="analysis-panel progress-panel"><div className="section-title"><span>TIẾN ĐỘ PHÂN TÍCH</span><small>TỪ WORKER · SSE</small></div><div className="progress-number">{p.pct}<span>%</span></div><div className="progress-track"><i style={{ width: `${p.pct}%` }} /></div><p role="status" aria-live="polite">{job.error || p.label}</p><div className="phase-list">{phases.map(([key, label], index) => { const done = p.status === 'succeeded' || p.step > phaseOrder.indexOf(key), current = !done && p.phase === key; return <div className={done ? 'finished' : current ? 'current' : ''} key={key}><span>{String(index + 1).padStart(2, '0')}</span><b>{label}</b><small>{done ? '✓' : current ? 'Đang chạy' : 'Chờ'}</small></div>; })}</div></section><aside className="analysis-panel job-aside"><div className="section-title"><span>THÔNG TIN TÁC VỤ</span></div><div className="text-grid"><span>Mã</span><strong>{job.symbol}</strong><span>Job ID</span><strong>{job.id}</strong><span>Bắt đầu</span><strong>{fmt(job.requested_at)}</strong><span>Nguồn tham chiếu</span><strong>{job.reference_run_id || 'Bản quét đã công bố'}</strong><span>Kiểm định phân phối</span><strong>Trong báo cáo Python</strong></div><p className="info-note">Bạn có thể rời trang và mở lại từ “Báo cáo của tôi”. Tiến độ và kết quả được lưu trên server.</p></aside></div>{p.status === 'succeeded' && <LiveQuantReport symbol={job.symbol} jobId={job.id} />}</div>;
}

export function Reports({ jobs, go }) {
  const [remote, setRemote] = useState(null);
  useEffect(() => { fetch('/api/v1/quant/jobs').then(r => r.json()).then(data => setRemote(data.items || [])).catch(() => {}); }, []);
  const list = remote || jobs;
  return <div className="page reports-page"><div className="page-heading"><div><div className="eyebrow">QUANT / LỊCH SỬ CÁ NHÂN</div><h1>Báo cáo <span>của tôi</span></h1><p>Job và báo cáo được lưu trên server để bạn quay lại xem.</p></div><span className="demo-label">SERVER</span></div><section className="analysis-panel"><div className="section-title"><span>DANH SÁCH JOB</span><small>{list.length} tác vụ</small></div>{list.length ? <div className="report-list">{[...list].sort((a, b) => (b.createdAt || Date.parse(b.requested_at)) - (a.createdAt || Date.parse(a.requested_at))).map(j => <button key={j.id} onClick={() => go(`/quant/jobs/${j.id}`)}><b className="symbol">{j.symbol}</b><span>{j.id}</span><span>{fmt(j.createdAt || j.requested_at)}</span><span className={j.status === 'succeeded' ? 'positive' : 'amber'}>{j.status === 'succeeded' ? 'Đã hoàn tất' : labels[j.phase] || j.phase}</span><span>↗</span></button>)}</div> : <div className="no-results">Chưa có job nào. <button onClick={() => go('/scan')}>Xem kết quả quét toàn sàn ↗</button></div>}</section></div>;
}
