# QuanTik — Đánh giá tính khả thi và rủi ro kỹ thuật

**Ngày đánh giá:** 2026-09-22 · **Cơ sở:** source hiện tại, [SRS](SRS.md), [System Design](SYSTEM_DESIGN.md) và số liệu chủ dự án cung cấp: chạy phân tích toàn sàn thủ công mất khoảng **1 giờ**. Chưa có phép đo riêng trên môi trường worker/production.

## 1. Kết luận

**Tiền đề của đánh giá:** mọi chức năng và mô hình hiện có trong `quant-core/` đã được kiểm chứng và khả thi. Tài liệu này **không đánh giá lại chất lượng hoặc khả năng hoạt động của thuật toán gốc**. Đối tượng đánh giá là việc vận hành chúng dưới dạng dịch vụ web cho nhiều người dùng, trên tập mã toàn sàn và lịch chạy hai lần/ngày.

**Khả thi về kiến trúc và đã có baseline vận hành ~1 giờ/lượt.** Giao diện giới thiệu/widget, API đọc kết quả, lưu lịch sử và job queue dùng công nghệ phổ biến. Phần cần chốt cho web là **mốc bắt đầu để kết quả ra đúng lúc**, **giữ đúng bối cảnh đầu vào của mô hình chấm điểm**, và **quyền sử dụng dữ liệu cho website công khai**. Thời gian ~1 giờ là số đo từ cách chạy thủ công; thời gian trong worker có thể khác do máy, nguồn dữ liệu, retry và tải đồng thời.

| Hạng mục | Khả thi | Phức tạp | Điều kiện chính |
|---|---|---|---|
| Trang chủ nhúng widget | Cao | Thấp | Widget hiển thị được mã/sàn mong muốn; ghi đúng độ trễ. |
| Trang kết quả/chi tiết từ DB | Cao | Trung bình | Chuẩn hóa schema và trạng thái mã lỗi. |
| Job QUANT + biểu đồ + xem lại | Cao | Trung bình–cao | Worker bền vững, quyền truy cập, quản lý artifact. |
| Quét toàn bộ HOSE/HNX/UPCoM 2 lần/ngày | Khả thi theo baseline ~1 giờ/lượt | Cao về vận hành | Chọn giờ bắt đầu sớm đủ, dành biên dự phòng, đo lại trong worker. |
| Giữ điểm QUANT một mã so sánh được với toàn sàn trong web | Có điều kiện | Cao | Lưu/tái dùng tập tham chiếu và artifact của mô hình gốc. |
| Đưa backtest gốc lên API cho một mã vừa yêu cầu | Có điều kiện về dữ liệu | Cao | Có đủ tín hiệu lịch sử đã lưu và dữ liệu point-in-time; kết quả tương lai của tín hiệu mới chưa tồn tại. |

**Ước lượng sơ bộ:** 10–16 tuần công của một kỹ sư full-stack có kinh nghiệm Python/React, gồm spike dữ liệu, tích hợp, test và vận hành; với hai người làm song song khoảng 6–10 tuần lịch nếu nguồn dữ liệu được giải quyết sớm. Đây là ước lượng kế hoạch, **không phải cam kết**, và chưa tính thời gian xin quyền/đổi nhà cung cấp dữ liệu.

## 2. Rủi ro ưu tiên cao

### R-01 — Quyền sử dụng và hạn mức dữ liệu: mức **chặn production**

