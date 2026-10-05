import {useEffect, useMemo, useRef, useState} from 'react';
import {CandlestickSeries, createChart, HistogramSeries} from 'lightweight-charts';

const ranges = [['1M', 22], ['3M', 66], ['6M', 132], ['1Y', 260], ['Tất cả', Infinity]];
const dayMs = 86400000;

const themes = {
  dark: {
    bg: '#0d1416', text: '#8c9c9b', gridV: '#1d292b', gridH: '#263234',
    border: '#374347', cross: '#73817b', crossBg: '#3a4a47',
    up: '#71d8a5', down: '#ef8a83', volUp: '#3c8068aa', volDown: '#a35f5aaa',
  },
  light: {
    bg: '#ffffff', text: '#555f5e', gridV: '#e8eeee', gridH: '#dfe7e7',
    border: '#c4d0cf', cross: '#8a9796', crossBg: '#5b6b6a',
    up: '#1f9d63', down: '#d64541', volUp: '#1f9d6355', volDown: '#d6454155',
  },
};

/** Gộp nến ngày thành tuần (key = thứ Hai) hoặc tháng (key = ngày 01). */
export function resampleBars(bars, interval) {
  if (interval !== 'W' && interval !== 'M') return bars;
  const groups = new Map();
  for (const bar of bars) {
    const day = new Date(`${bar.time}T00:00:00Z`);
    let key;
    if (interval === 'W') {
      const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * dayMs);
      key = monday.toISOString().slice(0, 10);
    } else {
      key = `${bar.time.slice(0, 7)}-01`;
    }
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        time: key, open: bar.open, high: bar.high, low: bar.low,
        close: bar.close, volume: bar.volume || 0,
      });
    } else {
      group.high = Math.max(group.high, bar.high);
      group.low = Math.min(group.low, bar.low);
      group.close = bar.close;
      group.volume += bar.volume || 0;
    }
  }
  return [...groups.values()];
}

const formatPrice = value =>
  value == null ? '—' : Number(value).toLocaleString('vi-VN', {maximumFractionDigits: 2, minimumFractionDigits: 2});

/**
 * Biểu đồ nến + khối lượng từ OHLCV của backend (snapshot đã công bố),
 * khớp đúng dữ liệu dùng để phân tích. Không phụ thuộc nguồn ngoài.
 */
export default function BackendChart({symbol, bars, interval = 'D', theme = 'dark', sourceLabel = 'SNAPSHOT ĐÃ CÔNG BỐ'}) {
  const host = useRef(null);
  const chartRef = useRef(null);
  const candlesRef = useRef(null);
  const volumeRef = useRef(null);
  const [range, setRange] = useState('3M');
  const data = useMemo(() => resampleBars(bars || [], interval), [bars, interval]);
  const [active, setActive] = useState(() => data.at(-1));
  const palette = themes[theme] || themes.dark;

  useEffect(() => {
    setActive(data.at(-1));
  }, [data]);

  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: {
        background: {type: 'solid', color: palette.bg},
        textColor: palette.text, fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11, attributionLogo: true,
      },
      grid: {vertLines: {color: palette.gridV}, horzLines: {color: palette.gridH}},
      rightPriceScale: {borderColor: palette.border, scaleMargins: {top: 0.06, bottom: 0.25}},
      timeScale: {borderColor: palette.border, timeVisible: false, rightOffset: 4},
      crosshair: {
        vertLine: {color: palette.cross, labelBackgroundColor: palette.crossBg},
        horzLine: {color: palette.cross, labelBackgroundColor: palette.crossBg},
      },
      localization: {locale: 'vi-VN'},
    });
    chartRef.current = chart;
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: palette.up, downColor: palette.down, borderVisible: false,
      wickUpColor: palette.up, wickDownColor: palette.down,
      priceFormat: {type: 'price', precision: 2, minMove: 0.01},
    });
    candlesRef.current = candles;
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: '', priceFormat: {type: 'volume'},
      priceLineVisible: false, lastValueVisible: false,
    });
    volumeRef.current = volume;
    chart.priceScale('').applyOptions({scaleMargins: {top: 0.81, bottom: 0.01}});
    chart.subscribeCrosshairMove(param => {
      if (!param.time) {
        setActive(current => current ?? data.at(-1));
        return;
      }
      const point = data.find(bar => bar.time === param.time);
      if (point) setActive(point);
    });
    return () => {
      chartRef.current = null;
      chart.remove();
    };
  }, [palette.bg]);

  useEffect(() => {
    if (!candlesRef.current || !volumeRef.current) return;
    candlesRef.current.setData(data.map(({time, open, high, low, close}) => ({time, open, high, low, close})));
    volumeRef.current.setData(data.map(({time, volume, open, close}) => ({
      time, value: volume || 0, color: close >= open ? palette.volUp : palette.volDown,
    })));
    chartRef.current?.timeScale().fitContent();
  }, [data, palette]);

  useEffect(() => {
    if (!chartRef.current || !data.length) return;
    const count = ranges.find(([label]) => label === range)?.[1] ?? 66;
    const visible = Math.min(count, data.length);
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: Math.max(0, data.length - visible), to: data.length + 3,
    });
  }, [data, range]);

  const up = active && active.close >= active.open;
  return <div>
    <div style={{display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8}}>
      <div><strong>{symbol}</strong> <span className="dim" style={{fontSize: 10}}>OHLCV / {sourceLabel}</span></div>
      <span style={{flex: 1}} />
      <div role="group" aria-label="Khoảng thời gian biểu đồ" style={{display: 'flex', gap: 4}}>
        {ranges.map(([label]) => (
          <button key={label} className={range === label ? 'btn' : 'btn ghost'}
            style={{padding: '4px 8px', fontSize: 10}} onClick={() => setRange(label)}>{label}</button>
        ))}
      </div>
    </div>
    <div className="dim" style={{fontSize: 10, marginBottom: 6, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
      <span>{active?.time}</span>
      <span>O <b>{formatPrice(active?.open)}</b></span>
      <span>H <b>{formatPrice(active?.high)}</b></span>
      <span>L <b>{formatPrice(active?.low)}</b></span>
      <span>C <b className={up ? 'up' : 'down'}>{formatPrice(active?.close)}</b></span>
      <span>VOL <b>{active?.volume?.toLocaleString('vi-VN') ?? '—'}</b></span>
    </div>
    <div ref={host} style={{height: 420}} role="img" aria-label={`Biểu đồ nến OHLCV của ${symbol}`} />
    <p className="dim" style={{fontSize: 9, marginTop: 6}}>
      Nến {interval === 'W' ? 'tuần' : interval === 'M' ? 'tháng' : 'ngày'} gộp từ snapshot đã công bố · Biểu đồ tạo bằng Lightweight Charts™
    </p>
  </div>;
}
