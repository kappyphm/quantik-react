# QuanTik — React + FastAPI

Frontend React/Vite, FastAPI, SQLite, worker và scheduler cho luồng bảng điện → quét toàn sàn → chi tiết mã → job QUANT → báo cáo. [SRS](docs/SRS.md) và [System Design](docs/SYSTEM_DESIGN.md) mô tả kiến trúc đích; phần dưới là trạng thái triển khai hiện tại.

`quant-core/` được giữ nguyên làm mã gốc đối chiếu. Bản sao dùng bởi backend nằm tại `backend/quant_engine/`; hash gốc trong `docs/quant-core-baseline.sha256`. Bản sao `quant.py` có thay đổi ở lớp kết nối dữ liệu để dùng API `vnstock` 4 và yêu cầu 500 bar; logic phân tích gốc giữ nguyên.

Danh sách thay đổi có chủ đích và cách kiểm tra bất biến nằm tại [docs/QUANT_ENGINE_CHANGES.md](docs/QUANT_ENGINE_CHANGES.md).

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

Để chạy lịch PRE_OPEN và POST_CLOSE, mở thêm một tiến trình `scheduler.py` từ `backend`. Chỉ chạy một scheduler và một worker cho SQLite. Scheduler dùng thứ hai–thứ sáu làm lịch mặc định; trang `/admin` cho phép ghi đè từng ngày nghỉ hoặc ngày giao dịch cuối tuần và lưu lịch này trong database.

Mở `http://localhost:5173`. Vite proxy `/api` sang cổng 8000. Bảng điện gọi Vnstock qua backend; `/scan` chỉ hiển thị bản quét thật sau khi worker hoàn tất kiểm tra độ phủ và công bố. Khi chưa có bản công bố, giao diện hiển thị tiến độ từ `/api/v1/scans/status`. Snapshot `DEMO-` cũ không được phục vụ và worker không có đường tạo báo cáo tổng hợp. Dữ liệu job nằm ở `backend/data/quantik.sqlite`; phiên khách dùng cookie HttpOnly.

Trang `/admin` dùng `QUANTIK_ADMIN_KEY` trong `.env`. Nhập khóa vào form để xem lượt quét, hàng đợi, lỗi và nhật ký; khóa chỉ được giữ trong bộ nhớ trang. Có thể tạo lượt quét mới, chạy lại lượt thất bại/đã công bố với liên kết `rerun_of`, và chạy lại job QUANT thất bại. API từ chối tạo trùng một slot đang chờ/chạy. Khóa quản trị của môi trường cục bộ hiện tại đã được tạo trong `.env` bị Git bỏ qua; dùng giá trị đó khi cần mở trang.

Nếu API hoặc frontend đã chạy ở cổng 8000/5173, dùng tiến trình hiện có; không mở thêm một bản cùng cổng.

## Chạy trọn hệ thống bằng Docker Compose

Chuẩn bị `.env` như trên, sau đó chạy tại thư mục gốc:

```bat
docker compose up -d --build
docker compose ps
```

Mở `http://localhost:8080` (đổi bằng `QUANTIK_WEB_PORT` trong môi trường host). Compose chạy riêng `web`, `api`, `worker`, `scheduler`; SQLite, checkpoint và biểu đồ nằm trong volume `quantik-data`. Nginx phục vụ React và chuyển tiếp `/api`, gồm cả SSE. Xem log bằng `docker compose logs -f api worker scheduler`; dừng bằng `docker compose down`. Không thêm `-v` khi dừng nếu muốn giữ database và checkpoint.

Backup nóng database cùng kho biểu đồ, kiểm tra checksum, và thử restore vào thư mục cô lập:

```bat
cd backend
.venv\Scripts\python.exe maintenance.py backup data\backups\quantik.zip
.venv\Scripts\python.exe maintenance.py verify data\backups\quantik.zip
.venv\Scripts\python.exe maintenance.py restore data\backups\quantik.zip data\restore-test
```

