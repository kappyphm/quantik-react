# Khôi phục nâng cấp sản phẩm trên fork

Ngày: 08/10/2026. Base: `kwuangyong/QuanTik-website`, `main` tại `66f0e38903dc42b2017d66032994b1660bafd932`.

PR #4 bị đóng sau khi fork đồng bộ upstream. Bản này khôi phục tính năng đã làm trên main mới, giữ UI/UX QuanTik và tích hợp backend thật đang có. Tham chiếu plan trong PR #3.

## Phần đã khôi phục

- Scan: GET `/api/v1/scans/latest/highlights` chốt một publication và chọn tối đa 5 nổi bật/5 thận trọng, không chạy lại engine. Loại lỗi/FAIL/score thiếu hoặc ngoài 0–100. Ưu tiên hành động mua có gate thật; score không sinh nhãn mua. Không trùng/padding khi ít mã. Bộ lọc chỉ thu hẹp mười mã đã chọn.
- Tỷ suất: bốn preset tổng quan/dự báo/rủi ro/giao dịch, mở rộng 50 trường. Mapping từ summary_table và report gốc, giữ VND, phần trăm, zero và null. Read adapter bổ sung từ detail_json cho publication cũ mà không viết lại SQLite hoặc chạy mô hình. WinRate của giá ghi Tỷ lệ phiên tăng; Meta trust không gọi P(win).
- Hai điểm Quant: nút cạnh mã trong scan và nút cạnh chart popup. Scan mở popup và tự bắt đầu job; mở ticker/chart thường không tạo job. Controller dùng chung giữ job qua đóng popup và dedup hai nút trong cùng phiên trình duyệt. Backend vẫn dùng session/queue/quota/idempotency có sẵn; không tuyên bố dedup giữa tab/thiết bị.
- Visual: dải P05–P95/P25–P75 từ MC thật, histogram lợi suất cuối kỳ, HMM, drawdown lịch sử, factor radar và rủi ro/phương án. Payload research có schemaVersion=1, symbol, source, asOf, units VND/pct, horizon và số simulations. Không đưa raw MC paths xuống browser.
- HMM core chỉ giữ hard labels lịch sử: hiển thị nền nhãn và đường giá, không giả tạo posterior 0/1. Nếu payload có probabilities thật thì dùng stacked probability. Radar chỉ có khi core lưu factor_details; job một mã dùng absolute fallback có thể chưa có radar. Giá trị thiếu hiển thị trống. Report cũ P10/P90 không đổi nhãn thành P05/P95; cone trống cho đến chạy lại bằng presenter mới.
- Tooltip: hover/focus/chạm với năm mục lý thuyết, công thức, ví dụ, điều kiện/ngưỡng và cách dùng; Escape/chạm ngoài để đóng. Công thức/ngưỡng là tham chiếu, không phải validation của alpha.
- Bảng điện: đọc hết trang 50 mã từ provider, bỏ giới hạn 500. Metadata scan là tùy chọn, không chặn bảng khi chưa có publication. Không mất danh mục ở lần refresh tiếp theo. Giữ các hàng thiếu quote; giá null không thành 0, volume 0 vẫn là 0. Mặc định đầy đủ các nhóm cột; window rendering >300 hàng và tìm/sort trên toàn danh mục.

## Tích hợp trên main mới

Giữ nguyên `backend/quant_engine/*`, baseline, worker, scheduler, SQLite, session và OHLCV BackendChart. Các thay đổi backend nằm ở presenter, scan highlight GET và enrichment trường summary, không sửa chiến lược/core. Session cookie và API `/api/v1` của main tiếp tục được dùng. Report một mã giữ cảnh báo score_comparable=false, không ghi đè điểm scan toàn sàn.

Nguồn bảng điện khai báo độ trễ chưa xác nhận; thời điểm overview là thời điểm fetch nguồn, không cam kết tick real-time. Polling 60s; lần tải đủ toàn sàn cần nhiều request và cần kiểm tra quota/provider trên VPS. Không tự sinh trần/sàn/foreign/book hoặc giá khi provider thiếu. Khả năng dữ liệu thực tế phụ thuộc worker, publication và nguồn đã cấu hình.

## Kiểm tra

- `pnpm install --frozen-lockfile`.
- `pnpm test`: 16 kiểm tra selection/gate/units, 1.700 mã qua hai refresh, API v1 mapping, controller chung và render sáu visual.
- `python -m unittest discover -s backend/tests -v`: 27 tests, 26 pass và 1 skip reference directory vốn gitignored. Bao gồm các suite API/queue/scheduler/recovery của main và thêm highlights/presenter.
- `pnpm build`; `git diff --check`.
- Bốn file core so với base main phải không có diff.

Chưa chạy browser QA, Docker image/compose, live provider smoke hoặc VPS deployment trong phiên này. Giữ draft để review desktop/mobile, tooltip trong modal, scroll/focus bảng ảo và chi phí tải toàn sàn trước merge.
