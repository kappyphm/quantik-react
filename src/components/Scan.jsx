import { useEffect, useRef, useState } from 'react';
import Pagination from './Pagination.jsx';

const columns = [['symbol', 'Mã'], ['recommendation', 'Khuyến nghị'], ['gatePass', 'Đạt bộ lọc'],
  ['gateExplanation', 'Giải thích điều kiện'], ['score', 'Điểm'], ['rating', 'Đánh giá'],
  ['holdPlan', 'Thời gian nắm giữ'], ['vniTrend', 'Xu hướng VN-Index'],
  ['sector', 'Nhóm ngành'], ['sectorTrend', 'Xu hướng ngành']];
const apiKeys = { gatePass: 'gate_pass', gateExplanation: 'gate_explanation',
  holdPlan: 'hold_plan', vniTrend: 'vni_trend', sectorTrend: 'sector_trend' };
export const tone = x => /^(MUA|Tăng|🟢)/i.test(x || '') ? 'positive'
  : /^(TRÁNH|THẬN TRỌNG|Giảm|🔴)/i.test(x || '') ? 'negative' : 'neutral';

export default function Scan({ go }) {
  const initial = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(initial.get('q') || '');
  const [rec, setRec] = useState(initial.get('rec') || 'Tất cả');
  const [gate, setGate] = useState(initial.get('gate') || 'Tất cả');
  const [exchange, setExchange] = useState(initial.get('exchange') || 'Tất cả');
  const [sector, setSector] = useState(initial.get('sector') || 'Tất cả');
  const [min, setMin] = useState(Number(initial.get('min') || 0));
  const [sort, setSort] = useState(columns.some(([key]) => key === initial.get('sort')) ? initial.get('sort') : 'score');
  const [asc, setAsc] = useState(initial.get('order') === 'asc');
  const [page, setPage] = useState(Math.max(1, Number(initial.get('page')) || 1));
  const [pageSize, setPageSize] = useState([5, 10, 20].includes(Number(initial.get('page_size'))) ? Number(initial.get('page_size')) : 10);
  const [remote, setRemote] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [facets, setFacets] = useState(null);
  const [apiError, setApiError] = useState('');
  const mounted = useRef(false);

  useEffect(() => { if (mounted.current) setPage(1); else mounted.current = true; },
    [query, rec, gate, exchange, sector, min, sort, asc]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (rec !== 'Tất cả') params.set('rec', rec);
    if (gate !== 'Tất cả') params.set('gate', gate);
    if (exchange !== 'Tất cả') params.set('exchange', exchange);
    if (sector !== 'Tất cả') params.set('sector', sector);
    if (min) params.set('min', min);
    if (sort !== 'score') params.set('sort', sort);
    if (asc) params.set('order', 'asc');
    if (page > 1) params.set('page', page);
    if (pageSize !== 10) params.set('page_size', pageSize);
    window.history.replaceState({}, '', `/scan${params.size ? `?${params}` : ''}`);
  }, [query, rec, gate, exchange, sector, min, sort, asc, page, pageSize]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetch('/api/v1/scans/latest').then(r => r.ok ? r.json() : null)
        .then(data => { if (active) setActiveRun(data); }).catch(() => {});
      fetch('/api/v1/scans/status').then(r => r.json())
        .then(data => { if (active) setScanStatus(data); }).catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!activeRun) return;
    fetch('/api/v1/scans/latest/facets').then(r => r.ok ? r.json() : null)
      .then(setFacets).catch(() => {});
  }, [activeRun?.id]);
  useEffect(() => {
    if (!activeRun) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize),
      sort: apiKeys[sort] || sort, order: asc ? 'asc' : 'desc' });
    if (query) params.set('q', query);
    if (rec !== 'Tất cả') params.set('recommendation', rec);
    if (gate !== 'Tất cả') params.set('gate_pass', String(gate === 'Đạt'));
    if (exchange !== 'Tất cả') params.set('exchange', exchange);
    if (sector !== 'Tất cả') params.set('sector', sector);
    if (min) params.set('score_min', String(min));
    fetch(`/api/v1/scans/latest/results?${params}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Không tải được bản quét'); return r.json(); })
      .then(data => { setRemote(data); setApiError(''); })
      .catch(e => { if (e.name !== 'AbortError') { setRemote(null); setApiError(e.message); } });
    return () => controller.abort();
  }, [activeRun?.id, query, rec, gate, exchange, sector, min, sort, asc, page, pageSize]);

  const results = (remote?.items || []).map(s => ({ ...s, gatePass: s.gate_pass,
    gateExplanation: s.gate_explanation, holdPlan: s.hold_plan,
    vniTrend: s.vni_trend, sectorTrend: s.sector_trend }));
  const total = remote?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const newerRunActive = activeRun && scanStatus?.status === 'running' && scanStatus.run_id !== activeRun.id;
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const reset = () => { setQuery(''); setRec('Tất cả'); setGate('Tất cả'); setExchange('Tất cả'); setSector('Tất cả'); setMin(0); };
  const sortBy = key => { if (sort === key) setAsc(!asc); else { setSort(key); setAsc(key === 'symbol'); } };
  const statusText = activeRun ? `● Đã công bố${newerRunActive ? ` · Đợt mới ${scanStatus.progress_pct}%` : ''}` : scanStatus?.status === 'running'
    ? `Đang quét ${scanStatus.progress_pct}%` : scanStatus?.status === 'failed'
      ? 'Quét thất bại' : 'Chưa có bản quét thật';

  return <div className="page scan-page">
    <div className="page-heading"><div><div className="eyebrow">PHÂN TÍCH TOÀN SÀN / BẢN CÔNG BỐ MỚI NHẤT</div><h1>Kết quả quét <span>toàn sàn</span></h1><p>{activeRun ? 'Dữ liệu từ đợt phân tích đã công bố. Chọn một mã để xem chi tiết đánh giá.' : 'Chưa có bản quét thật được công bố. Tiến độ đợt đang chạy hiển thị bên dưới.'}</p></div><div className="run-stamp"><span>RUN ID</span><strong>{activeRun?.id || scanStatus?.run_id || '—'}</strong><small>{activeRun?.published_at?.slice(0, 16).replace('T', ' ') || 'Chưa công bố'}</small></div></div>
    <div className="scan-stats"><div><span>TRẠNG THÁI</span><strong className={activeRun ? 'positive' : ''}>{statusText}</strong></div><div><span>PHIÊN PHÂN TÍCH</span><strong>{activeRun?.slot || scanStatus?.slot || '—'}</strong></div><div><span>DỮ LIỆU ĐẾN</span><strong>{activeRun?.data_as_of || '—'}</strong></div><div><span>SỐ MÃ HIỂN THỊ</span><strong>{total} <i>/ {activeRun?.universe_count ?? scanStatus?.universe_count ?? 0}</i></strong></div></div>
    {newerRunActive && <div className="market-api-empty" role="status">Đang chạy bản quét mới {scanStatus.run_id} · {scanStatus.phase} · {scanStatus.progress_pct}%. Bảng bên dưới tiếp tục dùng snapshot đã công bố cho tới khi lượt mới vượt kiểm tra chất lượng.</div>}
    <div className="scan-layout"><aside className="filter-panel"><div className="aside-title"><b>BỘ LỌC</b><button onClick={reset}>Đặt lại ↺</button></div><label className="field"><span>TÌM MÃ / DOANH NGHIỆP</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ví dụ: FPT, Hòa Phát..." /></label><label className="field"><span>SÀN GIAO DỊCH</span><select value={exchange} onChange={e => setExchange(e.target.value)}>{['Tất cả', ...(facets?.exchange || [])].map(x => <option key={x}>{x}</option>)}</select></label><label className="field"><span>KHUYẾN NGHỊ</span><select value={rec} onChange={e => setRec(e.target.value)}>{['Tất cả', ...(facets?.recommendation || [])].map(x => <option key={x}>{x}</option>)}</select></label><label className="field"><span>ĐẠT BỘ LỌC</span><select value={gate} onChange={e => setGate(e.target.value)}>{['Tất cả', 'Đạt', 'Chưa đạt'].map(x => <option key={x}>{x}</option>)}</select></label><label className="field"><span>NHÓM NGÀNH</span><select value={sector} onChange={e => setSector(e.target.value)}>{['Tất cả', ...(facets?.sector || [])].map(x => <option key={x}>{x}</option>)}</select></label><label className="field"><span>ĐIỂM TỐI THIỂU <b>{min}</b></span><input type="range" min="0" max="100" step="5" value={min} onChange={e => setMin(Number(e.target.value))} /></label><div className="filter-note">Bộ lọc và phân trang được xử lý trên API.</div></aside>
      <section className="results-panel"><div className="results-title"><div><span className="eyebrow">DANH SÁCH ĐÁNH GIÁ</span><strong>{total} mã phù hợp</strong></div><span className="demo-label">{activeRun ? 'SNAPSHOT ĐÃ CÔNG BỐ' : scanStatus?.status === 'running' ? 'ĐANG QUÉT' : 'CHƯA CÓ SNAPSHOT'}</span></div>{apiError && activeRun && <div className="market-api-empty" role="alert">{apiError}</div>}{!activeRun && <div className="market-api-empty" role="status">{scanStatus?.status === 'running' ? `Đang thu thập và phân tích dữ liệu thật (${scanStatus.progress_pct}%). Kết quả sẽ xuất hiện sau khi kiểm tra độ phủ và công bố.` : scanStatus?.status === 'failed' ? 'Đợt quét thất bại. Xem trạng thái quản trị để chẩn đoán.' : 'Chưa có bản quét thật được công bố.'}</div>}
        <div className="table-scroll"><table className="scan-table"><thead><tr>{columns.map(([key, label]) => <th key={key}><button onClick={() => sortBy(key)}>{label} {sort === key ? asc ? '↑' : '↓' : ''}</button></th>)}</tr></thead><tbody>{results.map(s => <tr key={s.symbol} onClick={() => go(`/stocks/${s.symbol}`)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && go(`/stocks/${s.symbol}`)}><td><b className="symbol">{s.symbol}</b><small>{s.exchange} · {s.name}</small></td><td><span className={`pill ${tone(s.recommendation)}`}>{s.recommendation}</span></td><td><span className={s.gatePass ? 'positive' : 'muted'}>{s.gatePass ? '✓ Đạt' : '— Chưa đạt'}</span></td><td className="explain" title={s.gateExplanation}>{s.gateExplanation}</td><td><strong className={s.score >= 75 ? 'positive' : s.score < 60 ? 'negative' : ''}>{s.score ?? '—'}</strong><span className="mini-meter"><i style={{ width: `${s.score || 0}%` }} /></span></td><td>{s.rating}</td><td>{s.holdPlan}</td><td className={tone(s.vniTrend)}>{s.vniTrend}</td><td>{s.sector}</td><td className={tone(s.sectorTrend)}>{s.sectorTrend}</td></tr>)}</tbody></table>{!total && remote && <div className="no-results">Không có mã phù hợp. <button onClick={reset}>Xóa bộ lọc</button></div>}</div><Pagination total={total} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></section></div>
  </div>;
}
