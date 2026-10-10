"""Vietnamese, evidence-based explanations of the exact completed model run."""
from __future__ import annotations

import math
from quant_narrative import narrative


CATALOG = [
    ('data_quality', 'M0 · Chất lượng dữ liệu', 'Kiểm tra tính hợp lệ của OHLCV và quy tắc sàn; dữ liệu sai bị chặn trước khi chạy mô hình.', 'OHLCV khung ngày'),
    ('liquidity', 'M0 · Thanh khoản', 'Đo giá trị giao dịch và giới hạn quy mô vị thế trên lịch sử giá × khối lượng.', 'Giá, khối lượng, sàn giao dịch'),
    ('dist', 'M1 · Phân phối lợi suất', 'Kiểm định phân phối của rₜ = Cₜ/Cₜ₋₁ − 1; kiểm tra skewness, excess kurtosis và đuôi phân phối.', 'Lợi suất đóng cửa theo ngày'),
    ('stats', 'M2 · Hiệu suất và rủi ro lịch sử', 'Sharpe = (252 × lợi suất ngày trung bình − lãi suất phi rủi ro)/(độ lệch chuẩn ngày × √252). MaxDD đo sụt giảm từ đỉnh lịch sử.', 'Lợi suất giá, chưa phải lợi suất chiến lược'),
    ('vol', 'M2 · Chế độ biến động', 'Vol Ratio = độ lệch chuẩn lợi suất 10 phiên / độ lệch chuẩn 60 phiên. Core dùng < 0,7 cho co hẹp và > 1,3 cho mở rộng.', 'Cửa sổ lợi suất ngày 10/20/60 phiên'),
    ('ac', 'M2 · Tự tương quan', 'So sánh trung bình tự tương quan lag 1–3 với ngưỡng 2/√N để mô tả cấu trúc chuỗi lợi suất.', 'Lợi suất và các độ trễ'),
    ('arima', 'M3 · ARIMA', 'Kiểm tra ADF trên lợi suất, thử các bậc AR/MA và chọn mô hình theo AIC. Dự báo lợi suất được ghép thành đường giá.', 'Lợi suất đóng cửa lịch sử'),
    ('garch', 'M4 · GARCH / EGARCH', 'Ước lượng biến động có điều kiện. GARCH-t dùng cú sốc bình phương và phương sai quá khứ; EGARCH mô tả bất đối xứng cú sốc.', 'Lợi suất ngày tính theo %'),
    ('hmm', 'M5 · Trạng thái HMM', 'Ước lượng trạng thái ẩn từ lợi suất, biến động và hoạt động khối lượng; nhãn Bull/Bear/Sideway xuất phát từ đặc trưng từng trạng thái.', 'Đặc trưng giá–biến động–khối lượng'),
    ('alpha', 'M6 · Alpha và sức mạnh tương đối', 'So sánh chuỗi giá với VN-Index và trích xuất các tín hiệu kỹ thuật; beta/alpha là ước lượng trên dữ liệu quan sát.', 'OHLCV cổ phiếu và VN-Index'),
    ('sr', 'M7 · Hỗ trợ / kháng cự', 'Nhóm các cực trị swing thành vùng giá, xét số lần chạm và độ gần về thời gian.', 'Đỉnh/đáy OHLCV lịch sử'),
    ('trend', 'M7 · Chất lượng xu hướng', 'ER = |C cuối − C đầu| / tổng |thay đổi giá từng phiên| trong 20 phiên; slope và R² mô tả hướng và độ khớp.', '21 mức đóng cửa gần nhất'),
    ('flow', 'M7 · Dòng tiền CMF', 'CMF = Σ[V × (2C − H − L)/(H − L)] / ΣV trong 20 phiên cuối. Phiên H = L có đóng góp bằng 0 theo core.', 'High, Low, Close, Volume của 20 phiên cuối'),
    ('momentum_alpha', 'M8 · Momentum', 'Gộp tín hiệu động lượng 5/10/20/60 phiên với chất lượng xu hướng; các cửa sổ tương quan không được đếm như alpha độc lập.', 'Lịch sử đóng cửa nhiều cửa sổ'),
    ('hurst', 'M8 · Hurst / định tuyến regime', 'Ước lượng tính bền xu hướng hoặc hồi quy về trung bình của chuỗi và dùng để định tuyến tín hiệu.', 'Chuỗi giá đóng cửa'),
    ('conditional_mr', 'M8 · Hồi quy phần dư có điều kiện', 'Xét phần dư sau tác động thị trường/ngành; chỉ kích hoạt mean reversion khi regime và các điều kiện của core cho phép.', 'Giá cổ phiếu, VN-Index và dữ liệu ngành khả dụng'),
    ('lightgbm_cross_sectional', 'M8 · LightGBM cross-sectional', 'Huấn luyện tín hiệu tương đối trên nhiều mã theo thời điểm. Job chỉ có một mã thường không đủ universe để huấn luyện.', 'Đặc trưng của nhiều cổ phiếu'),
    ('cross_corr', 'M8 · Tương quan / VAR ngành', 'Tính tương quan, tương quan trễ và VAR trên các mã cùng ngành có lịch sử chung.', 'Lợi suất nhiều mã cùng ngành'),
    ('sector', 'M8 · Bối cảnh ngành', 'Tổng hợp xu hướng ngành từ các mã có dữ liệu trong batch.', 'Phân ngành và lịch sử các mã khả dụng'),
    ('cross_sectional_model', 'M8 · Chẩn đoán huấn luyện cross-sectional', 'Theo dõi cỡ mẫu, khả năng huấn luyện và chất lượng kiểm định của model nhiều mã.', 'Universe và các hàng đặc trưng huấn luyện'),
    ('fcast', 'M8 · Đồng thuận và Monte Carlo', 'Tổng hợp phiếu directional alpha; Monte Carlo với biến động GARCH mô tả phân phối rủi ro và kịch bản giá.', 'Momentum, Hurst, HMM, các alpha khả dụng và mô phỏng'),
    ('meta_label_model', 'M8 · Meta-label', 'Logistic meta-label đánh giá độ tin cậy của tín hiệu sau khi có đủ giao dịch đã đánh giá; thiếu mẫu thì ở warm-up.', 'Lịch sử tín hiệu/giao dịch đã đánh giá'),
    ('costs', 'M9 · Chi phí giao dịch', 'Điều chỉnh dự báo theo phí, thuế và tác động thanh khoản theo cấu hình core.', 'Dự báo, giá trị giao dịch và giả định chi phí'),
    ('sl', 'M9 · Mức vào / dừng lỗ / chốt lời', 'Xây dựng mức giá từ ATR, cấu trúc giá, rủi ro mô phỏng và quy tắc sàn.', 'OHLCV, dự báo và giới hạn thị trường'),
    ('pos', 'M9 · Quy mô vị thế', 'Tính quy mô dựa trên khoảng cách entry–stop, ngân sách rủi ro và giới hạn thanh khoản.', 'Giá vào, dừng lỗ và quy mô tài khoản cấu hình'),
    ('kelly', 'M9 · Kelly', 'Core chỉ cho phép Kelly khi đầu vào là thống kê giao dịch đã được kiểm định và hiệu chỉnh.', 'Thống kê giao dịch; không dùng tỷ lệ ngày tăng'),
    ('rec', 'Tổng hợp · Điểm Quant', 'Tổng hợp các yếu tố và cổng rủi ro. Điểm của batch một mã thiếu phân phối toàn sàn để so sánh cross-sectional.', 'Các module đã chạy'),
    ('action', 'Tổng hợp · Điều kiện hành động', 'Quyết định từ đồng thuận, risk gate, chi phí và điều kiện thị trường của core.', 'Điểm và các cổng điều kiện'),
]


