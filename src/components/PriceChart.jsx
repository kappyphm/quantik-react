import { useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, createChart, HistogramSeries } from 'lightweight-charts';

const ranges = [['1M', 22], ['3M', 66], ['1Y', 260]];
const format = value => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export default function PriceChart({ symbol, ohlcvBars, sourceLabel = 'SNAPSHOT ĐÃ CÔNG BỐ' }) {
  const host = useRef(null);
  const chartRef = useRef(null);
  const [range, setRange] = useState('3M');
  const bars = useMemo(() => ohlcvBars || [], [ohlcvBars]);
  const [active, setActive] = useState(bars.at(-1));

  useEffect(() => {
    setActive(bars.at(-1));
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: 'solid', color: '#0d1416' }, textColor: '#8c9c9b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, attributionLogo: true },
      grid: { vertLines: { color: '#1d292b' }, horzLines: { color: '#263234' } },
      rightPriceScale: { borderColor: '#374347', scaleMargins: { top: .06, bottom: .25 } },
      timeScale: { borderColor: '#374347', timeVisible: false, rightOffset: 4 },
      crosshair: { vertLine: { color: '#73817b', labelBackgroundColor: '#3a4a47' }, horzLine: { color: '#73817b', labelBackgroundColor: '#3a4a47' } },
      localization: { locale: 'vi-VN' },
    });
    chartRef.current = chart;
    const candles = chart.addSeries(CandlestickSeries, { upColor: '#71d8a5', downColor: '#ef8a83', borderVisible: false, wickUpColor: '#71d8a5', wickDownColor: '#ef8a83', priceFormat: { type: 'price', precision: 2, minMove: .01 } });
    candles.setData(bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: '', priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false });
    volume.setData(bars.map(({ time, volume: value, open, close }) => ({ time, value, color: close >= open ? '#3c8068aa' : '#a35f5aaa' })));
    chart.priceScale('').applyOptions({ scaleMargins: { top: .81, bottom: .01 } });
    chart.subscribeCrosshairMove(param => {
      if (!param.time) { setActive(bars.at(-1)); return; }
      const point = bars.find(bar => bar.time === param.time);
      if (point) setActive(point);
    });
    return () => { chartRef.current = null; chart.remove(); };
  }, [bars]);

  useEffect(() => {
    if (!chartRef.current) return;
    const count = ranges.find(([label]) => label === range)?.[1] ?? 66;
    chartRef.current.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - count), to: bars.length + 3 });
  }, [bars, range]);

  return <div className="price-chart">
    <div className="price-chart-head"><div><strong>{symbol}</strong><span>OHLCV / {sourceLabel}</span></div><div className="range-switch" aria-label="Khoảng thời gian biểu đồ">{ranges.map(([label]) => <button key={label} className={range === label ? 'active' : ''} onClick={() => setRange(label)}>{label}</button>)}</div></div>
    <div className="ohlcv-strip"><span>{active?.time}</span><span>O <b>{format(active?.open)}</b></span><span>H <b>{format(active?.high)}</b></span><span>L <b>{format(active?.low)}</b></span><span>C <b className={active?.close >= active?.open ? 'positive' : 'negative'}>{format(active?.close)}</b></span><span>VOL <b>{active?.volume?.toLocaleString('vi-VN')}</b></span></div>
    <div className="price-chart-canvas" ref={host} role="img" aria-label={`Biểu đồ nến OHLCV của ${symbol}`} />
    <div className="price-chart-foot"><span>Biểu đồ tạo bằng Lightweight Charts™</span><span>{sourceLabel}</span></div>
  </div>;
}
