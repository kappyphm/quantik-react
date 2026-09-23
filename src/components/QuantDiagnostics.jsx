const pct = (value, digits = 1) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(digits)}%` : '—';
const num = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';

function DrawdownChart({ values = [] }) {
  if (!values.length) return <div className="quant-empty">Chưa có chuỗi drawdown.</div>;
  const min = Math.min(...values), range = Math.abs(min) || 1;
  const points = values.map((v, i) => `${20 + i * 560 / Math.max(1, values.length - 1)},${18 + Math.abs(v) / range * 124}`).join(' ');
  return <svg className="quant-wide-chart" viewBox="0 0 600 165" role="img" aria-label="Drawdown theo thời gian"><polygon points={`20,18 ${points} 580,18`} fill="#d06b68" opacity=".15"/><polyline points={points} fill="none" stroke="#d06b68" strokeWidth="2"/><text x="25" y="155" fill="#d06b68" fontSize="11">Max DD {pct(min)}</text></svg>;
}

function RegimeChart({ rows = [] }) {
  if (!rows.length) return <div className="quant-empty">Chưa có chuỗi HMM.</div>;
  const values = rows.map(x => x.close), low = Math.min(...values), span = Math.max(...values) - low || 1;
  const x = i => 20 + i * 560 / Math.max(1, rows.length - 1), y = v => 140 - (v - low) / span * 115;
  const colors = { BULL: '#56b68f', BEAR: '#d06b68', SIDEWAY: '#d6a44d' };
  return <svg className="quant-wide-chart" viewBox="0 0 600 165" role="img" aria-label="Đường giá với nền trạng thái HMM">{rows.map((row, i) => <rect key={i} x={x(i)} y="0" width={560 / Math.max(1, rows.length - 1) + 1} height="165" fill={colors[row.state] || '#677370'} opacity=".14"/>)}<polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#e6e5df" strokeWidth="2"/></svg>;
}

function ConeChart({ history = [], cone }) {
  if (!history.length || !cone?.p50?.length) return <div className="quant-empty">Chưa có ma trận Monte Carlo.</div>;
  const n = history.length, h = cone.p50.length, all = [...history, ...cone.p10, ...cone.p90];
  const low = Math.min(...all), span = Math.max(...all) - low || 1;
  const x = i => 20 + i * 560 / (n + h - 1), y = v => 145 - (v - low) / span * 125;
  const area = (lower, upper) => [...upper.map((v, i) => `${x(n + i)},${y(v)}`), ...lower.map((_, i) => {const j=lower.length-1-i;return `${x(n+j)},${y(lower[j])}`;})].join(' ');
  return <svg className="quant-wide-chart" viewBox="0 0 600 165" role="img" aria-label="Giá lịch sử và dải xác suất Monte Carlo"><polygon points={area(cone.p10,cone.p90)} fill="#d6a44d" opacity=".12"/><polygon points={area(cone.p25,cone.p75)} fill="#d6a44d" opacity=".25"/><polyline points={history.map((v,i)=>`${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#e6e5df" strokeWidth="2"/><polyline points={[history.at(-1),...cone.p50].map((v,i)=>`${x(n-1+i)},${y(v)}`).join(' ')} fill="none" stroke="#d6a44d" strokeWidth="2.5"/></svg>;
}

function ReturnHistogram({ data }) {
  if (!data?.counts?.length) return <div className="quant-empty">Chưa có phân phối Monte Carlo.</div>;
  const max = Math.max(...data.counts), low = data.edges[0], span = data.edges.at(-1) - low || 1;
  const x = v => 20 + (v - low) / span * 560;
  return <svg className="quant-wide-chart" viewBox="0 0 600 165" role="img" aria-label="Histogram lợi nhuận cuối kỳ Monte Carlo">{data.counts.map((count,i)=><rect key={i} x={x(data.edges[i])+1} y={145-count/max*120} width={Math.max(1,x(data.edges[i+1])-x(data.edges[i])-2)} height={count/max*120} fill={data.edges[i+1]<=0?'#d06b68':'#56b68f'} opacity=".7"/>)}{[['0%',0,'#e6e5df'],['Median',data.median,'#d6a44d'],['VaR95',data.var95,'#d06b68'],['CVaR95',data.cvar95,'#d06b68']].map(([label,value,color])=>Number.isFinite(Number(value))&&<g key={label}><line x1={x(value)} x2={x(value)} y1="18" y2="145" stroke={color} strokeDasharray="4 4"/><text x={x(value)+2} y="14" fill={color} fontSize="9">{label}</text></g>)}</svg>;
}

