import { useCallback, useEffect, useRef, useState } from 'react';
import { getJob, jobImageUrl, listModules, startQuant } from '../api.js';

const fmt = (x, d = 2) => (x == null ? '–' : Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));

/** Chạy job, hỏi trạng thái mỗi 700ms cho tới khi xong. */
function useQuantJob() {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef(null);

  const stop = () => clearTimeout(timer.current);
  useEffect(() => stop, []);

  const run = useCallback(async (symbol, modules) => {
    stop(); setError(''); setJob({ status: 'queued', modules: [] });
    try {
      const { id } = await startQuant(symbol, modules);
      const tick = async () => {
        let j;
        try { j = await getJob(id); } catch (e) { setError('Mất kết nối khi chạy phân tích. Vui lòng thử lại.'); setJob({status:'error', modules:[]}); return; }
        setJob(j);
        if (j.status === 'error') setError(j.error || 'Pipeline báo lỗi.');
        if (j.status === 'done' || j.status === 'error') return;
        timer.current = setTimeout(tick, 700);
      };
      await tick();
    } catch (e) { setError('Không chạy được pipeline: ' + e.message); setJob(null); }
  }, []);

  return { job, error, run };
}

export default function QuantPanel({ sym, autoRun }) {
  const [mods, setMods] = useState([]);
  const [moduleError, setModuleError] = useState(false);
  const [sel, setSel] = useState([]);
  const { job, error, run } = useQuantJob();

  useEffect(() => {
    listModules().then((m) => { setMods(m); setSel(m.map((x) => x.id)); }).catch(() => setModuleError(true));
  }, []);
  useEffect(() => { if (autoRun) run(sym, null); }, [sym]); // eslint-disable-line

  const running = job && (job.status === 'queued' || job.status === 'running');
  const s = job?.summary;

  if (!job) {
    return (
      <div className="card">
        <h3>Chọn module cần chạy cho {sym}</h3>
        <p className="dim">Phân tích xu hướng, dòng tiền và rủi ro theo từng mô hình.</p>
        {moduleError && <p role="status" className="err">Chưa kết nối được dịch vụ phân tích. Hãy khởi động Python API để sử dụng Quant.</p>}
        <div className="mods">
          {mods.map((m) => (
            <label key={m.id} className="mod">
              <input type="checkbox" checked={sel.includes(m.id)} onChange={(e) => setSel((a) => (e.target.checked ? [...a, m.id] : a.filter((x) => x !== m.id)))} />
              <span><b>{m.name}</b><small>{m.desc}</small></span>
            </label>
          ))}
        </div>
        <button className="btn" disabled={!sel.length} onClick={() => run(sym, sel)}>Chạy phân tích {sym}</button>
        {error && <p className="err">{error}</p>}
      </div>
    );
  }

  return (
    <>
      {running && (
        <div className="card">
          <h3>Đang chạy {sym}</h3>
          <div className="mods">
            {(job.modules || []).map((m) => (
              <div key={m.id} className={`mod ${m.state === 'running' ? 'run' : m.state}`}>
                <span><b>{m.name}</b></span>
                <span className="st">{m.state === 'running' ? <span className="spin" /> : m.state === 'done' ? `✓ ${m.sec}s` : 'chờ'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {job.status === 'error' && (
        <div className="card">
          <p className="err">{error}</p>
          <button className="btn ghost" onClick={() => run(sym, sel.length ? sel : null)}>Thử lại</button>
        </div>
      )}
      {job.status === 'done' && (
        <>
          <div className="ctl">
            <span className="dim">Hoàn tất, {job.modules.length} module</span><span style={{ flex: 1 }} />
            <button className="btn ghost" onClick={() => run(sym, sel.length ? sel : null)}>Chạy lại</button>
          </div>
          {s && (
            <div className="keyrow">
              <div><small>Điểm Quant</small><b>{s.score} / 100</b></div>
              <div><small>Khuyến nghị</small><b style={{ fontSize: 13 }}>{s.action}</b></div>
              <div><small>Điểm vào</small><b>{fmt(s.entry)}</b></div>
              <div><small>Cắt lỗ</small><b className="down">{fmt(s.stop)}</b></div>
              <div><small>Chốt lời 1</small><b className="up">{fmt(s.tp1)}</b></div>
              <div><small>Chốt lời 2</small><b className="up">{fmt(s.tp2)}</b></div>
              <div><small>Lãi/lỗ ròng</small><b>{fmt(s.net_r)}x</b></div>
              <div><small>ATR / Giá</small><b>{fmt(s.atr_pct)}%</b></div>
            </div>
          )}
          {/* Ảnh tổng quan do quant_visual.py dựng (6 panel như bản terminal). */}
          <img className="qimg" src={jobImageUrl(job.id)} alt={`Tổng quan mô hình quant của ${sym}`} />
        </>
      )}
    </>
  );
}
