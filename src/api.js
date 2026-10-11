// Tất cả lời gọi tới phần Python nằm ở đây. Đổi VITE_API_BASE khi deploy.
// Nối với backend thật (FastAPI /api/v1): session cookie, market overview,
// scan đã công bố, job QUANT + báo cáo. Khi API chưa sẵn sàng, các hàm ném
// lỗi để UI giữ snapshot/demo gần nhất và báo offline (logic cũ giữ nguyên).
import {mapBackendResearch} from './research.js';
import {normalizeScan, mapBackendScan} from './scan.js';
import {normalizeLiveBoard} from './market.js';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';
const V1 = `${BASE}/v1`;

async function j(res) {
  if (!res.ok) {
    let detail;try{detail=(await res.json()).detail;}catch{}
    const error=new Error(typeof detail==='string'?detail:typeof detail?.message==='string'?detail.message:`Dịch vụ báo lỗi HTTP ${res.status}.`);
    error.status=res.status;throw error;
  }
  return res.json();
}

const v1get = (path, signal) =>
  fetch(`${V1}${path}`, {credentials: 'same-origin', cache: 'no-store', signal}).then(j);

const v1post = (path, body, signal) =>
  fetch(`${V1}${path}`, {
    method: 'POST', credentials: 'same-origin',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body), signal,
  }).then(j);

