// Tất cả lời gọi tới phần Python nằm ở đây. Đổi VITE_API_BASE khi deploy.
const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function j(res) {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

/** Bảng điện: [{sym,name,sector,ref,ceil,floor,price,vol,score,spark:[...]}] */
export const getBoard = (group = 'HOSE') => fetch(`${BASE}/board?group=${encodeURIComponent(group)}`).then(j);

/** Bắt đầu chạy quant cho 1 mã. modules = null nghĩa là chạy tất cả. */
export const startQuant = (symbol, modules = null) =>
  fetch(`${BASE}/quant/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, modules }),
  }).then(j);

/** {id,status:'queued|running|done|error',modules:[{id,name,state,sec}],summary,error} */
export const getJob = (id) => fetch(`${BASE}/quant/jobs/${id}`).then(j);

/** Ảnh tổng quan do quant_visual.py tạo ra */
export const jobImageUrl = (id) => `${BASE}/quant/jobs/${id}/image`;

export const listModules = () => fetch(`${BASE}/quant/modules`).then(j);
