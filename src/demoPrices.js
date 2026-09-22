// Dữ liệu giá giả lập, ổn định theo mã để các biểu đồ PoC hiển thị nhất quán.
export function demoBars(symbol, score = 70) {
  let seed = [...symbol].reduce((n, c) => n * 31 + c.charCodeAt(0), 17) >>> 0;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const bars = [];
  const date = new Date(Date.UTC(2026, 8, 21));
  let close = 70 + (seed % 40);
  while (bars.length < 260) {
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
      const open = close;
      const drift = (score - 70) / 2600;
      close = Math.max(8, open * (1 + (random() - .5) * .046 + drift));
      const high = Math.max(open, close) * (1 + random() * .018);
      const low = Math.min(open, close) * (1 - random() * .018);
      bars.push({ time: date.toISOString().slice(0, 10), open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume: Math.round(700000 + random() * 3800000) });
    }
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return bars.reverse();
}
