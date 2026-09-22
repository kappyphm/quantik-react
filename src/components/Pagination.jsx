export default function Pagination({ total, page, pageSize, onPageChange, onPageSizeChange, sizes = [5, 10, 20] }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = total ? (current - 1) * pageSize + 1 : 0;
  const to = Math.min(total, current * pageSize);
  return <nav className="pagination" aria-label="Phân trang danh sách">
    <span className="pagination-range">{from}–{to} / {total} mã</span>
    <label className="pagination-size">Số dòng <select aria-label="Số dòng mỗi trang" value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}>{sizes.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    <div className="pagination-actions">
      <button aria-label="Trang đầu" title="Trang đầu" disabled={current <= 1} onClick={() => onPageChange(1)}>«</button>
      <button aria-label="Trang trước" title="Trang trước" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>‹</button>
      <span>Trang {current} / {pageCount}</span>
      <button aria-label="Trang sau" title="Trang sau" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)}>›</button>
      <button aria-label="Trang cuối" title="Trang cuối" disabled={current >= pageCount} onClick={() => onPageChange(pageCount)}>»</button>
    </div>
  </nav>;
}