let sessionPromise = null;
/** Backend yêu cầu cookie phiên cho job QUANT. Gọi trước mọi thao tác ghi. */
export function ensureSession(signal) {
  if (!sessionPromise) {
    sessionPromise = v1post('/session', {}, signal).catch(err => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

/** Đọc toàn bộ mã của bản quét đã công bố (API phân trang tối đa 100/trang). */
async function fetchScanItems(signal) {
  const first = await v1get('/scans/latest/results?page=1&page_size=100', signal);
  const total = first.total || (first.items || []).length;
  const items = [...(first.items || [])];
  const pages = Math.max(1, Math.ceil(total / 100));
  for (let page = 2; page <= pages; page++) {
    const data = await v1get(`/scans/latest/results?page=${page}&page_size=100`, signal);
    if (data.run_id !== first.run_id) throw new Error('Bản quét vừa thay đổi; vui lòng tải lại.');
    items.push(...(data.items || []));
  }
  return items;
}

/** Full provider catalog; scan metadata is optional and never blocks the board. */
const BOARD_PAGE_SIZE = 50;
export const getBoard = async (group = 'ALL', signal) => {
  void group;
  const scanPromise = fetchScanItems(signal).catch(() => {
    return []; // optional metadata; market request owns cancellation
  });
  const first = await v1get(`/market/overview?page=1&page_size=${BOARD_PAGE_SIZE}`, signal);
  const total = first.total ?? first.items?.length ?? 0;
  const pages = [first];
  for (let page = 2; page <= Math.ceil(total / BOARD_PAGE_SIZE); page++) {
    const data = await v1get(`/market/overview?page=${page}&page_size=${BOARD_PAGE_SIZE}`, signal);
    if (data.total !== first.total) throw new Error('Danh mục nguồn thay đổi; tải lại bảng điện.');
    pages.push(data);
  }
  const scanItems = await scanPromise;
  return normalizeLiveBoard(pages, new Map(scanItems.map(item => [item.symbol, item])));
};

/**
 * Bắt đầu chạy quant cho 1 mã. Backend luôn chạy toàn pipeline
 * (screener + ARIMA/GARCH/HMM/LightGBM + backtest point-in-time) nên
 * tham số modules được bỏ qua. Trả {id} như hợp đồng cũ.
 */
export const startQuant = async (symbol, modules = null) => {
  void modules;
  await ensureSession();
  const data = await v1post('/quant/jobs', {
    symbol: String(symbol).toUpperCase(),
    include_backtest: true,
  });
  return {id: data.job_id};
};

const numOrNull = value => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Gom các chỉ số đã biết từ báo cáo QUANT về shape metrics của AnalysisReport. */
function buildMetrics(report) {
  const stats = report.stats || {};
  const vol = report.vol || {};
  const ac = report.ac || {};
  const dist = report.dist || {};
  const known = id => stats[id] ?? vol[id] ?? ac[id] ?? dist[id] ?? null;
  const metrics = [
    {id:'ensemble_return',value:report.fcast?.ensemble_ret_pct,unit:'%'},
    {id:'confidence',value:report.fcast?.agreement_pct,unit:'%'},
    {id:'hmm',value:report.hmm?.current},
    {id:'var',value:report.charts?.return_distribution?.var95,unit:'%'},
    {id:'cvar',value:report.charts?.return_distribution?.cvar95,unit:'%'},
    {id:'annual_return',value:stats.ann_return_pct,unit:'%'},
    {id:'max_drawdown',value:stats.max_dd_pct,unit:'%'},
    {id:'win_rate',value:stats.win_rate_pct,unit:'%',scope:'DAILY_PRICE_RETURNS_NOT_TRADES'},
    {id:'volatility_regime',value:vol.regime},
    {id:'lock_drawdown',value:report.fcast?.lock_risk?.max_dd_lock_pct,unit:'%'},
    {id:'probability_loss',value:report.fcast?.lock_risk?.prob_loss_gt_3pct,unit:'%'},
  ];
  for (const id of ['sharpe','sortino','calmar','cmf','rsi','kurtosis','kelly','risk_reward','entry_quality']) {
    metrics.push({id,value:known(id)});
  }
  return metrics.map(m => ({
    ...m,
    value: typeof m.value === 'number' ? numOrNull(m.value) : (m.value ?? null),
  }));
}

/**
 * Trạng thái job theo shape cũ {queued|running|done|error}. Khi xong, đọc thêm
 * báo cáo để có summary/metrics/biểu đồ; ảnh chỉ có khi backend bật sinh ảnh.
 */
export const getJob = async id => {
  await ensureSession();
  const job = await v1get(`/quant/jobs/${id}`);
  const status = job.status === 'succeeded' ? 'done'
    : job.status === 'failed' || job.status === 'cancelled' ? 'error'
    : job.status;
  const out = {
    id: job.job_id || job.id, symbol: job.symbol, status,
    phase: job.phase, progress_pct: job.progress_pct,
    error: job.error || null, asOf: null, mode: 'live',
    modules: [{
      id: 'quant',
      name: job.progress_pct != null && status !== 'done' && status !== 'error'
        ? `Mô hình Quant · ${job.progress_pct}%`
        : 'Mô hình Quant',
      state: status === 'done' ? 'done' : status === 'error' ? 'error' : 'running',
      sec: null,
    }],
    summary: null, metrics: [], imageUrl: null, research: null,
  };
  if (status === 'done') {
    try {
      const report = await v1get(`/quant/reports/${id}`);
      out.asOf = report.as_of || report.data_as_of || null;
      const levels = report.levels || {};
      const toK = v => (v == null ? null : v / 1000);
      out.summary = {
        score: numOrNull(report.score),
        action: report.action || report.rating || null,
        entry: toK(numOrNull(levels.entry)),
        stop: toK(numOrNull(levels.sl_swing)),
        tp1: toK(numOrNull(levels.tp1)),
        tp2: toK(numOrNull(levels.tp2)),
        net_r: null, atr_pct: null,
      };
      out.metrics = buildMetrics(report);
      out.research = report.research || mapBackendResearch(report);
      out.scoreComparable = report.score_comparable;
      out.scoreComparabilityReason = report.score_comparability_reason;
      const manifest = report.chart_manifest || [];
      out.imageUrl = manifest.length ? manifest[0].url : null;
      if (report.commentary) {
        out.reportSections = [{id: 'commentary', title: 'Nhận định mô hình', text: report.commentary}];
      }
    } catch (error) { out.reportError = `Chưa tải được báo cáo: ${error.message}`; }
  }
  return out;
};

/** Backend không có khái niệm module rời: luôn trả một pipeline duy nhất. */
export const listModules = async () => [{
  id: 'full',
  name: 'Pipeline QUANT đầy đủ',
  desc: 'Screener + ARIMA/GARCH/HMM/LightGBM + backtest point-in-time. Backend luôn chạy toàn pipeline.',
}];

/** Read the last published scan; this GET never starts a quant job. */
export const getLatestScan = async signal => {
  const meta = await v1get('/scans/latest', signal);
  const items = await fetchScanItems(signal);
  return normalizeScan(mapBackendScan(meta, items));
};

/** Chi tiết 1 mã trong bản quét đã công bố (public, không cần session). */
export const getSymbolDetail = (symbol, signal) =>
  v1get(`/scans/latest/results/${encodeURIComponent(String(symbol).toUpperCase())}`, signal);

/** Nến OHLCV của 1 mã từ snapshot đã công bố (public, tối đa 260 phiên). */
export const getSymbolOhlcv = (symbol, limit = 260, signal) =>
  v1get(`/scans/latest/results/${encodeURIComponent(String(symbol).toUpperCase())}/ohlcv?limit=${limit}`, signal);

/** The server selects at most ten rows from one publication, without starting jobs. */
export const getScanHighlights = async signal => {
 const data = await v1get('/scans/latest/highlights', signal);
 const mapped = mapBackendScan(data, data.items);
 return normalizeScan({...mapped, highlights:data.highlights, eligibleCount:data.eligibleCount, excludedCount:data.excludedCount, analyzedCount:data.analyzedCount, buyNowCount:data.buyNowCount, selectionRuleVersion:data.selectionRuleVersion});
};
