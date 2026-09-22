import { useEffect, useMemo, useRef, useState } from 'react';
import { AreaSeries, createChart } from 'lightweight-charts';
import { stocks } from '../demo.js';
import { demoBars } from '../demoPrices.js';
import Pagination from './Pagination.jsx';

const fmt = (value, digits = 2) => value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const change = bars => {
  const current = bars.at(-1).close;
  const previous = bars.at(-2).close;
  return { current, difference: current - previous, percent: (current / previous - 1) * 100, volume: bars.at(-1).volume };
};

function IndexChart({ bars, scale = 14.2, isDemo = false }) {
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
  return <div className="market-index-chart" ref={host} role="img" aria-label={isDemo ? 'Biểu đồ VN-Index minh họa bằng dữ liệu giả lập' : 'Biểu đồ VN-Index từ bản quét đã công bố'} />;
}

export default function MarketBoard({ apiReady = false }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [remote, setRemote] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!apiReady) return;
    const controller = new AbortController();
    fetch(`/api/v1/market/overview?page=${page}&page_size=${pageSize}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Chưa có dữ liệu bảng điện'); return response.json(); })
      .then(data => { setRemote(data); setError(''); })
      .catch(e => { if (e.name !== 'AbortError') { setRemote(null); setError(e.message); } });
    return () => controller.abort();
  }, [apiReady, page, pageSize]);
  const demoIndexBars = useMemo(() => demoBars('VNINDEX', 72), []);
  const indexBars = apiReady ? remote?.index_bars || [] : demoIndexBars;
  const scale = apiReady ? 1 : 14.2;
  const index = indexBars.length >= 2 ? change(indexBars) : null;
  const rows = useMemo(() => stocks.map(stock => ({ ...stock, ...change(demoBars(stock.symbol, stock.score)) })), []);
  const visible = apiReady ? (remote?.items || []).map(item => ({ ...item, current: item.price, difference: item.change, percent: item.change_pct })) : rows.slice((page - 1) * pageSize, page * pageSize);
  const total = apiReady ? remote?.total || 0 : rows.length;
  const advances = apiReady ? remote?.breadth?.advances ?? 0 : rows.filter(row => row.difference > 0).length;
  const declines = apiReady ? remote?.breadth?.declines ?? 0 : rows.filter(row => row.difference < 0).length;
  return <section className="market-board" aria-label="Bảng điện thị trường minh họa">
    <div className="market-board-head"><div><span className="market-board-kicker">THỊ TRƯỜNG VIỆT NAM / TỔNG QUAN</span><strong>Bảng điện</strong></div><span className="market-demo-tag">{apiReady ? `${remote?.source === 'scan_snapshot' ? 'SNAPSHOT SAU PHIÊN' : remote?.source || 'ĐANG TẢI'} · ${remote?.as_of || '—'}` : 'DỮ LIỆU MẪU · 21/09/2026'}</span></div>
    {apiReady && error ? <div className="market-api-empty">{error}</div> : <>
    {index ? <div className="market-index"><div className="market-index-stat"><span>VN-INDEX {apiReady ? '· EOD' : '· MINH HỌA'}</span><strong>{fmt(index.current * scale)}</strong><b className={index.difference >= 0 ? 'positive' : 'negative'}>{index.difference >= 0 ? '+' : ''}{fmt(index.difference * scale)} ({index.percent >= 0 ? '+' : ''}{fmt(index.percent)}%)</b></div><IndexChart bars={indexBars} scale={scale} isDemo={!apiReady || remote?.run_id?.startsWith('DEMO')} /></div> : <div className="market-api-empty">{remote ? 'Chưa có dữ liệu VN-Index trong bản quét.' : 'Đang tải dữ liệu VN-Index…'}</div>}
    <div className="market-breadth"><span><i className="up-dot"/> Tăng <strong>{advances}</strong></span><span><i className="down-dot"/> Giảm <strong>{declines}</strong></span><span>{total} mã · HOSE / HNX / UPCoM</span></div>
    <div className="market-board-scroll"><table className="market-board-table"><thead><tr><th>MÃ / SÀN</th><th>GIÁ</th><th>+/−</th><th>%</th><th>KL</th></tr></thead><tbody>{visible.map(row => <tr key={row.symbol}><td><strong>{row.symbol}</strong><small>{row.exchange}</small></td><td className={row.difference >= 0 ? 'positive' : 'negative'}>{fmt(row.current)}</td><td className={row.difference >= 0 ? 'positive' : 'negative'}>{row.difference >= 0 ? '+' : ''}{fmt(row.difference)}</td><td className={row.difference >= 0 ? 'positive' : 'negative'}>{row.percent >= 0 ? '+' : ''}{fmt(row.percent)}%</td><td>{fmt(row.volume, 0)}</td></tr>)}</tbody></table></div>
    <Pagination total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
    </>}
    <div className="market-board-foot">{apiReady ? remote?.run_id?.startsWith('DEMO') ? 'Snapshot dữ liệu mẫu từ BE · Không phải dữ liệu giao dịch trực tiếp' : 'Dữ liệu cuối phiên từ bản quét đã công bố · Không phải giá realtime' : 'Giá, chỉ số và khối lượng giả lập cho PoC · Không phải dữ liệu giao dịch trực tiếp'}</div>
  </section>;
}