Lệnh `restore` luôn từ chối thư mục không rỗng và không ghi đè database đang chạy. Sau khi xác nhận `sqlite_integrity=ok`, việc thay database live cần dừng API/worker/scheduler và là thao tác vận hành riêng.

Nếu backend không sẵn sàng, giao diện báo lỗi kết nối. Bản demo đã được lưu tại tag Git `demo-stable-2026-09-22`.

## Endpoint chính

- `POST /api/v1/session`: tạo phiên khách.
- `GET /api/v1/market/overview`: bảng giá Vnstock có phân trang, cache 60 giây.
- `GET /api/v1/scans/status`: tiến độ bản quét thật gần nhất.
- `GET /api/v1/scans/latest`, `/results`, `/facets`, `/results/{symbol}`, `/results/{symbol}/ohlcv`: bản quét mới nhất, lọc và phân trang trên API.
- `POST /api/v1/quant/jobs`, `GET /api/v1/quant/jobs`, `GET /api/v1/quant/jobs/{id}`, `GET /api/v1/quant/jobs/{id}/events`: hàng đợi bền vững và tiến độ SSE.
- `GET /api/v1/quant/reports/{id}` và `/artifacts/{artifact_id}`: báo cáo và biểu đồ.
- `GET /api/v1/admin/session`, `POST /api/v1/admin/scan-runs`, `GET /api/v1/admin/scan-runs`, `GET /api/v1/admin/scan-runs/{id}/results` và `/results/{symbol}`, `GET /api/v1/admin/jobs`, `POST /api/v1/admin/jobs/{id}/retry`, `GET /api/v1/admin/calendar`, `PUT/DELETE /api/v1/admin/calendar/{date}`, `GET /api/v1/admin/audit`: vận hành, lịch giao dịch và tra cứu lịch sử; yêu cầu header `X-Admin-Key` và biến môi trường `QUANTIK_ADMIN_KEY`.

OpenAPI tại `http://localhost:8000/docs`.

## Phạm vi và giới hạn hiện tại

