import './commentary.css';

export default function Commentary({ text, gateExplanation }) {
  if (!text && !gateExplanation) {
    return <p className="commentary-empty">Chưa có kết luận chi tiết.</p>;
  }

  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const titleLine = lines.length && lines[0].includes('— Điểm') ? lines[0] : null;
  const contentLines = titleLine ? lines.slice(1) : lines;

  return (
    <div className="commentary-card">
      {titleLine && <div className="commentary-header">{titleLine}</div>}
      
      {gateExplanation && (
        <div className="commentary-gate-badge">
          <small>ĐIỀU KIỆN SÀNG LỌC</small>
          <p>{gateExplanation}</p>
        </div>
      )}

      <div className="commentary-body">
        {contentLines.map((line, idx) => {
          if (line.startsWith('Tổng kết')) {
            return (
              <div key={idx} className="commentary-callout verdict">
                <span className="callout-tag">TỔNG KẾT KHUYẾN NGHỊ</span>
                <p>{line.replace(/^Tổng kết[^:]*:\s*/, '')}</p>
              </div>
            );
          }
          if (line.startsWith('Chiến lược:')) {
            return (
              <div key={idx} className="commentary-callout strategy">
                <span className="callout-tag">KẾ HOẠCH GIAO DỊCH (TRADE PLAN)</span>
                <p>{line.replace(/^Chiến lược:\s*/, '')}</p>
              </div>
            );
          }
          if (/^[①②③④⑤]/.test(line)) {
            return (
              <h4 key={idx} className="commentary-heading">
                {line}
              </h4>
            );
          }
          return (
            <p key={idx} className="commentary-paragraph">
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}
