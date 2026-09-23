import { useEffect, useState } from 'react';
import { tone } from './Scan.jsx';
import PriceChart from './PriceChart.jsx';
import SnapshotDiagnostics from './SnapshotDiagnostics.jsx';
import Commentary from './Commentary.jsx';

export default function Detail({ symbol, go, startJob, jobs }) {
  const [remote, setRemote] = useState(null);
  const [ohlcv, setOhlcv] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setRemote(null); setOhlcv(null); setHistory(null); setError('');
    Promise.all([
      fetch(`/api/v1/scans/latest/results/${symbol}`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error('Không tìm thấy mã trong bản quét'); return r.json(); }),
      fetch(`/api/v1/scans/latest/results/${symbol}/ohlcv`, { signal: controller.signal }).then(r => r.ok ? r.json() : null),
    ]).then(([detail, prices]) => { setRemote(detail); setOhlcv(prices); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    fetch(`/api/v1/quant/jobs?symbol=${symbol}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null).then(data => setHistory(data?.items || []))
      .catch(() => {});
    return () => controller.abort();
  }, [symbol]);

  const s = remote && { ...remote, gatePass: remote.gate_pass,
    gateExplanation: remote.gate_explanation, holdPlan: remote.hold_plan,
    vniTrend: remote.vni_trend, sectorTrend: remote.sector_trend };
  if (!s && !error) return <div className="page not-found"><h1>Đang tải dữ liệu {symbol}…</h1></div>;
  if (!s) return <div className="page not-found"><h1>{error || `Không tìm thấy mã ${symbol}`}</h1><button className="primary" onClick={() => go('/scan')}>VỀ KẾT QUẢ QUÉT ↗</button></div>;
  const previous = history || jobs.filter(j => j.symbol === symbol);
  const checks = Object.entries(s.screener?.strong?.criteria || {}).slice(0, 4).map(([label, passed]) => [label, !!passed]);
  const quantAvailable = s.analysis_status === 'completed' && (ohlcv?.bars?.length || 0) >= 30;
  const quantButton = <button className="primary" disabled={!quantAvailable} onClick={() => startJob(symbol)}>{quantAvailable ? 'CHẠY PHÂN TÍCH QUANT ↗' : 'CHƯA ĐỦ ĐIỀU KIỆN QUANT'}</button>;
  return <div className="page detail-page">
    <button className="back-link" onClick={() => go('/scan')}>← Trở lại kết quả toàn sàn</button>
    <div className="detail-head"><div><div className="eyebrow">{s.exchange} / {s.sector} / {s.run_id}</div><h1><span>{s.symbol}</span> <small>{s.name}</small></h1><p>Kết quả đánh giá từ đợt đã công bố · dữ liệu đến {s.data_as_of}</p></div>{quantButton}</div>
    <div className="detail-summary"><div><span>KHUYẾN NGHỊ</span><strong className={tone(s.recommendation)}>{s.recommendation}</strong></div><div><span>ĐIỂM ĐÁNH GIÁ</span><strong>{s.score ?? '—'}<small> / 100</small></strong></div><div><span>BỘ LỌC</span><strong className={s.gatePass ? 'positive' : 'muted'}>{s.gatePass ? '✓ Đạt' : '— Chưa đạt'}</strong></div><div><span>THỜI GIAN NẮM GIỮ</span><strong>{s.holdPlan}</strong></div></div>
    <div className="detail-grid"><section className="analysis-panel"><div className="section-title"><span>01 / BIỂU ĐỒ GIÁ & KHỐI LƯỢNG</span><small>Lightweight Charts · snapshot đã công bố</small></div><div className="stock-chart">{ohlcv?.bars?.length ? <PriceChart symbol={symbol} ohlcvBars={ohlcv.bars} /> : <div className="market-api-empty">Chưa có OHLCV cho mã này.</div>}</div></section><div className="detail-side"><section className="analysis-panel"><div className="section-title"><span>02 / LUẬN ĐIỂM & KẾT LUẬN</span><small>Tổng hợp định lượng</small></div><Commentary text={s.commentary} gateExplanation={s.gateExplanation} /><div className="text-grid" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--line-soft)' }}><span>Đánh giá</span><strong>{s.rating}</strong><span>Xu hướng VN-Index</span><strong className={tone(s.vniTrend)}>{s.vniTrend}</strong><span>Xu hướng ngành</span><strong className={tone(s.sectorTrend)}>{s.sectorTrend}</strong><span>Nhóm ngành</span><strong>{s.sector}</strong></div></section><section className="analysis-panel"><div className="section-title"><span>03 / ĐIỀU KIỆN SÀNG LỌC</span><small>Snapshot đã công bố</small></div><div className="check-list">{!checks.length && <div className="empty-history">Chưa có chi tiết điều kiện sàng lọc.</div>}{checks.map(([label, passed]) => <div key={label}><span>{label}</span><strong className={passed ? 'positive' : 'negative'}>{passed ? '✓ Đạt ngưỡng' : '× Chưa đạt'}</strong></div>)}</div></section><section className="analysis-panel quant-cta"><div className="eyebrow">PHÂN TÍCH CHUYÊN SÂU</div><h2>Cần nhiều hơn một tín hiệu?</h2><p>{quantAvailable ? `Chạy mô hình QUANT và tạo biểu đồ báo cáo cho ${symbol}.` : (s.gateExplanation || 'Mã chưa đủ dữ liệu để chạy QUANT.')}</p>{quantButton}</section></div></div>
    <SnapshotDiagnostics report={s.quant} />
    <section className="history-section"><div className="section-title"><span>05 / LỊCH SỬ BÁO CÁO QUANT</span><button onClick={() => go('/quant/reports')}>Xem tất cả ↗</button></div>{previous.length ? <div className="history-list">{previous.map(j => <button key={j.id} onClick={() => go(`/quant/jobs/${j.id}`)}><span className="symbol">{symbol}</span><span>{new Date(j.createdAt || j.requested_at).toLocaleString('vi-VN')}</span><span className={j.status === 'succeeded' ? 'positive' : 'amber'}>{j.status === 'succeeded' ? 'Đã hoàn tất' : j.status === 'failed' ? 'Thất bại' : j.status === 'queued' ? 'Đang chờ xử lý' : 'Đang xử lý'}</span><span>↗</span></button>)}</div> : <p className="empty-history">Chưa có báo cáo QUANT nào cho mã này.</p>}</section>
  </div>;
}
