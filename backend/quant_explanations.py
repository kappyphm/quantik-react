"""Vietnamese, evidence-based explanations of the exact completed model run."""
from __future__ import annotations

import math


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


def explain(key, result, prices):
    evidence = []
    limitation = 'Kết quả mô tả dữ liệu và giả định của lần chạy này; cần xác nhận trên dữ liệu mới.'
    text = 'Các giá trị bên dưới là đầu ra của module trên dữ liệu của mã đang xem. Thiếu kết quả thì chưa thể kết luận.'
    if key == 'flow' and number(result.get('cmf')) is not None:
        cmf = number(result['cmf'])
        window = prices.tail(20)
        if {'high', 'low', 'close', 'volume'}.issubset(window.columns):
            spread = window.high - window.low
            multiplier = ((2 * window.close - window.high - window.low) / spread.replace(0, 1e-9))
            signed = multiplier * window.volume
            total = number(window.volume.sum()) or 0
            negative = -float(signed.clip(upper=0).sum())
            positive = float(signed.clip(lower=0).sum())
            evidence = [
                {'label': 'Số phiên trong cửa sổ', 'value': len(window), 'unit': 'phiên'},
                {'label': 'Tổng khối lượng', 'value': total, 'unit': 'cổ phiếu'},
                {'label': 'Đóng góp CMF phía dương', 'value': positive, 'unit': 'khối lượng có trọng số'},
                {'label': 'Đóng góp CMF phía âm (trị tuyệt đối)', 'value': negative, 'unit': 'khối lượng có trọng số'},
                {'label': 'CMF tính lại từ OHLCV', 'value': (positive-negative)/total if total else None, 'unit': ''},
            ]
        origin = ('các phiên đóng cửa ở nửa dưới biên độ nến có đóng góp khối lượng âm lớn hơn đóng góp dương' if cmf < 0 else
                  'các phiên đóng cửa ở nửa trên biên độ nến có đóng góp khối lượng dương lớn hơn đóng góp âm' if cmf > 0 else
                  'tổng đóng góp khối lượng có trọng số gần cân bằng hoặc cửa sổ không có khối lượng')
        signal = 'áp lực bán theo thước đo vị trí đóng cửa' if cmf < 0 else 'áp lực mua theo thước đo vị trí đóng cửa' if cmf > 0 else 'tín hiệu trung tính'
        text = f'CMF {cmf:+.3f} đến từ việc {origin} trong tối đa 20 phiên cuối; từ đó cho thấy {signal}. Mỗi phiên được cân theo khối lượng nên phiên giao dịch lớn ảnh hưởng mạnh hơn.'
        limitation = 'CMF là proxy từ giá–khối lượng, không đo tiền rút/nạp thực tế và không xác định ai đang mua bán. CMF −0,2 không có nghĩa 20% tiền đã rút ra.'
    elif key == 'stats':
        text = f'Sharpe {show(result.get("sharpe"))} được tạo từ lợi suất ngày trung bình sau lãi suất phi rủi ro, chia cho biến động và quy đổi năm. MaxDD {show(result.get("max_dd_pct"))}% đến từ mức sụt giá lớn nhất so với đỉnh trước đó. AnnRet {show(result.get("ann_return_pct"))}% là CAGR của đường giá trong cửa sổ.'
        limitation = 'Đây là thống kê giá, chưa trừ chi phí giao dịch; tỷ lệ phiên tăng không phải win rate của chiến lược. Sharpe cao cần kiểm tra số mẫu, phân phối và kiểm định ngoài mẫu.'
    elif key == 'dist':
        text = f'Excess kurtosis {show(result.get("excess_kurtosis"))} được tính từ phân phối lợi suất ngày so với mốc Gaussian bằng 0. Các p-value bên dưới kiểm tra dữ liệu có phù hợp giả thuyết phân phối chuẩn; bác bỏ giả thuyết cho thấy mô hình Gaussian có thể mô tả rủi ro đuôi chưa tốt.'
        limitation = 'Không bác bỏ giả thuyết chuẩn không chứng minh dữ liệu chuẩn. Kết quả phụ thuộc cửa sổ và cỡ mẫu.'
    elif key == 'vol':
        text = f'Vol Ratio {show(result.get("vol_ratio"))} đến từ biến động {show(result.get("vol_10d"))}% của 10 phiên chia cho {show(result.get("vol_60d"))}% của 60 phiên. Nhãn {result.get("regime", "chưa có")} mô tả mức co hẹp/mở rộng biến động, không xác định hướng tăng giảm.'
    elif key == 'ac':
        text = f'Tự tương quan ngắn hạn trung bình {show(result.get("avg_short"))} được so với ngưỡng {show(result.get("threshold"))}. Nhãn {result.get("behavior", "chưa có")} xuất phát từ quan hệ giữa lợi suất hiện tại và các lag 1–3, chứ không phải bảo đảm giá sẽ tiếp tục hoặc đảo chiều.'
    elif key == 'arima':
        text = f'{result.get("best", {}).get("order", "Chưa chọn được ARIMA")} được chọn bằng cách so AIC giữa các bậc AR/MA thử nghiệm; AIC hiện tại {show(result.get("best", {}).get("aic"))}. ADF p-value {show(result.get("stationarity", {}).get("adf_p"))} kiểm tra tính dừng của lợi suất. Đường dự báo ghép từng lợi suất ước lượng vào giá cuối.'
        limitation = 'AIC là tiêu chí tương đối giữa mô hình thử trên cùng dữ liệu, không phải độ chính xác ngoài mẫu.'
    elif key == 'garch':
        g = result.get('garch', {})
        text = f'GARCH dùng cú sốc lợi suất gần đây với α={show(g.get("alpha"))} và phương sai quá khứ với β={show(g.get("beta"))}. Persistence {show(g.get("persistence"))} = α+β mô tả độ kéo dài của cú sốc biến động. EGARCH bên dưới cho phép tác động cú sốc âm/dương khác nhau.'
        limitation = 'Đây là mô hình độ biến động có điều kiện, không phải tín hiệu hướng giá. Chú ý cảnh báo hội tụ và persistence trong kết quả.'
    elif key == 'hmm':
        text = f'Nhãn {result.get("current", "chưa có")} đến từ trạng thái ẩn phù hợp nhất với đặc trưng gần đây. Xác suất trạng thái {show(result.get("prob_pct"))}% đo mức gán trạng thái của mô hình; bảng chuyển trạng thái mô tả các chuyển đổi đã ước lượng trong lịch sử.'
        limitation = 'Xác suất HMM không phải xác suất giao dịch thắng. Nếu method=fallback, đây là quy tắc thay thế, không phải HMM đã fit.'
    elif key == 'alpha':
        relative = result.get('cross_sectional', {})
        text = f'RS 20 phiên {show(relative.get("rs_20d_pct"))}% xuất phát từ chênh lệch hiệu suất cổ phiếu với VN-Index trên cùng cửa sổ. Beta {show(relative.get("beta"))} mô tả độ nhạy với thị trường; alpha lịch sử là phần lợi suất chưa giải thích bởi quan hệ đó.'
        limitation = 'Alpha ước lượng trong lịch sử chưa chứng minh alpha có thể giao dịch sau chi phí hoặc bền ngoài mẫu.'
    elif key == 'trend':
        text = f'ER {show(result.get("er"))} đến từ độ dịch chuyển giá ròng so với tổng quãng đường giá trong 20 phiên. ER gần 1 cho thấy đường giá có hướng, gần 0 cho thấy nhiều dao động triệt tiêu nhau. Slope {show(result.get("slope_pct"))}% cho biết hướng thay đổi, trong khi ER tự nó không có dấu.'
    elif key == 'sr':
        text = f'{len(result.get("supports", []))} vùng hỗ trợ và {len(result.get("resistances", []))} vùng kháng cự đến từ các cụm cực trị swing. Giá vùng, số lần chạm và độ mạnh của từng cụm nằm trong kết quả chi tiết.'
        limitation = 'Vùng giá mô tả phản ứng lịch sử; giá có thể xuyên thủng hoặc không chạm lại.'
    elif key == 'momentum_alpha':
        text = f'Tín hiệu {result.get("signal", "chưa có")} với score {show(result.get("score"))} đến từ tổ hợp động lượng 5/10/20/60 phiên và độ sạch xu hướng. Bảng components cho biết từng cửa sổ đóng góp như thế nào.'
    elif key == 'hurst':
        text = f'Hurst {show(result.get("hurst"))} và nhãn {result.get("regime", "chưa có")} đến từ cấu trúc phụ thuộc theo thang thời gian của chuỗi. Giá trị và confidence được dùng để lựa chọn tín hiệu phù hợp với regime.'
        limitation = 'Ước lượng Hurst có thể nhiễu theo cửa sổ và cỡ mẫu; không phải định luật về đường giá tương lai.'
    elif key == 'conditional_mr':
        text = f'Tín hiệu {result.get("signal", "chưa có")} được tính sau khi xem phần dư so với thị trường/ngành và điều kiện regime. Trường active và reason bên dưới cho biết tín hiệu có được phép tham gia đồng thuận hay bị tắt.'
    elif key in ('lightgbm_cross_sectional', 'cross_corr', 'meta_label_model', 'cross_sectional_model', 'sector'):
        reason = result.get('reason') or result.get('error') or result.get('status')
        text = f'Module cần tập dữ liệu {"giao dịch đã đánh giá" if key == "meta_label_model" else "nhiều mã có lịch sử chung"}. Trạng thái/lý do hiện tại: {reason or "xem chẩn đoán bên dưới"}. Thiếu đầu vào thì module không tạo bằng chứng dự báo hợp lệ.'
        limitation = 'Không thay kết quả không khả dụng bằng số 0 hay một dự báo giả; job một mã không đại diện universe toàn sàn.'
    elif key == 'fcast':
        text = f'Đồng thuận {show(result.get("agreement_pct"))}% đến từ các tín hiệu directional đang khả dụng, với coverage {show(result.get("coverage_pct"))}%. Dự báo tổng hợp {show(result.get("ensemble_ret_pct"))}% và timing {result.get("timing_status", "chưa có")} là đầu ra kết hợp. Dải Monte Carlo xuất phát từ phân phối cú sốc và biến động được ước lượng trên cùng dữ liệu.'
        limitation = 'Agreement không phải xác suất thắng. Monte Carlo là phân phối kịch bản/rủi ro theo giả định; không phải một alpha hướng giá độc lập.'
    elif key == 'kelly':
        text = result.get('note') or 'Kelly chỉ có ý nghĩa với xác suất và tỷ lệ lãi/lỗ giao dịch đã được hiệu chỉnh.'
        limitation = 'Không suy ra Kelly từ tỷ lệ ngày tăng của cổ phiếu.'
    elif key == 'data_quality':
        text = f'Trạng thái {result.get("status", "chưa có")} xuất phát từ các kiểm tra cấu trúc dữ liệu. Trường flags và các chẩn đoán bên dưới ghi lý do đạt hoặc bị chặn.'
    elif key == 'liquidity':
        text = f'Giá trị giao dịch bình quân 20 phiên {show(result.get("adv20_value_vnd"))} đồng đến từ giá × khối lượng. Cổng thanh khoản {result.get("pass", "chưa có")} phản ánh dữ liệu có đáp ứng ngưỡng thực thi của core.'
        limitation = 'Khối lượng lịch sử không bảo đảm lệnh tương lai được khớp tại giá mong muốn.'
    elif key == 'costs':
        text = f'Dự báo ròng {show(result.get("net_forecast_pct"))}% xuất phát từ dự báo trước chi phí sau khi trừ các khoản phí, thuế và trượt giá giả định trong kết quả chi tiết.'
    elif key == 'sl':
        text = f'Entry {show(result.get("entry"))} đồng và stop {show(result.get("sl_swing"))} đồng đến từ giá quan sát, ATR và các cổng rủi ro. TP1/TP2 là các mức kế hoạch theo mô hình, không phải giá sẽ chắc chắn đạt.'
    elif key == 'pos':
        text = 'Quy mô vị thế bên dưới đến từ khoảng lỗ entry–stop, vốn tài khoản cấu hình và giới hạn thanh khoản. Cùng một stop, ngân sách rủi ro nhỏ hơn sẽ làm giảm số cổ phiếu có thể mua.'
        limitation = 'Vốn cấu hình trong core không phải vốn thực tế của người đang xem; cần điều chỉnh trước khi giao dịch.'
    elif key == 'rec':
        text = f'Điểm {show(result.get("score"))}/100 và nhãn {result.get("rating", "chưa có")} đến từ các yếu tố trong factor_details cùng risk gate. Xem trọng số và thành phần để hiểu yếu tố nào kéo điểm lên hoặc xuống.'
        limitation = 'Điểm của job một mã không so sánh trực tiếp với xếp hạng toàn sàn vì thiếu phân phối cross-sectional.'
    elif key == 'action':
        text = f'Hành động {result.get("action", "chưa có")} là kết quả của các điều kiện trong core. Trường lý do bên dưới giải thích cổng nào cho phép hoặc chặn hành động.'
    return text, limitation, evidence


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
        text, limitation, evidence = explain(key, result, prices)
        if status in ('missing', 'unavailable'):
            text = f'Chưa có kết quả hợp lệ: {result.get("error") or result.get("reason") or "module chưa trả dữ liệu"}. ' + method
        modules.append({'id': key, 'title': title, 'status': status, 'inputs': inputs,
                        'method': method, 'explanation': text, 'limitations': limitation,
                        'result': result, 'evidence': evidence})
    return modules
