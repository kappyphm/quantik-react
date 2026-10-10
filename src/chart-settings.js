export const backendIntervals = [['D', 'Ngày'], ['W', 'Tuần'], ['M', 'Tháng']];
export const tradingViewIntervals = [
  ['1', '1 phút'], ['5', '5 phút'], ['15', '15 phút'], ['30', '30 phút'],
  ['60', '1 giờ'], ['240', '4 giờ'], ...backendIntervals,
];
export const chartIndicators = [
  {id: 'sma', label: 'SMA', study: 'MASimple@tv-basicstudies'},
  {id: 'ema', label: 'EMA', study: 'MAExp@tv-basicstudies'},
  {id: 'rsi', label: 'RSI', study: 'RSI@tv-basicstudies'},
  {id: 'macd', label: 'MACD', study: 'MACD@tv-basicstudies'},
  {id: 'bb', label: 'Bollinger Bands', study: 'BB@tv-basicstudies'},
  {id: 'atr', label: 'ATR', study: 'ATR@tv-basicstudies'},
];
export const defaultIndicators = ['sma', 'rsi'];
export const normalizeInterval = (value, options = tradingViewIntervals) =>
  options.some(([id]) => id === value) ? value : 'D';
export function normalizeIndicators(value) {
  if (!Array.isArray(value)) return [...defaultIndicators];
  return chartIndicators.filter(({id}) => value.includes(id)).map(({id}) => id);
}
export function advancedChartConfig({symbol, theme = 'dark', compact = false, interval = 'D', indicators}) {
  const selected = normalizeIndicators(indicators ?? (compact ? [] : defaultIndicators));
  return {
    locale: 'vi_VN', theme, autosize: true, symbol,
    interval: normalizeInterval(interval), timezone: 'Asia/Ho_Chi_Minh',
    style: '1', allow_symbol_change: false,
    hide_side_toolbar: !!compact, hide_top_toolbar: !!compact,
    withdateranges: true, show_popup_button: true, popup_width: '1200', popup_height: '800',
    studies: chartIndicators.filter(({id}) => selected.includes(id)).map(({study}) => study),
    support_host: 'https://www.tradingview.com',
  };
}
