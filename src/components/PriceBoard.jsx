import { useEffect, useMemo, useRef, useState } from 'react';
import { getBoard } from '../api.js';
import { demoRows } from '../demo.js';

const GROUPS = [['HOSE', 'HOSE'], ['VN30', 'VN30'], ['WATCH', 'WATCHLIST']];
const fmt = (x, d = 2) => (x == null ? '–' : x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const cls = (p, r) => (p >= r.ceil - 1e-9 ? 'ceil' : p <= r.floor + 1e-9 ? 'floor' : p > r.ref + 1e-9 ? 'up' : p < r.ref - 1e-9 ? 'down' : 'ref');
const scoreCls = (s) => (s >= 70 ? 's-hi' : s >= 50 ? 's-mid' : 's-lo');

export function Spark({ v = [] }) {
  if (v.length < 2) return null;
  const mn = Math.min(...v), mx = Math.max(...v);
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 64},${18 - ((x - mn) / (mx - mn || 1)) * 16}`).join(' ');
  return (
    <svg viewBox="0 0 64 20" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={`var(--${v.at(-1) >= v[0] ? 'up' : 'down'})`} strokeWidth="1.4" />
    </svg>
  );
}

export default function PriceBoard({ section, onOpen, onQuant }) {
  const [group, setGroup] = useState('HOSE');
  const [rows, setRows] = useState(demoRows);
  const [source, setSource] = useState('preview');
  useEffect(() => { setGroup(section === 'watch' ? 'WATCH' : 'HOSE'); }, [section]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState('FPT');
  const [sort, setSort] = useState({ k: 'sym', d: 1 });
  const [watch, setWatch] = useState(() => (() => { try { return new Set(JSON.parse(localStorage.getItem('qt.watch') || '["FPT","HPG","MWG"]')); } catch { return new Set(); } })());
  const [flash, setFlash] = useState({});
  const prev = useRef({});
  const [err, setErr] = useState('');

  // Poll bảng giá 5 giây/lần. Khi có streaming (SSI/VPS websocket) thì thay bằng WebSocket.
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const data = await getBoard(group === 'WATCH' ? 'HOSE' : group);
        if (stop) return;
        const f = {};
        data.forEach((r) => { const p = prev.current[r.sym]; if (p != null && p !== r.price) f[r.sym] = r.price > p ? 'flash-up' : 'flash-dn'; prev.current[r.sym] = r.price; });
        setFlash(f); setRows(data); setSource('api'); setErr('');
      } catch (e) { if (!stop) setErr('FEED OFFLINE — Đang hiển thị mẫu tĩnh. Python API chưa kết nối.'); }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [group]);

  useEffect(() => localStorage.setItem('qt.watch', JSON.stringify([...watch])), [watch]);

  const view = useMemo(() => {
    const a = rows.filter((r) => (group === 'WATCH' ? watch.has(r.sym) : group === 'VN30' ? r.sym !== 'HHP' : true) && (!q || `${r.sym} ${r.name}`.toLocaleLowerCase('vi').includes(q.trim().toLocaleLowerCase('vi'))));
    const val = (r) => (sort.k === 'chg' ? r.price - r.ref : r[sort.k]);
    return a.sort((x, y) => (typeof val(x) === 'string' ? val(x).localeCompare(val(y)) : val(x) - val(y)) * sort.d);
  }, [rows, group, q, sort, watch]);

  const th = (k, label, hide) => (
    <th key={k} className={hide ? 'hide-sm' : ''} onClick={() => setSort((s) => (s.k === k ? { k, d: -s.d } : { k, d: k === 'sym' ? 1 : -1 }))} data-sorted={sort.k === k || undefined}>
      {label}{sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const rising = rows.filter(r => r.price > r.ref).length;
  const falling = rows.filter(r => r.price < r.ref).length;
  const leaders = [...rows].sort((a,b) => (b.score ?? -1)-(a.score ?? -1)).slice(0,5);
  const current = rows.find(r=>r.sym===selected) || rows[0];
  return (
    <>
      <div className="market-strip"><b>VN EQUITIES</b><span>TẬP MÃ <strong>{rows.length}</strong></span><span className="up">TĂNG {rising}</span><span className="down">GIẢM {falling}</span><span className="ref">ĐỨNG {rows.length-rising-falling}</span><span className="strip-end">{source === 'api' && !err ? 'API / SIMULATED' : 'OFFLINE / SAMPLE'}</span></div>
      <section className="market-panel"><div className="window-title"><b>01 / EQUITY MONITOR</b><span>GIÁ: 1.000 VNĐ · KHỐI LƯỢNG: CP · QUANT: /100</span></div>
      <div className="toolbar">
        <div className="tabs" role="tablist">
          {GROUPS.map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={group === k} onClick={() => setGroup(k)}>{l}</button>)}
        </div>
        <label className="search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="LỌC MÃ / DOANH NGHIỆP" aria-label="Tìm mã" /></label>
      </div>
      
      {err && <p className="err">{err}</p>}
      <div className="boardwrap">
        <table>
          <thead><tr>
            {th('sym', 'MÃ')}<th className="company-col">DOANH NGHIỆP</th>{th('ceil', 'Trần', 1)}{th('floor', 'Sàn', 1)}{th('ref', 'TC')}{th('price', 'Giá')}{th('chg', '+/−')}{th('vol', 'Khối lượng', 1)}
            <th className="hide-sm">30 phiên</th>{th('score', 'QUANT')}<th />
          </tr></thead>
          <tbody>
            {!view.length && <tr><td colSpan={11}><div className="empty"><b>{group === 'WATCH' ? 'Chưa có mã theo dõi phù hợp' : 'Không tìm thấy cổ phiếu'}</b><p>{group === 'WATCH' ? 'Bấm ngôi sao cạnh mã trong bảng giá để thêm vào danh sách.' : 'Thử tìm bằng mã hoặc tên doanh nghiệp khác.'}</p></div></td></tr>}
            {view.map((r) => {
              const c = cls(r.price, r), d = r.price - r.ref;
              return (
                <tr key={r.sym} className={current?.sym === r.sym ? 'selected' : ''} tabIndex={0} onClick={() => setSelected(r.sym)} onDoubleClick={() => onOpen(r.sym)} onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && onOpen(r.sym)}>
                  <td className="sym">
                    <button className="star" aria-pressed={watch.has(r.sym)} aria-label={`Theo dõi ${r.sym}`}
                      onClick={(e) => { e.stopPropagation(); setWatch((w) => { const n = new Set(w); n.has(r.sym) ? n.delete(r.sym) : n.add(r.sym); return n; }); }}>
                      {watch.has(r.sym) ? '★' : '☆'}
                    </button>
                    <span className={c}>{r.sym}</span>
                    
                  </td>
                  <td className="company-col company-name">{r.name || r.sym}</td>
                  <td className="hide-sm ceil">{fmt(r.ceil)}</td><td className="hide-sm floor">{fmt(r.floor)}</td><td className="ref">{fmt(r.ref)}</td>
                  <td className={`price ${c} ${flash[r.sym] || ''}`}>{fmt(r.price)}</td>
                  <td className={c}>{d >= 0 ? '+' : ''}{fmt(d)} ({(d / r.ref * 100).toFixed(2)}%)</td>
                  <td className="hide-sm">{r.vol?.toLocaleString('en-US')}</td>
                  <td className="hide-sm spark"><Spark v={r.spark} /></td>
                  <td>{r.score != null && <span className={`score ${scoreCls(r.score)}`} title="Điểm mô phỏng">{r.score}</span>}</td>
                  <td><button className="qbtn" onClick={(e) => { e.stopPropagation(); onQuant(r.sym); }}>QUANT ›</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span>{view.length} cổ phiếu · {group === 'WATCH' ? 'Danh sách cá nhân' : group}</span><span>Dữ liệu mô phỏng phục vụ xem giao diện</span></div></section>
      <div className="terminal-lower">
        <section className="detail-window"><div className="window-title"><b>02 / SECURITY DETAIL</b><span>{current?.sym || '—'} EQUITY</span></div>{current && <>
          <div className="security-heading"><b>{current.sym}</b><span>{current.name || 'HOSE'}</span><strong className={cls(current.price,current)}>{fmt(current.price)}</strong><button onClick={()=>onOpen(current.sym)}>CHART ↗</button></div>
          <div className="detail-body"><div className="history-chart"><span>30 PHIÊN / MÔ PHỎNG</span><Spark v={current.spark}/><div className="chart-axis"><span>T−29</span><span>T−15</span><span>T</span></div></div><dl><div><dt>THAM CHIẾU</dt><dd className="ref">{fmt(current.ref)}</dd></div><div><dt>THAY ĐỔI</dt><dd className={cls(current.price,current)}>{fmt((current.price/current.ref-1)*100)}%</dd></div><div><dt>KHỐI LƯỢNG</dt><dd>{fmt(current.vol,0)}</dd></div><div><dt>QUANT SCORE</dt><dd className="amber">{current.score ?? '—'} / 100</dd></div></dl></div>
        </>}</section>
        <section className="ranking-window"><div className="window-title"><b>03 / QUANT RANKING</b><span>DEMO</span></div><div className="ranking-head"><span>MÃ</span><span>ĐIỂM</span><span>Δ %</span></div>{leaders.map(r=><button className="ranking-row" key={r.sym} onClick={()=>{setSelected(r.sym);}}><b>{r.sym}</b><span className="amber">{r.score}</span><span className={cls(r.price,r)}>{fmt((r.price/r.ref-1)*100)}%</span></button>)}</section>
        <section className="system-window"><div className="window-title"><b>04 / SESSION</b><span>STATUS</span></div><dl><div><dt>NGUỒN GIÁ</dt><dd className="amber">{source === 'api' && !err ? 'DEMO API' : 'LOCAL SAMPLE'}</dd></div><div><dt>PYTHON API</dt><dd className={err ? 'down' : 'ref'}>{err ? 'OFFLINE' : source === 'api' ? 'CONNECTED' : 'CONNECTING'}</dd></div><div><dt>CHU KỲ POLL</dt><dd>5 SEC</dd></div><div><dt>WATCHLIST</dt><dd>{watch.size} SYMBOLS</dd></div></dl><p>Chọn dòng: xem chi tiết<br/>Bấm đúp / Enter: biểu đồ<br/>QUANT: mở phân tích mô hình</p></section>
      </div>
    </>
  );
}