def safe_result(value):
    """Exclude private paths/arrays; keep public diagnostics, including failed models."""
    if isinstance(value, dict):
        return {str(k): safe_result(v) for k, v in value.items() if not str(k).startswith('_')}
    if isinstance(value, (list, tuple)):
        return [safe_result(v) for v in value]
    return value


def number(value):
    if isinstance(value, bool):
        return None
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def show(value):
    return f'{number(value):.3f}' if number(value) is not None else str(value or 'chưa có')


def module_reports(report, prices):
    modules = []
    for key, title, method, inputs in CATALOG:
        result = safe_result(report.get(key) or {})
        if not isinstance(result, dict):
            result = {'value': result}
        status = ('missing' if not result else 'disabled' if result.get('disabled') else
                  'unavailable' if result.get('error') or result.get('available') is False else
                  'fallback' if result.get('method') == 'fallback' else 'computed')
        if str(result.get('status', '')).upper() == 'WARMUP':
            status = 'warmup'
        if status == 'computed' and any(isinstance(v, dict) and v.get('error') for v in result.values()):
            status = 'partial'
        if key == "garch" and all(isinstance(result.get(branch), dict) and result[branch].get("error") for branch in ("garch", "egarch")):
            status = "unavailable"
        detail = narrative(key, result, prices, status)
        text = detail["reading"] + " " + detail["why"]
        limitation = ("CMF là proxy từ giá–khối lượng, không đo tiền rút/nạp thực tế. " if key == "flow" else "") + detail["connection"]
        modules.append({'id': key, 'title': title, 'status': status, 'inputs': inputs,
                        'method': method, 'explanation': text, 'limitations': limitation,
                        'result': result, **detail})
    return modules