const testNames = { jarque_bera: 'Jarque–Bera', shapiro_wilk: 'Shapiro–Wilk', anderson_darling: 'Anderson–Darling', dagostino: 'D’Agostino', ks_test: 'Kolmogorov–Smirnov' };

export default function QuantDiagnostics({ report }) {
  if (!report) return null;
  const r = report;
  const tests = r.dist?.tests || {};
  return <div className="quant-diagnostics">
    <section className="analysis-panel quant-block"><div className="section-title"><span>01 / KIỂM ĐỊNH PHÂN PHỐI LỢI NHUẬN</span><small>DistributionAnalyzer.full_test</small></div><div className="quant-tests">{Object.entries(testNames).map(([key, label]) => { const t = tests[key]; return <div key={key}><span>{label}</span><b>{t ? (t.reject ? 'Bác bỏ chuẩn' : 'Chưa bác bỏ') : '—'}</b><small>{t?.p != null ? `p = ${num(t.p, 4)}` : t?.stat != null ? `stat ${num(t.stat)} / ngưỡng ${num(t.crit_5pct)}` : 'Chưa có dữ liệu'}</small></div>; })}</div><div className="quant-foot">Phân phối phù hợp theo AIC: <strong>{r.dist?.best_fit?.winner || '—'}</strong><span>Đuôi dày: <strong>{r.dist?.fat_tail?.severity || '—'}</strong></span></div></section>
    <section className="analysis-panel quant-block"><div className="section-title"><span>02 / HỒ SƠ RỦI RO</span><small>Risk_Profile · StatEngine</small></div><DrawdownChart values={r.charts?.drawdown?.values}/><div className="quant-metrics"><div><small>Sharpe</small><strong>{num(r.stats?.sharpe)}</strong></div><div><small>Max drawdown</small><strong>{pct(r.stats?.max_dd_pct)}</strong></div><div><small>VaR 95%</small><strong>{pct(r.stats?.VaR_95)}</strong></div><div><small>CVaR 95%</small><strong>{pct(r.stats?.CVaR_95)}</strong></div></div></section>
    <section className="analysis-panel quant-block"><div className="section-title"><span>03 / ARIMA & KIỂM ĐỊNH TÍNH DỪNG</span><small>ARIMAEngine.fit</small></div><div className="quant-chart-facts"><span>ADF p-value <b>{num(r.arima?.stationarity?.adf_p, 4)}</b></span><span>Kết luận <b>{r.arima?.stationarity?.stationary == null ? '—' : r.arima.stationarity.stationary ? 'Chuỗi lợi nhuận dừng' : 'Chưa xác nhận tính dừng'}</b></span><span>Mô hình <b>{r.arima?.best?.order || '—'}</b></span><span>AIC <b>{num(r.arima?.best?.aic, 1)}</b></span></div></section>
    <section className="analysis-panel quant-block"><div className="section-title"><span>04 / GARCH & EGARCH</span><small>GARCHEngine.fit</small></div><div className="quant-chart-facts"><span>Độ bền biến động <b>{num(r.garch?.garch?.persistence)}</b></span><span>EGARCH gamma <b>{num(r.garch?.egarch?.gamma)}</b></span><span>Chế độ hiện tại <b>{r.vol?.regime || '—'}</b></span><span>Nguồn biến động MC <b>{r.fcast?.mc?.vol_source || '—'}</b></span></div></section>
    <section className="analysis-panel quant-block"><div className="section-title"><span>05 / TRẠNG THÁI HMM</span><small>Regime</small></div><RegimeChart rows={r.charts?.regime}/><div className="quant-regimes">{Object.entries(r.hmm?.state_probs || {}).map(([state, value]) => <div key={state}><span>{state}</span><div><i style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} /></div><b>{pct(value, 0)}</b></div>)}</div></section>
    <section className="analysis-panel quant-block"><div className="section-title"><span>06 / DẢI XÁC SUẤT GIÁ</span><small>Probability_Cone</small></div><ConeChart history={r.charts?.history?.close} cone={r.charts?.probability_cone}/></section>
    <section className="analysis-panel quant-block"><div className="section-title"><span>07 / PHÂN PHỐI LỢI NHUẬN</span><small>Return_Distribution</small></div><ReturnHistogram data={r.charts?.return_distribution}/></section>
  </div>;
}
