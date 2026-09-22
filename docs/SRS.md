# QuanTik — Đặc tả yêu cầu phần mềm (SRS)

**Phiên bản:** 1.0 · **Ngày:** 2026-09-22 · **Trạng thái:** Đề xuất triển khai  
**Tài liệu đi kèm:** [System Design](SYSTEM_DESIGN.md)

## 1. Mục đích và phạm vi

QuanTik là dịch vụ web cho thị trường cổ phiếu Việt Nam. Hệ thống định kỳ thu thập dữ liệu, sàng lọc và phân tích định lượng toàn bộ tập mã thuộc HOSE, HNX, UPCoM; lưu từng đợt phân tích để người dùng tra cứu. Người dùng có thể yêu cầu báo cáo QUANT chuyên sâu cho một mã qua hàng đợi tác vụ và xem lại sau.

**Ràng buộc bảo toàn source:** thư mục `quant-core/` là bản phân tích gốc đã được kiểm chứng và phải được giữ nguyên làm tham chiếu. Mọi chỉnh sửa, tách module, tối ưu hoặc tích hợp web/API chỉ thực hiện trên **bản sao** ở thư mục khác. Không sửa, di chuyển, xóa, đổi tên hay format hàng loạt file trong `quant-core/`; production không chạy trực tiếp từ bản tham chiếu này.

**Tiền đề nghiệm thu:** các chức năng và mô hình đã có trong `quant-core/` được chấp nhận là đã kiểm chứng và khả thi. Kiểm thử dự án web tập trung vào việc bảo toàn kết quả khi sao chép/tích hợp, hợp đồng dữ liệu và khả năng vận hành ở quy mô yêu cầu; không đặt lại yêu cầu chứng minh thuật toán gốc từ đầu.

**Số liệu vận hành hiện có:** một lượt phân tích toàn sàn chạy thủ công mất khoảng **1 giờ** theo thông tin của chủ dự án. Đây là baseline lập lịch cho phiên bản web; cần đo lại trên môi trường worker để xác định thời gian thực tế và biên dự phòng.

Trang chủ là trang giới thiệu và hiển thị **bảng điện tự dựng**. Biểu đồ dùng Lightweight Charts; dữ liệu bảng điện do API backend cấp từ nguồn thị trường được phép sử dụng. Trang chủ không yêu cầu tìm kiếm/lọc/chọn mã. Nút **QUÉT TOÀN SÀN** dẫn tới trang kết quả phân tích, nơi người dùng tìm, lọc và mở chi tiết mã. PoC dùng số liệu giả lập có nhãn rõ.

### 1.1 Mục tiêu

| ID | Mục tiêu có thể kiểm chứng |
|---|---|
| G-01 | Có hai đợt phân tích theo lịch mỗi ngày giao dịch: trước phiên và sau khi dữ liệu ngày được xem là hoàn tất. |
| G-02 | Kết quả mới nhất đã công bố xem được công khai, gồm danh sách và chi tiết theo mã. |
| G-03 | Kết quả của từng đợt, kể cả mã bị loại/thiếu dữ liệu/lỗi, còn truy xuất được theo quyền. |
| G-04 | Người dùng gửi yêu cầu QUANT một mã, theo dõi trạng thái, nhận báo cáo và biểu đồ, xem lại sau. |
| G-05 | Giao diện mới giữ concept terminal tối, màu hổ phách, màu tăng/giảm và font của PoC. |
| G-06 | Bảo toàn nguyên trạng `quant-core/` và chứng minh bản triển khai mới không làm thay đổi logic phân tích đã kiểm chứng ngoài những thay đổi được ghi rõ. |

### 1.2 Ngoài phạm vi bản đầu

Đặt lệnh và quản lý tài khoản chứng khoán; tự vận hành hạ tầng feed giá realtime hoặc phát lại dữ liệu giá bên thứ ba khi chưa có quyền; tự động giao dịch; bảo đảm hiệu quả đầu tư; xuất Google Sheets/Excel như một luồng nghiệp vụ bắt buộc; so sánh hiệu quả thực tế của một tín hiệu mới trước khi đủ thời gian quan sát.

## 2. Đối tượng và quyền

| Vai trò | Quyền tối thiểu |
|---|---|
| Khách | Xem trang chủ, kết quả **đợt mới nhất đã công bố**, danh sách và chi tiết mã. Không tạo job. |
| Người dùng đăng nhập | Toàn bộ quyền khách; tạo job QUANT, theo dõi và xem lại **job/báo cáo của mình**. |
| Quản trị viên | Xem mọi đợt phân tích và lỗi vận hành; xem/quản lý mọi job; kích hoạt chạy lại đợt quét, xem thông số lịch và trạng thái nguồn dữ liệu. |

