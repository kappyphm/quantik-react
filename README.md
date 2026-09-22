# QuanTik — React + FastAPI

Frontend React/Vite, FastAPI, SQLite, worker và scheduler cho luồng bảng điện → quét toàn sàn → chi tiết mã → job QUANT → báo cáo. [SRS](docs/SRS.md) và [System Design](docs/SYSTEM_DESIGN.md) mô tả kiến trúc đích; phần dưới là trạng thái triển khai hiện tại.

`quant-core/` được giữ nguyên làm mã gốc đối chiếu. Bản sao dùng bởi backend nằm tại `backend/quant_engine/`; hash gốc trong `docs/quant-core-baseline.sha256`. Bản sao `quant.py` có thay đổi ở lớp kết nối dữ liệu để dùng API `vnstock` 4 và yêu cầu 500 bar; logic phân tích gốc giữ nguyên.

## Chạy với dữ liệu Vnstock

Các lệnh sau dành cho **Windows Command Prompt (CMD)**, chạy từ thư mục gốc `D:\20_Workspace\1_software\quantik-react`. Đã kiểm thử với Python 3.13, Node và pnpm. Nếu `backend\.venv` đã tồn tại thì **bỏ qua việc tạo lại**; không chạy `python -m venv` khi API/worker đang dùng môi trường đó.

Nếu dùng Vnstock API key, tạo `.env` từ `.env-template` (chỉ cần một lần), rồi thay giá trị mẫu trong `.env`:

```bat
if not exist .env copy .env-template .env
```

```dotenv
VNSTOCK_API_KEY=khóa-của-bạn
QUANTIK_ADMIN_KEY=khóa-quản-trị-ngẫu-nhiên-dài
```

Backend nạp file này khi khởi động API, worker hoặc scheduler. `.env` đã được Git bỏ qua; không đặt khóa trong `src/` hoặc biến Vite `VITE_` vì những giá trị đó có thể xuất hiện trong frontend. Sau khi sửa `.env`, khởi động lại các tiến trình backend.

```bat
if not exist backend\.venv\Scripts\python.exe python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
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

Để xếp một bản quét thủ công, chạy từ `backend`:

```bat
.venv\Scripts\python.exe -c "from store import create_scan; from datetime import date; print(create_scan('MANUAL', date.today().isoformat()))"
```

Để chạy lịch PRE_OPEN và POST_CLOSE, mở thêm một tiến trình `scheduler.py` từ `backend`. Chỉ chạy một scheduler và một worker cho SQLite.

Mở `http://localhost:5173`. Vite proxy `/api` sang cổng 8000. Bảng điện gọi Vnstock qua backend; `/scan` chỉ hiển thị bản quét thật sau khi worker hoàn tất kiểm tra độ phủ và công bố. Khi chưa có bản công bố, giao diện hiển thị tiến độ từ `/api/v1/scans/status`. Snapshot `DEMO-` cũ không được phục vụ mặc định. Dữ liệu job nằm ở `backend/data/quantik.sqlite`; phiên khách dùng cookie HttpOnly.

Trang `/admin` dùng `QUANTIK_ADMIN_KEY` trong `.env`. Nhập khóa vào form để xem lượt quét, hàng đợi, lỗi và nhật ký; khóa chỉ được giữ trong bộ nhớ trang. Có thể tạo lượt quét mới, chạy lại lượt thất bại/đã công bố với liên kết `rerun_of`, và chạy lại job QUANT thất bại. API từ chối tạo trùng một slot đang chờ/chạy. Khóa quản trị của môi trường cục bộ hiện tại đã được tạo trong `.env` bị Git bỏ qua; dùng giá trị đó khi cần mở trang.

Nếu API hoặc frontend đã chạy ở cổng 8000/5173, dùng tiến trình hiện có; không mở thêm một bản cùng cổng.

Nếu backend không sẵn sàng, giao diện báo lỗi kết nối. Bản demo đã được lưu tại tag Git `demo-stable-2026-09-22`.

## Endpoint chính

- `POST /api/v1/session`: tạo phiên khách.
- `GET /api/v1/market/overview`: bảng giá Vnstock có phân trang, cache 60 giây.
- `GET /api/v1/scans/status`: tiến độ bản quét thật gần nhất.
- `GET /api/v1/scans/latest`, `/results`, `/facets`, `/results/{symbol}`, `/results/{symbol}/ohlcv`: bản quét mới nhất, lọc và phân trang trên API.
- `POST /api/v1/quant/jobs`, `GET /api/v1/quant/jobs`, `GET /api/v1/quant/jobs/{id}`, `GET /api/v1/quant/jobs/{id}/events`: hàng đợi bền vững và tiến độ SSE.
- `GET /api/v1/quant/reports/{id}` và `/artifacts/{artifact_id}`: báo cáo và biểu đồ.
- `GET /api/v1/admin/session`, `POST /api/v1/admin/scan-runs`, `GET /api/v1/admin/scan-runs`, `GET /api/v1/admin/scan-runs/{id}/results` và `/results/{symbol}`, `GET /api/v1/admin/jobs`, `POST /api/v1/admin/jobs/{id}/retry`, `GET /api/v1/admin/audit`: vận hành và tra cứu lịch sử; yêu cầu header `X-Admin-Key` và biến môi trường `QUANTIK_ADMIN_KEY`.

OpenAPI tại `http://localhost:8000/docs`.

## Phạm vi và giới hạn hiện tại

- `backend/scheduler.py` xếp job PRE_OPEN lúc 07:00 và POST_CLOSE lúc 16:20, giờ Việt Nam, ngày làm việc; ngày nghỉ phải khai báo trong `QUANTIK_HOLIDAYS=YYYY-MM-DD,...`. Một worker xử lý các job tuần tự.
- Worker lấy OHLCV qua Vnstock với nhịp mặc định 1,5 giây trước mỗi yêu cầu (đổi bằng `QUANTIK_FETCH_INTERVAL_SECONDS`). Dữ liệu đã tải được checkpoint theo run ở `backend/data/scan_cache/`; job mất heartbeat được xếp lại để chạy tiếp. Gói Community giới hạn 60 request/phút, nên một đợt 1.430 mã có thể mất nhiều thời gian.
- Đã kiểm thử luồng FPT thật: quét, tạo job qua API, chạy quant-core, báo cáo và tải đủ 7 ảnh. Chưa xác nhận một đợt toàn sàn đủ 1.430 mã hoàn tất và đạt ngưỡng công bố trên máy hiện tại. Bảng điện là dữ liệu theo thời điểm nhà cung cấp trả về, không cam kết realtime.
- Backend hiện dùng SQLite và một worker, phù hợp tích hợp nội bộ. Chưa có tài khoản đăng nhập, phân quyền quản trị nhiều người, retry phân tán, hay PostgreSQL/Redis. Cần xác nhận quyền sử dụng nguồn dữ liệu trước khi công bố công khai.
- `include_backtest` hiện trả trạng thái `unavailable` nếu chưa có lịch sử khuyến nghị đủ để kiểm định giao dịch; các kiểm định thống kê của mô hình nằm trong báo cáo QUANT.

Kiểm tra frontend: `pnpm build`. Kiểm tra API/queue: `cd backend && .venv\Scripts\python.exe -m unittest discover -s tests -v`. Kiểm tra nguồn thật trên database tạm: `cd backend && .venv\Scripts\python.exe tests\live_smoke.py`.

