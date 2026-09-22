# QuanTik — React + API PoC

Frontend React/Vite, FastAPI, SQLite, worker và scheduler cho luồng bảng điện → quét toàn sàn → chi tiết mã → job QUANT → báo cáo. [SRS](docs/SRS.md) và [System Design](docs/SYSTEM_DESIGN.md) mô tả kiến trúc đích; phần dưới là trạng thái triển khai hiện tại.

`quant-core/` được giữ nguyên làm mã gốc đối chiếu. Bản sao dùng bởi backend nằm tại `backend/quant_engine/`; hash gốc trong `docs/quant-core-baseline.sha256`. Bản sao `quant.py` có thay đổi ở lớp kết nối dữ liệu để dùng API `vnstock` 4 và yêu cầu 500 bar; logic phân tích gốc giữ nguyên.

## Chạy tích hợp với snapshot mẫu

Các lệnh sau dành cho **Windows Command Prompt (CMD)**, chạy từ thư mục gốc `D:\20_Workspace\1_software\quantik-react`. Đã kiểm thử với Python 3.13, Node và pnpm. Nếu `backend\.venv` đã tồn tại thì **bỏ qua việc tạo lại**; không chạy `python -m venv` khi API/worker đang dùng môi trường đó.

Nếu dùng Vnstock API key, tạo `.env` từ `.env-template` (chỉ cần một lần), rồi thay giá trị mẫu trong `.env`:

```bat
if not exist .env copy .env-template .env
```

```dotenv
VNSTOCK_API_KEY=khóa-của-bạn
```

Backend nạp file này khi khởi động API, worker hoặc scheduler. `.env` đã được Git bỏ qua; không đặt khóa trong `src/` hoặc biến Vite `VITE_` vì những giá trị đó có thể xuất hiện trong frontend. Sau khi sửa `.env`, khởi động lại các tiến trình backend.

```bat
if not exist backend\.venv\Scripts\python.exe python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python.exe backend\seed_demo.py
```

Mở ba cửa sổ CMD riêng, mỗi cửa sổ bắt đầu tại thư mục gốc dự án:

```bat
cd backend
.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000
```

```bat
cd backend
.venv\Scripts\python.exe worker.py
```

```bat
pnpm install
pnpm dev
```

Khi cần chạy lịch quét từ nguồn thật, mở thêm CMD tại thư mục gốc rồi chạy `cd backend` và `.venv\Scripts\python.exe scheduler.py`. Scheduler sẽ xếp job quét thật, nên không bật khi chỉ demo snapshot mẫu.

Mở `http://localhost:5173`. Vite proxy `/api` sang cổng 8000. `seed_demo.py` tạo bản công bố `DEMO-POST-20260921`; bảng quét, giá và báo cáo chạy từ database nhưng **dữ liệu phân tích vẫn là minh họa**. Worker nhận job demo và trả báo cáo có `analysis_mode=synthetic_demo`, được ghi nhãn trong UI. Dữ liệu nằm ở `backend/data/quantik.sqlite` và tồn tại sau khi tắt trình duyệt. Phiên khách dùng cookie HttpOnly; mất cookie thì không truy cập được các job cũ.

Nếu API hoặc frontend đã chạy ở cổng 8000/5173, dùng tiến trình hiện có; không mở thêm một bản cùng cổng.

Để chỉ xem giao diện demo độc lập trong CMD, chạy `set VITE_DEMO_MODE=true` rồi `pnpm dev` trong cùng cửa sổ. Chế độ API mặc định sẽ báo lỗi rõ nếu backend không sẵn sàng, không tự chuyển sang dữ liệu giả.

## Endpoint chính

- `POST /api/v1/session`: tạo phiên khách.
- `GET /api/v1/market/overview`: snapshot bảng điện có phân trang.
- `GET /api/v1/scans/latest`, `/results`, `/facets`, `/results/{symbol}`, `/results/{symbol}/ohlcv`: bản quét mới nhất, lọc và phân trang trên API.
- `POST /api/v1/quant/jobs`, `GET /api/v1/quant/jobs`, `GET /api/v1/quant/jobs/{id}`, `GET /api/v1/quant/jobs/{id}/events`: hàng đợi bền vững và tiến độ SSE.
- `GET /api/v1/quant/reports/{id}` và `/artifacts/{artifact_id}`: báo cáo và biểu đồ.
- `POST /api/v1/admin/scan-runs`, `GET /api/v1/admin/scan-runs`, `GET /api/v1/admin/scan-runs/{id}/results` và `/results/{symbol}`, `GET /api/v1/admin/quant/reports/{job_id}`: tra cứu lịch sử; yêu cầu header `X-Admin-Key` và biến môi trường `QUANTIK_ADMIN_KEY`.

OpenAPI tại `http://localhost:8000/docs`.

## Phạm vi và giới hạn hiện tại

- `backend/scheduler.py` xếp job PRE_OPEN lúc 07:00 và POST_CLOSE lúc 16:20, giờ Việt Nam, ngày làm việc; ngày nghỉ phải khai báo trong `QUANTIK_HOLIDAYS=YYYY-MM-DD,...`. Chỉ chạy một scheduler. Một lần quét thật mất khoảng một giờ theo số liệu thủ công; chạy một worker sẽ xử lý các job tuần tự.
- Worker kết nối bản sao `quant-core` cho quét thật và phân tích một mã. Bản sao `quant.py` dùng API tương đương trong `vnstock` 4 vì `vnstock_data` không có trên PyPI mặc định. Đã chạy FPT thực tế với 252 bar FPT và VN-Index, hoàn tất mô hình và 6 biểu đồ; quét rút gọn FPT cũng tạo summary. Chưa chạy hết 1.430 mã hoặc đo độ phủ/toàn bộ thời gian. Biểu đồ thứ 7 cần `terminal_research_layout`, module này không có trong thư mục gốc hiện tại. Cần xác nhận quyền dùng nguồn dữ liệu trước khi công bố dữ liệu thật.
- Backend hiện dùng SQLite và một worker, phù hợp tích hợp nội bộ/PoC. Chưa có tài khoản người dùng, phân quyền quản trị nhiều người, cơ chế retry/giám sát production, nguồn realtime, hay PostgreSQL/Redis. Trang chủ hiển thị snapshot cuối phiên, không phải bảng giá realtime.
- `include_backtest` hiện trả trạng thái `unavailable` nếu chưa có lịch sử khuyến nghị đủ để kiểm định giao dịch; các kiểm định thống kê của mô hình nằm trong báo cáo QUANT.

Kiểm tra frontend: `pnpm build`. Kiểm tra cú pháp Python: `python -m compileall -q backend`.