**Quy tắc:** API kiểm tra quyền ở server; không dựa vào việc ẩn nút trên giao diện. Một mã có kết quả lỗi vẫn có trang chi tiết với lý do lỗi, không được âm thầm biến mất.

## 3. Luồng người dùng

1. Vào `/`: đọc giới thiệu, xem bảng điện tổng quan; nhấn **QUÉT TOÀN SÀN**.
2. Vào `/scan`: xem đợt đã công bố gần nhất, thời điểm dữ liệu và mức độ hoàn tất; tìm mã/tên, lọc sàn, khuyến nghị, đạt bộ lọc, ngành, điểm; sắp xếp và phân trang.
3. Chọn một mã để vào `/stocks/{symbol}`: xem đánh giá đã lưu, giải thích điều kiện, các chỉ số chi tiết và biểu đồ nến/khối lượng bằng Lightweight Charts từ OHLCV do backend cấp. Hiển thị rõ đợt phân tích và thời điểm chốt dữ liệu.
4. Người dùng đăng nhập nhấn **Chạy phân tích QUANT**. API trả `job_id` ngay; giao diện chuyển tới `/quant/jobs/{job_id}` và cập nhật `queued → running → succeeded/failed` kèm bước hiện tại.
5. Sau khi hoàn tất, người dùng xem báo cáo, bộ biểu đồ, thông tin kiểm định lịch sử nếu chạy được, và mở lại báo cáo qua `/quant/reports`.

## 4. Yêu cầu chức năng

### 4.1 Trang chủ và điều hướng

| ID | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|
| FR-H01 | Trang chủ có mô tả ngắn về phân tích, thời điểm đợt quét gần nhất, CTA **QUÉT TOÀN SÀN** và bảng điện gồm chỉ số, biến động, giá, khối lượng, biểu đồ. Danh sách mã có phân trang và chọn số dòng mỗi trang. | CTA đi tới `/scan`; thông tin đợt quét và bảng điện lấy từ API riêng. |
| FR-H02 | Trang chủ không có bộ lọc/tìm kiếm/chọn mã từ bảng điện. | Luồng mở chi tiết mã đi qua trang `/scan`. |
| FR-H03 | API bảng điện lỗi hoặc chưa có dữ liệu thì hiển thị trạng thái thiếu dữ liệu và thời điểm cập nhật thành công cuối cùng nếu có. | CTA quét toàn sàn vẫn dùng được. |
| FR-H04 | Nêu nguồn, thời điểm cập nhật và độ trễ của bảng điện theo dữ liệu được cấp. | Không gắn nhãn “realtime” khi feed chỉ có dữ liệu EOD/trễ; PoC ghi rõ dữ liệu giả lập. |

### 4.1a Bảo toàn quant-core gốc

| ID | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|
| FR-C01 | Trước khi tích hợp, sao chép các file phân tích cần dùng từ `quant-core/` sang package triển khai riêng. | Có manifest file và SHA-256 của bản gốc tại thời điểm sao chép; code API/worker import từ bản sao. |
| FR-C02 | Mọi chỉnh sửa phục vụ API/queue/database, kể cả sửa bug phát hiện trong lúc tích hợp, chỉ áp dụng trên bản sao. | Diff của `quant-core/` so với manifest ban đầu bằng 0; thay đổi trong bản sao có ghi mục đích. |
| FR-C03 | Kết quả phân tích của bản sao được đối chiếu với bản gốc trên fixture đã chốt trước khi công bố. | So trên **cùng dữ liệu, cấu hình và universe**; sai khác ở khuyến nghị, điểm, gate hoặc chỉ số chính phải có giải thích và phê duyệt riêng trước khi phát hành. Việc mở rộng universe được đánh giá riêng vì điểm cross-sectional có thể đổi dù công thức giữ nguyên. |

### 4.2 Thu thập và phân tích toàn sàn

