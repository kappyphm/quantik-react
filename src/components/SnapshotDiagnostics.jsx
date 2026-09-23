const number = (value, digits = 2) => Number.isFinite(Number(value))
  ? Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits }) : '—';
const percent = (value, digits = 1) => Number.isFinite(Number(value))
  ? `${number(value, digits)}%` : '—';
const price = value => Number.isFinite(Number(value))
  ? Number(value).toLocaleString('vi-VN') : '—';

function Metric({ label, value, className = '' }) {
  return <div><small>{label}</small><strong className={className}>{value}</strong></div>;
}

export default function SnapshotDiagnostics({ report }) {
  if (!report || !Object.keys(report).length) return null;
  const quality = report.data_quality || {};
  const stats = report.stats || {};
  const forecast = report.fcast || {};
  const stop = report.sl || {};
  const warnings = [
    ...(quality.flags || []),
    ...(report.action?.reason_codes || []),
    report.hmm?.warning && report.hmm.warning !== 'On dinh' ? report.hmm.warning : null,
  ].filter(Boolean);
  return <section className="snapshot-diagnostics" aria-label="Kết quả định lượng của snapshot">
    <div className="section-title snapshot-title"><span>04 / KẾT QUẢ ĐỊNH LƯỢNG ĐÃ LƯU</span><small>QuantPipeline.batch · cùng snapshot giá</small></div>
    <div className="snapshot-grid">
      <section className="analysis-panel snapshot-block"><div className="section-title"><span>CHẤT LƯỢNG DỮ LIỆU</span><small>{quality.status || '—'}</small></div><div className="snapshot-metrics">
        <Metric label="Điểm chất lượng" value={number(quality.score, 0)} />
        <Metric label="Số phiên" value={number(quality.n_rows, 0)} />
        <Metric label="Phiên thiếu ước tính" value={percent(quality.missing_sessions_approx_pct)} />
        <Metric label="Ngày giao dịch chưa cập nhật" value={number(quality.stale_business_days, 0)} />
      </div></section>
      <section className="analysis-panel snapshot-block"><div className="section-title"><span>THỐNG KÊ & RỦI RO</span><small>{stats.metric_scope || 'DAILY RETURNS'}</small></div><div className="snapshot-metrics">
        <Metric label="Lợi nhuận năm" value={percent(stats.ann_return_pct)} />
        <Metric label="Biến động năm" value={percent(stats.ann_vol_pct)} />
        <Metric label="Sharpe" value={number(stats.sharpe)} />
        <Metric label="Max drawdown" value={percent(stats.max_dd_pct)} className="negative" />
        <Metric label="VaR 95%" value={percent(stats.VaR_95)} />
        <Metric label="CVaR 95%" value={percent(stats.CVaR_95)} />
      </div></section>
      <section className="analysis-panel snapshot-block"><div className="section-title"><span>DỰ BÁO TỔNG HỢP</span><small>{forecast.hold_plan_label || '—'}</small></div><div className="snapshot-metrics">
        <Metric label="Hướng" value={forecast.ensemble_direction || forecast.consensus || '—'} />
        <Metric label="Lợi nhuận dự báo" value={percent(forecast.ensemble_ret_pct)} />
        <Metric label="Độ đồng thuận" value={percent(forecast.agreement_pct)} />
        <Metric label="Độ phủ mô hình" value={percent(forecast.coverage_pct)} />
        <Metric label="Giá hiện tại" value={price(forecast.last_price)} />
        <Metric label="Giá dự báo" value={price(forecast.ensemble_price)} />
      </div></section>
      <section className="analysis-panel snapshot-block"><div className="section-title"><span>MÔ HÌNH</span><small>ARIMA · GARCH · HMM</small></div><div className="snapshot-facts">
        <span>ARIMA <b>{report.arima?.best?.order || '—'}</b></span>
        <span>ADF p-value <b>{number(report.arima?.stationarity?.adf_p, 4)}</b></span>
        <span>GARCH persistence <b>{number(report.garch?.garch?.persistence, 4)}</b></span>
        <span>Chế độ HMM <b>{report.hmm?.current || '—'} · {percent(report.hmm?.prob_pct)}</b></span>
      </div></section>
      <section className="analysis-panel snapshot-block"><div className="section-title"><span>KẾ HOẠCH RỦI RO</span><small>{stop.settlement || '—'}</small></div><div className="snapshot-metrics">
        <Metric label="Giá tham chiếu" value={price(stop.entry)} />
        <Metric label="Dừng lỗ" value={price(stop.sl_swing)} />
        <Metric label="Mục tiêu 1" value={price(stop.tp1)} />
        <Metric label="Mục tiêu 2" value={price(stop.tp2)} />
        <Metric label="R:R mục tiêu" value={number(stop.rr_optimal)} />
        <Metric label="Rủi ro khóa T+2" value={stop.lock_risk_flag == null ? '—' : stop.lock_risk_flag ? 'Có' : 'Không'} />
      </div></section>
      <section className="analysis-panel snapshot-block"><div className="section-title"><span>CẢNH BÁO & ĐIỀU KIỆN</span><small>{report.action?.executable ? 'CÓ THỂ THỰC THI' : 'CHƯA THỂ THỰC THI'}</small></div>{warnings.length
        ? <ul className="snapshot-warnings">{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
        : <p className="snapshot-clear">Không có cảnh báo chất lượng hoặc điều kiện bổ sung.</p>}</section>
    </div>
  </section>;
}