- `backend/scheduler.py` xếp job PRE_OPEN lúc 07:00 và POST_CLOSE lúc 16:20, giờ Việt Nam. Lịch ghi đè trong database có ưu tiên cao nhất; nếu không có ghi đè, scheduler dùng thứ hai–thứ sáu và loại các ngày trong `QUANTIK_HOLIDAYS=YYYY-MM-DD,...`. Một worker xử lý các job tuần tự.
- Worker lấy OHLCV qua Vnstock với nhịp mặc định 1,5 giây trước mỗi yêu cầu (đổi bằng `QUANTIK_FETCH_INTERVAL_SECONDS`). Dữ liệu đã tải được checkpoint theo run ở `backend/data/scan_cache/`; job mất heartbeat được xếp lại để chạy tiếp. Lượt quét lại cùng ngày/slot dùng lại checkpoint của lượt gốc. Kết quả mã thiếu dữ liệu, bị loại bởi thanh khoản và lỗi xử lý được phân biệt; lượt thất bại vẫn lưu các hàng đã đánh giá để admin chẩn đoán, nhưng không thay bản công bố. Gói Community giới hạn 60 request/phút, nên một đợt 1.430 mã có thể mất nhiều thời gian.
- Trước công bố, worker kiểm tra độ phủ (`QUANTIK_MIN_COVERAGE`, mặc định 80%), tỷ lệ mã cùng ngày dữ liệu với VN-Index (`QUANTIK_MIN_FRESH_COVERAGE`, mặc định 75%) và tuổi dữ liệu (`QUANTIK_MAX_DATA_AGE_DAYS`, mặc định 7 ngày). `POST_CLOSE` yêu cầu dữ liệu đúng ngày slot; `PRE_OPEN` yêu cầu dữ liệu của phiên trước.
- Mỗi scan run lưu `model_version`, phiên bản gói nguồn và JSON cấu hình gate; API danh sách, chi tiết và OHLCV trả metadata này cùng `run_id`/`data_as_of` để đối chiếu và tái hiện kết quả.
- Universe được chốt riêng từ ba nhóm HOSE/HNX/UPCoM trước khi tải giá. Sàn và trạng thái niêm yết vì vậy vẫn được lưu cho mã thiếu OHLCV hoặc bị loại khỏi phân tích.
- Job QUANT giới hạn theo phiên bằng `QUANTIK_MAX_ACTIVE_JOBS_PER_OWNER` (mặc định 2) và `QUANTIK_MAX_JOBS_PER_24H` (mặc định 10). `Idempotency-Key` được kiểm tra trước quota để gửi lại cùng yêu cầu không tạo job mới. Worker chỉ phục hồi job mất heartbeat tối đa `QUANTIK_JOB_MAX_ATTEMPTS` lần (mặc định 3), sau đó ghi lỗi terminal cho job và scan run.
- API gắn `X-Request-ID` vào mọi response và log method/path/status/thời gian xử lý. Lỗi nguồn công khai được chuẩn hóa; traceback chỉ nằm trong log tiến trình, không trả qua API.
- Batch QUANT phát sự kiện tiến độ theo mỗi 10 mã và các pha cross-sectional/scoring; heartbeat worker tiếp tục độc lập. Phần trăm trên giao diện vì vậy đến từ tiến trình xử lý thật, kể cả giai đoạn sau khi đã tải xong OHLCV.
- Đã kiểm thử luồng FPT thật: quét, tạo job qua API, chạy quant-core, báo cáo và tải đủ 7 ảnh. Chưa xác nhận một đợt toàn sàn đủ 1.430 mã hoàn tất và đạt ngưỡng công bố trên máy hiện tại. Bảng điện là dữ liệu theo thời điểm nhà cung cấp trả về, không cam kết realtime.
- Backend hiện dùng SQLite và một worker, phù hợp tích hợp nội bộ. Chưa có tài khoản đăng nhập, phân quyền quản trị nhiều người, retry phân tán, hay PostgreSQL/Redis. Cần xác nhận quyền sử dụng nguồn dữ liệu trước khi công bố công khai.
- `include_backtest` kiểm định các tín hiệu MUA từ snapshot thật đã công bố theo nguyên tắc point-in-time: vào ở giá đóng cửa phiên kế tiếp, thoát sau số phiên cấu hình và trừ chi phí khứ hồi. Báo cáo chỉ trả chỉ số hiệu quả khi có ít nhất `QUANTIK_BACKTEST_MIN_SAMPLES` mẫu đã hoàn tất (mặc định 5); trước đó trả `insufficient_history`, không sinh số liệu giả.
- Job QUANT bắt buộc đọc OHLCV, VN-Index và sàn trực tiếp từ `reference_run_id` production đã công bố; báo cáo ghi `data_source_mode=published_scan_snapshot`. API từ chối tạo job cho mã không có kết quả `completed` hoặc thiếu OHLCV; worker cũng từ chối reference demo, reference thiếu hoặc snapshot đã mất thay vì fetch lại dữ liệu khác với trang chi tiết. Điểm job một mã vẫn ghi `score_comparable=false` và lý do vì không chạy lại phân phối cross-sectional toàn sàn.

Kiểm tra frontend: `pnpm build`. Kiểm tra API/queue: `cd backend && .venv\Scripts\python.exe -m unittest discover -s tests -v`. Kiểm tra nguồn thật trên database tạm: `cd backend && .venv\Scripts\python.exe tests\live_smoke.py`.

Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) chạy build frontend, toàn bộ unittest backend và `docker compose config` trên mọi push vào `main`/`codex/**` và mọi pull request vào `main`. Nhánh triển khai đi qua `codex/live-data`; chỉ gộp vào `main` sau khi lượt quét thật, kiểm thử giao diện và các job CI đều đạt.