`quant.py` gọi `vnstock_data`; `crawl_data.py` và `backtest.py` gọi `vnstock`. Đây là công cụ kết nối nguồn dữ liệu, không tự cấp quyền sở hữu dữ liệu. README hiện hành của Vnstock nêu hạn mức khách 20 gọi/phút, community 60 gọi/phút, sponsor 180–600 gọi/phút và yêu cầu tự kiểm điều khoản của nguồn dữ liệu; giấy phép và phạm vi phát lại dữ liệu cho sản phẩm công khai cần xác nhận theo phiên bản đang dùng. [Nguồn Vnstock](https://github.com/thinh-vu/vnstock)

**Tác động:** Baseline thực tế do chủ dự án cung cấp là khoảng 1 giờ/lượt trên cách chạy hiện nay. Nếu chuyển tài khoản, phiên bản thư viện hoặc nguồn dữ liệu, hạn mức khác có thể làm thời gian thay đổi. Với giả định 1.600 mã và chỉ 1 request/mã, mức 20 gọi/phút tạo cận dưới ~80 phút, 60 gọi/phút ~27 phút; đây là phép chia hạn mức, **không phủ định số đo ~1 giờ hiện có**.

**Giảm rủi ro:** ghi lại nguồn/tài khoản/quota của lượt chạy thủ công ~1 giờ và xác nhận quyền dùng cho web/API cùng quyền lưu/trình bày kết quả. Khi đưa sang worker, đo số request, độ trễ, lỗi và thời gian toàn lượt; chỉ thử tập nhỏ khi cần khoanh vùng nguyên nhân chậm. Nếu điều kiện nguồn không đạt cho dịch vụ công khai, chọn nguồn có hợp đồng/khả năng batch phù hợp. Không dùng nhiều tài khoản để né quota.

### R-02 — Thời gian vận hành mô hình ở quy mô toàn sàn: mức **cao**

Lượt chạy toàn sàn thủ công hiện mất khoảng **1 giờ**, nên tổng thời gian tính toán hai lượt/ngày có baseline khoảng **2 giờ**, chưa tính biên dự phòng và các job người dùng. Source fetch theo vòng lặp tuần tự với `sleep(0.3)` ở cả screener và quant; `HMMEngine.fit()` thử 10 lần khởi tạo/mã, mỗi mã còn ARIMA, GARCH và Monte Carlo. Vấn đề chính là lịch công bố: một run bắt đầu sát đầu phiên sẽ chỉ xong khoảng 1 giờ sau; run cuối phiên bắt đầu sau khi dữ liệu ngày hoàn tất và xong khoảng 1 giờ sau đó. [Code fetch](../quant-core/quant.py), [code HMM](../quant-core/quant.py)

**Giảm rủi ro:** dùng baseline 1 giờ để lập lịch với biên dự phòng và giữ kết quả run trước trong lúc chạy. Đo lại ít nhất một lượt toàn sàn bằng worker/máy triển khai, ghi thời gian từng pha và RAM; sau đó mới chốt timeout, mốc công bố và số worker. Cache OHLCV nếu cần tối ưu, nhưng giữ output đã kiểm chứng làm chuẩn đối chiếu. Không phát hành kết quả nửa chừng như đủ toàn sàn.

### R-03 — Giữ đúng bối cảnh chấm điểm khi thay tập mã: mức **cao**

`AdaptiveScorer.score_batch()` chuẩn hóa factor theo median/IQR của các mã hợp lệ; `CrossSectionalLightGBMEngine` còn xếp `rank_pct` theo các mã trong batch. Đây là **hành vi đúng của mô hình gốc**. Vì vậy chuyển từ top 70/nhóm nhỏ sang toàn sàn có thể thay đổi điểm và khuyến nghị dù công thức không sửa. `QuantPipeline.analyze()` riêng một mã trả điểm `PENDING` trước khi batch chấm. Rủi ro nằm ở chỗ API gắn nhầm điểm đơn mã với điểm toàn sàn. [Code scoring](../quant-core/quant.py)

**Giảm rủi ro:** định nghĩa rõ `universe_version`, danh sách mã đủ điều kiện và snapshot factor/model theo run. Không yêu cầu bản sao giữ điểm bit-for-bit khi universe cố ý thay đổi; regression phải so trên **cùng input và cùng universe**. Job một mã dùng snapshot batch đã công bố hoặc ghi `score_comparable=false` và không trưng điểm tương đương toàn sàn.

### R-04 — Chuyển ngữ nghĩa backtest gốc sang dịch vụ theo yêu cầu: mức **cao**

`backtest.py` đã có quy tắc kiểm định rõ: đọc file Excel khuyến nghị lịch sử, chỉ giữ top 5, điểm >75, timing hợp lệ và có `BACKTEST_START_DATE` cố định. Nó đánh giá **tín hiệu đã xảy ra**. Khi đưa lên API, cần giữ đúng các quy tắc này và không trình bày một tín hiệu vừa tạo như đã có kết quả thực tế. [Code lọc backtest](../quant-core/backtest.py)

**Giảm rủi ro:** tách hai tính năng: (a) backtest lịch sử chỉ khi đã có đủ snapshot khuyến nghị point-in-time và giá tương ứng; (b) đánh giá dự báo mới ở các phiên về sau. Trong MVP, `include_backtest` có thể trả `insufficient_history`; không giả lập số liệu hay gọi mô phỏng Monte Carlo là backtest thực tế. Cần thiết kế tập out-of-sample và chi phí rõ trước khi công bố chỉ số hiệu quả.

### R-05 — Bản gốc `quant-core/` chưa được Git theo dõi: mức **cao**

Ở checkout hiện tại, `git status` hiển thị `?? quant-core/`. Nếu chỉ nói “giữ nguyên” mà không snapshot, không có commit để phục hồi chính xác bản phân tích gốc.

**Giảm rủi ro:** trước thay đổi code, sao lưu/đưa bản gốc vào quản lý phiên bản, tạo SHA-256 manifest, sau đó sao chép sang `backend/quant_engine/`. CI phải kiểm manifest. Không sửa bất kỳ file nào trong `quant-core/`; không dùng symlink hoặc import từ bản gốc trong production.

## 3. Lỗ hổng và vấn đề thiết kế cần sửa

| ID / mức | Phát hiện và bằng chứng | Hướng xử lý |
|---|---|---|
| R-06 / cao | `crawl_data.py` được thiết kế để trả top 70 và bỏ qua mã thiếu dữ liệu/thanh khoản; `quant.py` dùng `AVOID`/điểm 0 cho một số report lỗi. Các hành vi này có thể đúng trong luồng gốc, nhưng **không đủ để biểu diễn danh sách toàn sàn** trên web nếu API sao chép nguyên output. | Tạo lớp biểu diễn web riêng: chốt universe trước, mỗi mã có row `analysis_status`; dữ liệu không tính được là `null`; không diễn giải `failed` thành khuyến nghị `AVOID`. Không sửa hành vi gốc trong `quant-core/`. |
| R-07 / cao | `quant.py` dùng `CFG` toàn cục, `run_pipeline()` gán lại; `FORECAST_LOG_PATH` là file CSV chung. Chạy scan và job cá nhân cùng lúc có nguy cơ dùng lẫn cấu hình/trạng thái hoặc ghi đè file. | Worker process cách ly, config immutable truyền tường minh; không gọi `run_pipeline()` nguyên khối trong web; chuyển forecast log/model state sang DB/object storage có version/lock. |
| R-08 / cao | `_completed_daily_bars()` chỉ nhận nến ngày hiện tại sau 16:00; `PRE_OPEN` và `POST_CLOSE` có thể dùng cùng một ngày dữ liệu, hoặc POST_CLOSE sớm quá sẽ dùng dữ liệu cũ. | Kiểm `last_bar_date` và `data_as_of` ở bước công bố. Cân nhắc PRE_OPEN chỉ tái công bố/liên kết phân tích POST_CLOSE trước nếu không có dữ liệu mới; không chạy lại mô hình vô ích. |
| R-09 / cao | `backend/server.py` hiện giữ job trong RAM, file ảnh cục bộ, không auth/rate limit và trả chuỗi exception trực tiếp; nếu đem lên mạng nguyên trạng sẽ mất job sau restart, lộ thông tin lỗi và có thể bị spam tác vụ CPU. | Thay bằng DB + queue, auth/quota, lỗi chuẩn không lộ stack/path, artifact theo quyền, timeout và chống trùng. Không tái sử dụng server PoC như production. |
| R-10 / trung bình–cao | Hai thư viện dữ liệu (`vnstock`, `vnstock_data`) và quy tắc giá nội bộ VND so với dữ liệu nghìn VND dễ tạo sai entry/SL/TP hoặc trộn dữ liệu điều chỉnh giá. | Một adapter chuẩn, schema đơn vị bắt buộc, fixture cho giá VND/1.000 VND, corporate action, timezone và exchange; lưu nguồn từng bar. |
| R-11 / cao | Widget TradingView miễn phí cho Việt Nam hiện liệt kê HNX/UPCoM ở mức EOD, chưa thấy HOSE trong danh sách widget; FAQ nêu widget không cho đưa dữ liệu riêng vào và gói trả phí người dùng không làm widget của website có realtime. `TVWidget.jsx` hiện luôn ghép `HOSE:${sym}` cho chart chi tiết. | Thử widget trên mã HOSE/HNX/UPCoM thật, map symbol theo sàn; có fallback link ngoài hoặc chọn widget khác. Ghi rõ EOD/delayed. Không lấy widget làm nguồn dữ liệu phân tích. [TradingView coverage](https://www.tradingview.com/widget-docs/markets/asia-pacific/), [FAQ dữ liệu](https://www.tradingview.com/widget-docs/faq/data/) |
| R-12 / trung bình | SSE reconnect và tiến độ trong DB chưa đủ nếu broker enqueue lỗi giữa transaction hoặc worker mất heartbeat. | Ghi `job_events`, watchdog, retry idempotent; cân nhắc transactional outbox nếu chạy nhiều API/worker hoặc đòi bảo đảm dispatch cao. |
| R-13 / trung bình | Mô hình nặng tùy thư viện và OS; source hiện import động `arch`, `hmmlearn`, `lightgbm`, `statsmodels`, `vnstock_data`. Thiếu gói có thể âm thầm fallback, làm kết quả khác nhau giữa môi trường. | Lock dependency, startup capability check, lưu `module_availability`/`model_version`; CI chạy fixture trong image production. Dùng Docker/WSL để tránh khác biệt worker Windows. |
| R-14 / trung bình | `quant_visuals.py` có 7 biểu đồ/mã; lưu tất cả cho nhiều job có thể tăng dung lượng và thời gian render. | Chỉ tạo cho job chuyên sâu, tạo manifest và retention; không tạo chart cho toàn bộ mã trong cron mặc định. |
| R-15 / trung bình | SRS hiện mô tả khách xem latest; nếu run mới công bố giữa khi người dùng chuyển từ danh sách sang chi tiết, hai trang có thể khác run. | Response nào cũng có `run_id`; UI phát hiện thay đổi và báo tải lại. Nếu yêu cầu snapshot tuyệt đối, mở quyền đọc run đã công bố theo ID cho khách trong một khoảng thời gian cấu hình. |

## 4. Bảo mật và vận hành

1. **Quyền truy cập:** chi tiết scan công khai theo SRS; job/report/artifact của người dùng chỉ chủ sở hữu/admin đọc. SSE phải kiểm quyền giống GET; signed URL có thời hạn ngắn.
2. **Chống lạm dụng:** đăng nhập trước khi tạo job; quota đồng thời/ngày, giới hạn request body, idempotency key, rate limit theo user/IP, CPU/time/memory limit ở worker. Không để người dùng chọn tham số mô hình tùy ý làm tăng tải không kiểm soát.
3. **Lỗi và dữ liệu nhạy cảm:** không trả raw exception như PoC; log nội bộ có `request_id`, không ghi credential và dữ liệu tài khoản vào report công khai.
4. **Sẵn sàng:** một Celery Beat duy nhất, khóa DB chống tạo run trùng, worker riêng cho scan và job cá nhân, backup DB/artifact và thử restore. [Celery periodic tasks](https://docs.celeryq.dev/en/latest/userguide/periodic-tasks.html)
5. **Theo dõi tính đúng:** dashboard nội bộ theo `data_as_of`, độ phủ mã, số model fallback, tỷ lệ job fail và độ trễ từ giờ slot tới khi published. Một run lỗi không được tự thay latest.

## 5. Điều kiện cần đạt trước khi cam kết production

| Gate | Bằng chứng cần có | Nếu không đạt |
|---|---|---|
| Dữ liệu | Xác định điều kiện nguồn của lượt thủ công ~1 giờ; nguồn được phép dùng cho sản phẩm, quota và coverage đủ HOSE/HNX/UPCoM; một lượt worker toàn sàn đạt yêu cầu. | Đổi nguồn hoặc điều chỉnh kế hoạch công bố có thông báo rõ. |
| Hiệu năng | Benchmark fetch + screener + batch model + DB trên máy dự kiến, ước lượng toàn sàn có biên độ an toàn trước slot kế tiếp. | Tách pha/cache, tăng hạ tầng, đổi deadline; chưa hứa 2 bản hoàn chỉnh/ngày. |
| Bảo toàn logic đã kiểm chứng | Baseline `quant-core/` có checksum; bản sao cùng input/config/universe cho kết quả tương đương; khác biệt do tích hợp có giải thích. | Chặn phát hành bản web, giữ nguyên bản gốc. |
| Backtest | Có lịch sử point-in-time đủ mẫu, không dùng dữ liệu tương lai và không lẫn mô phỏng với hiệu quả thực. | Ẩn/chú thích tính năng `insufficient_history`. |
| Vận hành | Restart API/worker, lỗi nguồn, run một phần, mất SSE, hủy/retry job, backup/restore đều được diễn tập. | Giữ staging, chưa mở job cho người dùng. |

## 6. Đề xuất điều chỉnh kế hoạch

1. **Xác nhận baseline ~1 giờ là giai đoạn 0**: ghi rõ số mã, máy, nguồn dữ liệu và thời gian từng pha của cách chạy thủ công; chạy lại một lượt toàn sàn trong worker để định lịch hai slot với biên dự phòng.
2. **MVP 1:** trang chủ widget + kết quả QUANT đã lưu + chi tiết; chạy scan thủ công và chỉ công bố khi đủ dữ liệu.
3. **MVP 2:** scheduler hai slot, quyền người dùng, job QUANT và biểu đồ; bật sau khi gate dữ liệu/hiệu năng qua.
4. **Backtest lịch sử là phần riêng** sau khi có đủ snapshot đầu ra hoặc dữ liệu cũ đáng tin; không làm điều kiện chặn job phân tích một mã.
5. Nếu PRE_OPEN không có dữ liệu mới, **tái dùng snapshot POST_CLOSE trước** với nhãn “dữ liệu phiên trước”, thay vì chạy lại toàn bộ mô hình và tốn quota.
