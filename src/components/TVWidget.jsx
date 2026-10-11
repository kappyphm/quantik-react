import { memo, useEffect, useRef, useState } from 'react';
import {instrumentFor} from '../market.js';

const BASE = 'https://s3.tradingview.com/external-embedding/';

/** Nhúng widget TradingView. `name` là tên file script, config là JSON cấu hình. */
function TVWidget({ name, config }) {
  const ref = useRef(null);
  const [status,setStatus] = useState('loading');
  const [retry,setRetry] = useState(0);
  const key = JSON.stringify(config);

  useEffect(() => {
    const host = ref.current;
    host.innerHTML = '';
    setStatus('loading');
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    const script = document.createElement('script');
    script.src = BASE + name;
    script.async = true;
    script.text = key; // TradingView đọc cấu hình từ nội dung thẻ script
    script.onerror = () => setStatus('error');
    const observer = new MutationObserver(() => { if(host.querySelector('iframe')) setStatus('embedded'); });
    observer.observe(host,{childList:true,subtree:true});
    host.append(inner, script);
    const timeout = setTimeout(() => { if(!host.querySelector('iframe')) setStatus('error'); },15000);
    return () => { observer.disconnect(); clearTimeout(timeout); host.innerHTML = ''; };
  }, [name, key, retry]);

  return <div className="widget-host">{status !== 'embedded' && <div className="widget-status" role="status"><p>{status === 'loading' ? 'Đang tải biểu đồ TradingView…' : 'Không tải được TradingView. Kiểm tra kết nối Internet hoặc thử lại.'}</p>{status === 'error' && <button className="btn ghost" onClick={()=>setRetry(x=>x+1)}>Tải lại biểu đồ</button>}</div>}<div className="tradingview-widget-container" ref={ref} style={{ height: '100%', width: '100%' }} /></div>;
}

export default memo(TVWidget);

const common = (theme) => ({ locale: 'vi_VN', colorTheme: theme, theme, isTransparent: true, width: '100%' });
export const tvSymbol = (sym) => instrumentFor(sym)?.tvSymbol || null;

export const AdvancedChart = ({ sym, symbol, theme, compact, interval = 'D' }) => (
  (symbol || tvSymbol(sym)) ? <TVWidget
    name="embed-widget-advanced-chart.js"
    config={{
      ...common(theme), autosize: true, symbol: symbol || tvSymbol(sym), interval, timezone: 'Asia/Ho_Chi_Minh',
      style: '1', allow_symbol_change: false, hide_side_toolbar: !!compact, hide_top_toolbar: !!compact,
      withdateranges: true, show_popup_button: true, popup_width: '1200', popup_height: '800',
      studies: compact ? [] : ['MASimple@tv-basicstudies', 'RSI@tv-basicstudies'],
      support_host: 'https://www.tradingview.com',
    }}
  /> : <p className="empty">Chưa có mapping TradingView cho {sym}.</p>
);

export const SymbolInfo = ({ sym, theme }) => (
  tvSymbol(sym) ? <TVWidget name="embed-widget-symbol-info.js" config={{ ...common(theme), symbol: tvSymbol(sym) }} /> : <p className="empty">Chưa có mapping TradingView cho {sym}.</p>
);

export const Technicals = ({ sym, theme }) => (
  tvSymbol(sym) ? <TVWidget
    name="embed-widget-technical-analysis.js"
    config={{ ...common(theme), symbol: tvSymbol(sym), interval: '1D', displayMode: 'single', showIntervalTabs: true, height: '100%' }}
  /> : <p className="empty">Chưa có mapping TradingView cho {sym}.</p>
);
