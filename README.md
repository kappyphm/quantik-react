# QuanTik web (React + Python)

## Chạy thử
```bash
# 1) Python API
cd backend && pip install -r requirements.txt && uvicorn server:app --reload --port 8000

# 2) React (terminal khác)
cd .. && npm install && npm run dev      # mở http://localhost:5173
```

## Nối code Python thật
Chỉ sửa `backend/adapters.py` (4 hàm: `load_board`, `load_context`, `run_module`, `summarize`, `render_image`).
`server.py` và React giữ nguyên.

## Luồng dữ liệu
- Bảng điện: React gọi `GET /api/board` mỗi 5 giây.
- Bấm mã: popup mở, biểu đồ/kỹ thuật là widget TradingView (`HOSE:<mã>`), không đi qua Python.
- Bấm Quant: `POST /api/quant/jobs` -> React hỏi `GET /api/quant/jobs/{id}` mỗi 0,7 giây -> khi xong hiện
  `summary` và ảnh từ `GET /api/quant/jobs/{id}/image`. Kết quả cache theo (mã, ngày, module).


## Giao diện terminal
- Nền đen, chữ monospace, màu hổ phách, bảng giá dày, cửa sổ vuông.
- Bấm dòng để xem chi tiết; bấm đúp hoặc Enter để mở biểu đồ.
- Thanh lệnh: FPT, FPT CHART, FPT Q, WATCH, MARKET. Phím / đưa focus vào lệnh.
- Theo dõi lưu trên trình duyệt; lọc mã/doanh nghiệp và sắp xếp cột.
- Dữ liệu mẫu có nhãn rõ ràng. Backend vẫn mô phỏng, chưa nối pipeline Python thật.
- Mobile giữ bảng đầy đủ với cuộn ngang.

Build: npm run build. Có thể chạy trực tiếp node node_modules/vite/bin/vite.js nếu pnpm bị lỗi kiểm tra dependency trong môi trường này.
