import demo from '../shared/scan-demo.json';

export function normalizeScan(data) {
  if (!data || !['demo','published'].includes(data.mode) ||
      typeof data.runId !== 'string' || !data.runId || typeof data.source !== 'string' || !data.source ||
      typeof data.session !== 'string' || typeof data.publishedAt !== 'string' ||
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data.publishedAt) || !Number.isFinite(Date.parse(data.publishedAt)) ||
      typeof data.dataAsOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.dataAsOf) || !Number.isFinite(Date.parse(data.dataAsOf)) ||
      !Number.isInteger(data.cadenceMinutes) || data.cadenceMinutes <= 0 ||
      !Number.isInteger(data.universeCount) || !Array.isArray(data.rows) ||
      data.rows.length > 10000 || data.universeCount < data.rows.length) {
    throw new Error('Bản công bố chưa đúng định dạng.');
  }
  const symbols = new Set();
  for (const row of data.rows) {
    if (!row || !/^[A-Z0-9]{3,5}$/.test(row.symbol) || symbols.has(row.symbol) ||
        typeof row.name !== 'string' || typeof row.exchange !== 'string' ||
        (row.score != null && (!Number.isFinite(row.score) || row.score < 0 || row.score > 100)) ||
        (row.passed != null && typeof row.passed !== 'boolean') ||
        (row.holdingSessions != null && (!Number.isInteger(row.holdingSessions) || row.holdingSessions < 0)) ||
        ['sector','recommendation','explanation','rating','indexTrend'].some(k=>row[k]!=null && typeof row[k]!=='string')) {
      throw new Error('Kết quả quét chưa đúng định dạng.');
    }
    symbols.add(row.symbol);
  }
  return {...data, isStale: Date.now()-Date.parse(data.publishedAt) > data.cadenceMinutes*60000};
}

export const demoScan = () => normalizeScan(demo);
const searchKey = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
export function filterScan(rows, {query='',exchange='ALL',recommendation='ALL',passed='ALL',direction='desc'} = {}) {
  const key = searchKey(query.trim());
  return rows.filter(r => (!key || searchKey(`${r.symbol} ${r.name}`).includes(key)) &&
    (exchange==='ALL' || r.exchange===exchange) &&
    (recommendation==='ALL' || r.recommendation===recommendation) &&
    (passed==='ALL' || (passed==='unknown' ? r.passed==null : r.passed===(passed==='yes'))))
    .sort((a,b) => a.score==null ? (b.score==null ? a.symbol.localeCompare(b.symbol) : 1) :
      b.score==null ? -1 : (direction==='desc' ? b.score-a.score : a.score-b.score) || a.symbol.localeCompare(b.symbol));
}