| ID | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|
| FR-S01 | Tạo universe mã HOSE, HNX, UPCoM; loại trùng, lưu mã/sàn/tình trạng niêm yết. | Mỗi mã có một bản ghi trong đợt, kể cả mã không phân tích thành công. |
| FR-S02 | Lấy OHLCV lịch sử, VN-Index và thông tin ngành; chuẩn hóa đơn vị giá, timezone, sàn và ngày dữ liệu. | Có metadata nguồn, `data_as_of`, số phiên và cờ chất lượng dữ liệu. |
| FR-S03 | Chạy 21 tiêu chí screener và các mô hình của `QuantPipeline.batch()` trên tập hợp hợp lệ. | Lưu cả tín hiệu screener lẫn kết quả QUANT; không chỉ lưu top 70. |
| FR-S04 | Mã bị thiếu dữ liệu, không đạt thanh khoản hoặc không xác định sàn được đánh dấu `insufficient_data`, `screened_out` hoặc `failed` cùng reason code. | API và admin phân biệt rõ các trạng thái. |
| FR-S05 | Chạy hai slot `PRE_OPEN` và `POST_CLOSE` theo lịch ngày giao dịch, múi giờ `Asia/Ho_Chi_Minh`; lịch giờ là cấu hình triển khai. | Ngày nghỉ không chạy; một slot/ngày không tạo hai đợt trùng; admin có thể chạy lại có kiểm soát. |
| FR-S06 | `PRE_OPEN` dùng phiên ngày đã hoàn tất gần nhất; `POST_CLOSE` chỉ dùng dữ liệu ngày mới sau ngưỡng hoàn tất và kiểm tra độ mới. | UI hiển thị `data_as_of`; không gọi kết quả trước phiên là phân tích giá trong phiên. |
| FR-S07 | Đợt chỉ được “công bố” khi qua kiểm tra số mã, độ mới, tính toàn vẹn và tỷ lệ lỗi theo ngưỡng cấu hình. | Đợt lỗi/thiếu dữ liệu không thay thế đợt công bố trước; admin thấy nguyên nhân. |
| FR-S08 | Lưu đầy đủ metadata, phiên bản mô hình, cấu hình và thời gian thực thi để tái hiện kết quả. | Mỗi kết quả gắn `scan_run_id`, `model_version`, `source_version` và `data_as_of`. |
| FR-S09 | API không chờ đồng bộ lượt quét toàn sàn khoảng 1 giờ; trong khi run mới xử lý, người dùng tiếp tục xem run đã công bố gần nhất. | Trang kết quả không timeout/hiển thị dữ liệu dở; admin thấy tiến độ, thời gian bắt đầu và thời gian đã chạy. |

### 4.3 Kết quả quét và chi tiết mã

| ID | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|
| FR-R01 | API công khai trả đợt công bố mới nhất, danh sách summary, chi tiết theo mã. | Mỗi response mang `run_id`; nếu run mới công bố giữa lúc chuyển trang, UI báo dữ liệu vừa cập nhật. `404` khi mã không thuộc universe. |
| FR-R02 | Bảng `/scan` chỉ có 10 cột theo thứ tự ở mục 5. | Các chỉ số bổ sung nằm ở trang chi tiết, không thêm cột mặc định. |
| FR-R03 | Tìm mã/tên; lọc theo sàn, khuyến nghị, đạt bộ lọc, ngành, khoảng điểm; sắp xếp có whitelist, phân trang và chọn số dòng mỗi trang. | URL lưu bộ lọc, trang và số dòng để có thể chia sẻ/tải lại; đổi bộ lọc đưa về trang đầu. |
| FR-R04 | Trang chi tiết có biểu đồ nến/khối lượng Lightweight Charts, khuyến nghị, lý do, screener, xu hướng, thống kê, dự báo, quản trị rủi ro và cảnh báo chất lượng dữ liệu khi có. | Biểu đồ dùng OHLCV cùng mốc chốt với kết quả đánh giá; chi tiết luôn ghi thời điểm chốt dữ liệu và trạng thái phân tích. |
| FR-R05 | Người dùng/admin tra cứu lịch sử theo quyền; khách chỉ được truy cập đợt công bố mới nhất. | API không lộ lịch sử qua ID đoán được. |

### 4.4 Phân tích QUANT theo yêu cầu

