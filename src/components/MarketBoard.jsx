import { useEffect, useRef, useState } from 'react';
import { AreaSeries, createChart } from 'lightweight-charts';
import Pagination from './Pagination.jsx';

const fmt = (value, digits = 2) => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const stamp = value => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
const change = bars => {
  const current = bars.at(-1).close;
  const previous = bars.at(-2).close;
  return { current, difference: current - previous, percent: (current / previous - 1) * 100, volume: bars.at(-1).volume };
};

function IndexChart({ bars, scale = 1 }) {
  const host = useRef(null);
  useEffect(() => {
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: 'solid', color: '#0e1417' }, textColor: '#798a88', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: '#202c2e' } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
    });
    const series = chart.addSeries(AreaSeries, { lineColor: '#71d8a5', topColor: '#71d8a53a', bottomColor: '#71d8a500', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    series.setData(bars.slice(-64).map(bar => ({ time: bar.time, value: +(bar.close * scale).toFixed(2) })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, scale]);
  return <div className="market-index-chart" ref={host} role="img" aria-label="Biểu đồ VN-Index từ Vnstock" />;
}

export default function MarketBoard() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [remote, setRemote] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let inFlight = false;
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      fetch(`/api/v1/market/overview?page=${page}&page_size=${pageSize}`, { signal: controller.signal })
        .then(async response => { if (!response.ok) throw new Error('Chưa có dữ liệu bảng điện'); return response.json(); })
        .then(data => { if (active) { setRemote(data); setError(''); } })
        .catch(e => { if (active && e.name !== 'AbortError') setError(e.message); })
        .finally(() => { inFlight = false; });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      controller.abort();
    };
  }, [page, pageSize]);
  const indexBars = remote?.index_bars || [];
  const scale = 1;
  const index = indexBars.length >= 2 ? change(indexBars) : null;
  const visible = (remote?.items || []).map(item => ({ ...item, current: item.price, difference: item.change, percent: item.change_pct }));
  const total = remote?.total || 0;
  const advances = remote?.breadth?.advances;
  const declines = remote?.breadth?.declines;
  return <section className="market-board" aria-label="Bảng điện thị trường">
    <div className="market-board-head"><div><span className="market-board-kicker">THỊ TRƯỜNG VIỆT NAM / TỔNG QUAN</span><strong>Bảng điện</strong></div><span className="market-demo-tag">{`${remote?.source === 'vnstock_price_board' ? 'VNSTOCK · BẢNG GIÁ' : 'ĐANG TẢI'} · ${stamp(remote?.as_of)}`}</span></div>
    {error && <div className="market-api-empty" role="alert">{error}{remote ? ` · đang giữ snapshot nhận lúc ${stamp(remote.as_of)}` : ''}</div>}
    {remote ? <>
    {index ? <div className="market-index"><div className="market-index-stat"><span>VN-INDEX · EOD</span><strong>{fmt(index.current * scale)}</strong><b className={index.difference >= 0 ? 'positive' : 'negative'}>{index.difference >= 0 ? '+' : ''}{fmt(index.difference * scale)} ({index.percent >= 0 ? '+' : ''}{fmt(index.percent)}%)</b></div><IndexChart bars={indexBars} scale={scale} /></div> : <div className="market-api-empty">{remote ? 'Chưa có dữ liệu VN-Index từ Vnstock.' : 'Đang tải dữ liệu VN-Index…'}</div>}
    <div className="market-breadth">{advances != null && <span><i className="up-dot"/> Tăng <strong>{advances}</strong></span>}{declines != null && <span><i className="down-dot"/> Giảm <strong>{declines}</strong></span>}<span>{total} mã · HOSE / HNX / UPCoM</span></div>
    <div className="market-board-scroll"><table className="market-board-table"><thead><tr><th>MÃ / SÀN</th><th>GIÁ</th><th>+/−</th><th>%</th><th>KL</th></tr></thead><tbody>{visible.map(row => <tr key={row.symbol}><td><strong>{row.symbol}</strong><small>{row.exchange}</small></td><td className={row.difference == null ? '' : row.difference >= 0 ? 'positive' : 'negative'}>{fmt(row.current)}</td><td className={row.difference == null ? '' : row.difference >= 0 ? 'positive' : 'negative'}>{row.difference == null ? '—' : `${row.difference >= 0 ? '+' : ''}${fmt(row.difference)}`}</td><td className={row.percent == null ? '' : row.percent >= 0 ? 'positive' : 'negative'}>{row.percent == null ? '—' : `${row.percent >= 0 ? '+' : ''}${fmt(row.percent)}%`}</td><td>{fmt(row.volume, 0)}</td></tr>)}</tbody></table></div>
    <Pagination total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
    </> : !error && <div className="market-api-empty">Đang tải bảng giá Vnstock…</div>}
    <div className="market-board-foot">Giá từ bảng giá Vnstock · thời điểm trên là lúc backend nhận snapshot · độ trễ nguồn không được nhà cung cấp công bố</div>
  </section>;
}
