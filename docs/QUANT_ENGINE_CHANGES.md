# Thay đổi trên bản sao quant engine

Baseline nguồn được ghi tại `docs/quant-core-baseline.sha256`. `quant-core/` bị Git ignore theo yêu cầu dự án và chỉ dùng để đối chiếu cục bộ. API, worker và test sản phẩm chỉ import package `backend/quant_engine/`.

## Các thay đổi có chủ đích

- `quant.py`: lớp lấy dữ liệu được nối với API `vnstock` 4 hiện tại; chuẩn hóa đầu vào và hỗ trợ truyền sẵn OHLCV/VN-Index/exchange map cho batch toàn sàn. Logic chạy mô hình nằm trong bản sao này để không sửa nguồn tham chiếu.
- `quant_visuals.py`: nhận trực tiếp report và price data đã chốt của job; có fallback layout cục bộ khi helper terminal dashboard không tồn tại, và trả manifest ảnh tạo được/lỗi từng ảnh.
- `crawl_data.py`: hash hiện khớp baseline; backend gọi các engine qua adapter `backend/engine.py` thay vì CLI top-70.
- `backtest.py`: hash hiện khớp baseline. Kiểm định point-in-time cho web nằm tại `backend/backtest_service.py` vì dữ liệu đầu vào là snapshot đã công bố trong SQLite, không phải file Excel lịch sử.

## Kiểm tra

`backend/tests/test_quant_core_integrity.py` xác nhận hash nguồn tham chiếu khi thư mục đó có mặt và phân tích AST để chặn production import ngược về nguồn tham chiếu. CI vẫn chạy khi `quant-core/` vắng mặt vì thư mục này không được publish lên Git.