| ID | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|
| FR-Q01 | Người dùng gửi mã hợp lệ, chế độ phân tích và tùy chọn kiểm định lịch sử nếu đủ điều kiện. | API trả `202 Accepted`, `job_id`, URL trạng thái; yêu cầu sai trả `400/422`. |
| FR-Q02 | Job có trạng thái `queued`, `running`, `succeeded`, `failed`, `cancelled`; lưu bước, phần trăm, thông báo, mốc thời gian và lỗi an toàn cho UI. | Đóng trang/khởi động lại API không làm mất job hoặc kết quả đã lưu. |
| FR-Q03 | Worker **đẩy sự kiện tiến độ ngay khi chuyển bước/trạng thái**; API chuyển tiếp qua SSE tới giao diện, không cần polling định kỳ khi kết nối ổn định. Endpoint GET trạng thái là nguồn sự thật khi tải lại/mất kết nối. | Hai trình duyệt đang mở cùng job đều nhận thay đổi bước ngay sau khi worker ghi nhận; tải lại URL vẫn thấy trạng thái đúng. |
| FR-Q04 | Phân tích một mã sử dụng bối cảnh thị trường/ngành và phiên bản tập tham chiếu; điểm được đánh dấu `comparable` khi thật sự cùng cơ sở với đợt quét. | Không hiển thị điểm đơn mã như điểm toàn sàn nếu thiếu tập so sánh. |
| FR-Q05 | Tạo báo cáo JSON và các biểu đồ `quant_visuals.py`; lưu manifest biểu đồ gồm loại, đường dẫn, trạng thái tạo, lỗi từng biểu đồ. | Biểu đồ lỗi không làm mất toàn bộ báo cáo nếu phần phân tích đã xong. |
| FR-Q06 | Lịch sử job/báo cáo theo người dùng và mã; mở lại được qua URL ổn định. | Chỉ chủ job và admin được đọc; admin lọc được lỗi. |
| FR-Q07 | Giới hạn số job đang chờ/đang chạy theo người dùng; xử lý yêu cầu trùng bằng idempotency key. | Không tạo tác vụ nặng trùng ngoài ý muốn khi nhấn hai lần. |
| FR-Q08 | “Kiểm định lịch sử” chỉ dùng dữ liệu đã biết tại từng thời điểm; kết quả thực tế của tín hiệu mới đánh giá về sau bằng tác vụ riêng. | Báo cáo không trình bày mô phỏng lịch sử như lãi/lỗ đã xảy ra của tín hiệu mới. |

### 4.5 Quản trị

| ID | Yêu cầu | Tiêu chí nghiệm thu |
|---|---|---|
| FR-A01 | Admin xem danh sách đợt chạy, trạng thái, độ phủ, lỗi từng mã, thời gian, nguồn dữ liệu, phiên bản mô hình. | Có thể chẩn đoán nguyên nhân đợt chưa công bố. |
| FR-A02 | Admin kích hoạt lại slot hoặc quét thủ công, có kiểm tra trùng và ghi người thực hiện. | Không ghi đè bản ghi cũ; tạo run mới có liên kết nguồn gốc. |
| FR-A03 | Admin xem hàng đợi, lỗi job, số lần thử lại; có thể yêu cầu chạy lại job lỗi. | Có audit log cho thao tác quản trị. |

## 5. Hợp đồng dữ liệu bảng kết quả

Danh sách chỉ trả đúng các trường hiển thị sau; có thể kèm metadata cấp response như `run_id`, `data_as_of`, `published_at`, `total`, `page`.

| Thứ tự | Cột UI | Trường API | Nguồn dự kiến |
|---:|---|---|---|
| 1 | Mã | `symbol` | `Symbol` |
| 2 | Khuyến nghị | `recommendation` | `Action` đã chuẩn hóa |
| 3 | Đạt bộ lọc | `gate_pass` | `GatePass` |
| 4 | Giải thích điều kiện | `gate_explanation` | `GateReasons` đã dịch |
| 5 | Điểm | `score` | `Score` |
| 6 | Đánh giá | `rating` | `Rating` |
| 7 | Thời gian nắm giữ | `hold_plan` | `HoldPlan` |
| 8 | Xu hướng VN-Index | `vni_trend` | `VNI` |
| 9 | Nhóm ngành | `sector` | `NhomNganh` |
| 10 | Xu hướng ngành | `sector_trend` | `XuHuongNganh` |

Mã lỗi/thiếu dữ liệu vẫn có hàng; các giá trị không tính được là `null`, không đổi thành điểm 0. `gate_pass=false` cần reason code rõ. Dữ liệu số đi qua API ở đơn vị chuẩn (giá VND, tỷ lệ theo phần trăm khi tên trường có `_pct`); UI chỉ làm nhiệm vụ định dạng.

## 6. Yêu cầu phi chức năng và mục tiêu nghiệm thu

Các ngưỡng sau là **mục tiêu đề xuất**, cần đo lại bằng dữ liệu và hạ tầng thật ở giai đoạn thử tải.

