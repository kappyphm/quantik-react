import { memo, useEffect, useRef } from 'react';

const BASE = 'https://s3.tradingview.com/external-embedding/';

/** Nhúng widget TradingView. `name` là tên file script, config là JSON cấu hình. */
function TVWidget({ name, config }) {
  const ref = useRef(null);
  const key = JSON.stringify(config);

  useEffect(() => {
    const host = ref.current;
    host.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    const script = document.createElement('script');
    script.src = BASE + name;
    script.async = true;
    script.text = key; // TradingView đọc cấu hình từ nội dung thẻ script
    host.append(inner, script);
    return () => { host.innerHTML = ''; };
  }, [name, key]);

  return <div className="tradingview-widget-container" ref={ref} style={{ height: '100%', width: '100%' }} />;
}

export default memo(TVWidget);

const common = (theme) => ({ locale: 'vi_VN', colorTheme: theme, theme, isTransparent: true, width: '100%' });
export const tvSymbol = (sym) => `HOSE:${sym}`;

export const AdvancedChart = ({ sym, theme, compact }) => (
  <TVWidget
    name="embed-widget-advanced-chart.js"
    config={{
      ...common(theme), autosize: true, symbol: tvSymbol(sym), interval: 'D', timezone: 'Asia/Ho_Chi_Minh',
      style: '1', allow_symbol_change: false, hide_side_toolbar: !!compact, hide_top_toolbar: !!compact,
      studies: compact ? [] : ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies', 'MACD@tv-basicstudies'],
      support_host: 'https://www.tradingview.com',
    }}
  />
);

export const SymbolInfo = ({ sym, theme }) => (
  <TVWidget name="embed-widget-symbol-info.js" config={{ ...common(theme), symbol: tvSymbol(sym) }} />
);

export const Technicals = ({ sym, theme }) => (
  <TVWidget
    name="embed-widget-technical-analysis.js"
    config={{ ...common(theme), symbol: tvSymbol(sym), interval: '1D', displayMode: 'single', showIntervalTabs: true, height: '100%' }}
  />
);
