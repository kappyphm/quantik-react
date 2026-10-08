import {useMemo,useState} from 'react';
import {actionKind,filterScan,formatScanValue,scanFields,scanValue,selectHighlights} from '../scan.js';
import TermHint from './TermHint.jsx';
import AnnotatedText from './AnnotatedText.jsx';

const defaults={query:'',exchange:'ALL',recommendation:'ALL',passed:'ALL'};
const presets={
 core:['score','action','net_forecast_pct','sharpe','up_day_ratio_pct','max_drawdown_pct','annual_return_pct'],
 forecast:['ensemble_return_pct','agreement_pct','model_coverage_pct','directional_support_pct','active_model_count','meta_trust_pct','gross_forecast_pct','roundtrip_cost_pct','net_forecast_pct'],
 risk:['max_drawdown_pct','lock_drawdown_pct','probability_loss_gt_3pct','data_quality_status','data_quality_score','adv20_value_vnd','gap_abs_p95_pct'],
 trade:['gate_pass','holding_sessions','entry_vnd','stop_loss_vnd','take_profit_1_vnd','take_profit_2_vnd','trade_model_agreement_pct','risk_pct_nav']};
const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
export default function ScanHighlights({snapshot,heading,onOpen,onQuant,onRefresh,busy}){
 const [filters,setFilters]=useState(defaults),[preset,setPreset]=useState('core');
 const selection=useMemo(()=>selectHighlights(snapshot),[snapshot]);
 const all=[...selection.opportunities,...selection.cautions];
 const visible=new Set(filterScan(all,filters).map(r=>r.symbol));
 const fields=presets[preset].map(key=>scanFields.find(f=>f.key===key));
 const context=row=>({row,runId:snapshot.runId,mode:snapshot.mode,dataAsOf:snapshot.dataAsOf,publishedAt:snapshot.publishedAt,source:snapshot.source});
 const set=(key,value)=>setFilters(f=>({...f,[key]:value}));
 const list=(rows,title,kind)=>{const view=rows.filter(r=>visible.has(r.symbol));return <section className={`market-panel highlight-panel ${kind}`} aria-label={title}>
  <div className="window-title"><div><span className="eyebrow">{kind==='opportunity'?'CƠ HỘI THEO MÔ HÌNH':'KIỂM SOÁT RỦI RO'}</span><h3>{title}</h3></div><span className={kind==='opportunity'?'up':'down'}>{view.length} / {rows.length} mã</span></div>
  <p className="highlight-intro">{kind==='opportunity'?'Ưu tiên hành động mua đạt điều kiện, sau đó theo dõi và điểm cao. Giữ nguyên nhãn hành động của pipeline.':'Ưu tiên nhãn TRÁNH, sau đó điểm thấp trong tập hợp lệ. Mã lỗi phân tích không dùng để lấp danh sách.'}</p>
  <div className="boardwrap scan-table-wrap" role="region" tabIndex={0} aria-label={`${title}, cuộn ngang để xem chỉ số`}><table className="scan-table highlight-table"><thead><tr><th scope="col">Mã / phân tích</th>{fields.map(f=><th scope="col" key={f.key}><TermHint id={f.term}>{f.label}{f.format==='price'?' (nghìn ₫)':''}</TermHint></th>)}</tr></thead><tbody>{view.map(row=><tr key={row.symbol}>
   <td className="highlight-symbol"><div><button className="symbol-link" onClick={()=>onOpen(row.symbol,context(row))} aria-label={`Xem chart ${row.symbol}`}>{row.symbol}</button><button className="quant-inline" onClick={()=>onQuant(row.symbol,context(row))} aria-label={`Chạy Quant ${row.symbol}`}>Chạy Quant ↗</button></div><small>{row.exchange} · {row.name}</small></td>
   {fields.map(f=><td key={f.key} className={f.key==='score'?'amber':f.key==='action'?(actionKind(row)==='AVOID'?'down':'dim'):f.key==='net_forecast_pct'?(scanValue(row,f.key)>0?'up':'down'):''}>{formatScanValue(row,f)}</td>)}
  </tr>)}</tbody></table>{!view.length&&<p className="empty">{rows.length?'Không có mã phù hợp bộ lọc trong nhóm này.':'Chưa có mã hợp lệ cho nhóm này. Không bổ sung mã lỗi hoặc đổi nhãn để đủ 5.'}</p>}</div>
  <div className="highlight-explanations">{view.map(row=><details key={row.symbol}><summary>{row.symbol} · Vì sao được đánh giá như vậy? · 50 trường</summary><p><AnnotatedText text={Array.isArray(scanValue(row,'gate_reasons'))?scanValue(row,'gate_reasons').join(' · '):scanValue(row,'gate_reasons')||'Pipeline chưa công bố lý do có cấu trúc.'}/></p><div className="scan-metric-grid">{scanFields.map(f=><div key={f.key}><dt><TermHint id={f.term}>{f.label}</TermHint></dt><dd>{formatScanValue(row,f)}</dd></div>)}</div></details>)}</div>
 </section>;};
 return <div id="scan-results"><div className="scan-result-heading"><div><span className="eyebrow">PHÂN TÍCH TOÀN SÀN / HIGHLIGHTS</span><h2 ref={heading} tabIndex={-1}>5 nổi bật · <em>5 thận trọng</em></h2><p>Cùng một bản công bố. Từ mỗi mã, mở chart hoặc chạy phân tích Quant chi tiết.</p></div><button className="btn ghost" onClick={onRefresh} disabled={busy}>{busy?'Đang lấy bản mới…':'Lấy bản công bố mới'} ↻</button></div>
 <div className="scan-metadata"><div><small>TRẠNG THÁI</small><b>{snapshot.mode==='demo'?'Bản mẫu minh họa':'Đã công bố'}</b></div><div><small>PHẠM VI PHÂN TÍCH</small><b>{snapshot.analyzedCount??snapshot.rows.length} / {snapshot.universeCount} mã</b></div><div><small>DỮ LIỆU HỢP LỆ</small><b>{selection.eligibleCount??'—'} mã <span>· loại {selection.excludedCount??'—'}</span></b></div><div><small>ĐẠT ĐIỀU KIỆN MUA NGAY</small><b className="up">{selection.buyNowCount??0} mã</b></div></div>
 <div className="scan-provenance"><span>RUN <b>{snapshot.runId}</b></span><span>Dữ liệu đến: {snapshot.dataAsOf}</span><span>Công bố: {date(snapshot.publishedAt)} ICT</span><span>Lịch từ nguồn: {snapshot.cadenceMinutes} phút</span><span>{snapshot.source}</span></div>
 {snapshot.mode==='demo'?<p className="info-banner">Dữ liệu mẫu. Chỉ số thiếu hiện “—”; điểm cao chưa phải khuyến nghị mua. Visual/job một mã có nguồn và thời điểm riêng với scan này.</p>:snapshot.isStale&&<p className="info-banner">Bản công bố đã quá chu kỳ. Thời điểm dữ liệu giữ nguyên.</p>}
 {!selection.buyNowCount&&<p className="scan-no-buy" role="status">Chưa có mã được công bố đạt điều kiện BUY_NOW. Nhóm nổi bật vẫn giữ nhãn theo dõi hoặc hành động gốc.</p>}
 <div className="scan-layout"><aside className="scan-filters"><div className="scan-filter-title"><b>BỘ LỌC</b><button onClick={()=>setFilters(defaults)}>Đặt lại ↺</button></div><label>TÌM TRONG 10 MÃ<input type="search" value={filters.query} onChange={e=>set('query',e.target.value)} placeholder="Mã hoặc doanh nghiệp…"/></label><label>SÀN<select value={filters.exchange} onChange={e=>set('exchange',e.target.value)}><option value="ALL">Tất cả</option>{[...new Set(all.map(r=>r.exchange))].map(x=><option key={x}>{x}</option>)}</select></label><label>NHÓM CHỈ SỐ<select value={preset} onChange={e=>setPreset(e.target.value)}>{[['core','Tổng quan & tỷ suất'],['forecast','Dự báo & đồng thuận'],['risk','Rủi ro & dữ liệu'],['trade','Phương án giao dịch']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><p>Bộ lọc thu hẹp hai nhóm đã chọn, không tạo lại xếp hạng toàn sàn. Muốn tìm mã khác, dùng bảng điện.</p><small>Quy tắc: {snapshot.selectionRuleVersion||'highlights-v1'} · Tối đa 5 mã mỗi nhóm, không trùng.</small></aside><div className="highlight-groups">{list(selection.opportunities,'5 mã nổi bật','opportunity')}{list(selection.cautions,'5 mã cần thận trọng','caution')}</div></div>
 </div>;
}