| ID | Yêu cầu |
|---|---|
| NFR-01 | API summary `p95 < 800 ms` với phân trang 50 dòng trên môi trường triển khai chuẩn; chi tiết `p95 < 500 ms`. |
| NFR-02 | Job dài không chặn API. Một worker lỗi không làm mất trạng thái đã ghi; tác vụ có timeout, retry hữu hạn và xử lý trùng. |
| NFR-03 | Không công bố run có dữ liệu ngày không hợp lệ, sai đơn vị, thiếu VN-Index hoặc độ phủ dưới ngưỡng cấu hình. |
| NFR-04 | Mọi thời điểm lưu UTC, hiển thị `Asia/Ho_Chi_Minh`; lưu riêng `trading_date` và `data_as_of`. |
| NFR-05 | TLS cho môi trường triển khai; mật khẩu/secret qua biến môi trường hoặc secret manager; phân quyền API; giới hạn tần suất tạo job. |
| NFR-06 | Nhật ký có `request_id`, `run_id`, `job_id`; có số liệu số mã thu thập/thành công/thất bại, thời gian mỗi pha và cảnh báo khi slot không công bố. |
| NFR-07 | Backup PostgreSQL và kho biểu đồ; thử phục hồi định kỳ; không lưu file kết quả quan trọng duy nhất trên ổ cục bộ của API. |
| NFR-08 | Giao diện dùng được trên desktop/mobile; bảng 10 cột cuộn ngang trên màn hẹp; có trạng thái loading, empty, error và thao tác bàn phím cơ bản. |
| NFR-09 | Báo cáo ghi rõ thời điểm dữ liệu và đây là phân tích tham khảo; không gắn nhãn “xác suất thắng” cho chỉ số model agreement. |

## 7. Trường hợp biên bắt buộc

- Chưa có run nào: `/scan` hiển thị trạng thái chờ đợt đầu tiên, không trả dữ liệu giả.
- Run mới thất bại: giữ nguyên run đã công bố trước; ghi rõ ngày dữ liệu cũ.
- Mã đổi sàn/ngừng giao dịch/không có dữ liệu: giữ hàng với trạng thái và lý do.
- Widget bên thứ ba lỗi: trang chủ và CTA vẫn hoạt động.
- Người dùng tải lại khi job đang chạy: lấy lại trạng thái bằng `job_id`.
- Biểu đồ không tạo được: báo cáo số liệu vẫn đọc được, hiển thị biểu đồ bị bỏ qua.
- Dữ liệu trong phiên xuất hiện trước ngưỡng hoàn tất: `PRE_OPEN`/`POST_CLOSE` không vô tình dùng nến chưa hoàn tất.
- Retry worker sau khi mất kết nối: không nhân đôi run, kết quả hoặc biểu đồ.

## 8. Tiêu chí hoàn thành phát hành đầu

1. Chạy thử được cả hai slot trên một ngày giao dịch và bỏ qua ngày nghỉ; có log và trạng thái run.
2. Kết quả công bố chứa toàn bộ universe, gồm cả mã lỗi/loại, và API summary đúng 10 cột.
3. Khách mở danh sách và chi tiết; người dùng tạo job, theo dõi, xem báo cáo cũ; admin xem lịch sử và lỗi.
4. Không còn dữ liệu mẫu trong các luồng sản phẩm; bảng điện hiển thị nguồn, thời điểm và độ trễ đúng với feed.
5. Kiểm thử hồi quy trên dữ liệu cố định cho mapping screener/QUANT, đơn vị giá, cutoff dữ liệu, phân quyền và phục hồi job.
6. `quant-core/` giữ nguyên theo manifest SHA-256; API và worker chỉ import từ package bản sao.

## 9. Điểm cần xác nhận trước khi triển khai production

- Quyền sử dụng và phân phối dữ liệu thị trường Việt Nam cho bảng điện trang chủ và biểu đồ chi tiết. Lightweight Charts chỉ là thư viện hiển thị; cần nguồn giá/OHLCV hợp lệ, độ trễ và giới hạn truy cập rõ ràng trước production.
- Giờ chạy chính xác của hai slot, ngưỡng chờ dữ liệu cuối ngày và nguồn lịch ngày giao dịch; các giá trị phải cấu hình được.
- Mốc cần công bố kết quả đầu phiên phải cách giờ bắt đầu scan ít nhất khoảng 1 giờ **cộng biên dự phòng**; mốc cuối phiên phải tính thêm thời gian chờ dữ liệu ngày hoàn tất.
- Chính sách đăng ký/đăng nhập và thời gian giữ báo cáo; mặc định đề xuất khách chỉ đọc, job yêu cầu tài khoản.
- Tài nguyên máy và giới hạn nguồn dữ liệu để chốt SLA cho toàn bộ HOSE/HNX/UPCoM.
