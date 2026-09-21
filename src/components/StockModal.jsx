import { useEffect, useState, useRef } from 'react';
import { AdvancedChart, SymbolInfo, Technicals } from './TVWidget.jsx';
import QuantPanel from './QuantPanel.jsx';

const TABS = [['overview', 'Tổng quan'], ['chart', 'Biểu đồ nến'], ['ta', 'Phân tích kỹ thuật'], ['quant', 'Quant']];

export default function StockModal({ sym, initialTab = 'overview', theme, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const dialog = useRef(null);
  useEffect(() => { const previous = document.activeElement; dialog.current?.querySelector('button')?.focus(); return () => previous?.focus(); }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const nodes = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href], iframe, [tabindex="0"]')].filter(n => n.getClientRects().length);
        const first=nodes[0], last=nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">
        <div className="mh">
          <h2 className="t" id="mTitle">{sym}</h2><span className="n">HOSE</span><span className="sp" />
          <button className="iconbtn" aria-label="Đóng" onClick={onClose}>✕</button>
        </div>
        <div className="mtabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <div className="mbody">
          {tab === 'overview' && (
            <div className="grid2">
              <div className="card"><div className="tvbox sm"><AdvancedChart sym={sym} theme={theme} compact /></div></div>
              <div>
                <div className="card" style={{ height: 300 }}><SymbolInfo sym={sym} theme={theme} /></div>
                <div className="card cta">
                  <h3 style={{ margin: 0 }}>Phân tích Quant</h3>
                  <button className="btn" onClick={() => setTab('quant')}>Chạy phân tích Quant</button>
                </div>
              </div>
            </div>
          )}
          {tab === 'chart' && <div className="tvbox"><AdvancedChart sym={sym} theme={theme} /></div>}
          {tab === 'ta' && <div className="tvbox ta"><Technicals sym={sym} theme={theme} /></div>}
          {tab === 'quant' && <QuantPanel sym={sym} autoRun={initialTab === 'quant'} />}
        </div>
      </div>
    </div>
  );
}
