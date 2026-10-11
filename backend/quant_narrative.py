"""Reader-facing reasoning from observed outputs; never expose technical payloads."""
from __future__ import annotations

import math


# Definition, input conditions, mechanism, and role in the combined decision.
GUIDES = {
    'data_quality': (
        'Đây là bước kiểm tra nền móng của báo cáo: dữ liệu giá có đúng cấu trúc, đủ lịch sử và còn cập nhật hay không. Một mô hình tính ra số đẹp trên dữ liệu sai vẫn không có giá trị.',
        'Cần giá mở cửa, cao nhất, thấp nhất, đóng cửa và khối lượng của các phiên đã hoàn tất, theo đúng thứ tự ngày và cùng đơn vị đồng. Giá phải dương, khối lượng không âm; các khoảng thiếu phiên, dữ liệu cũ và điều chỉnh giá cần được kiểm tra.',
        'Điểm chất lượng bị giảm khi lịch sử ngắn, phiên trùng, quan hệ giữa các mức giá bất hợp lý hoặc dữ liệu không cập nhật. Kết quả đạt chỉ xác nhận dữ liệu vượt các kiểm tra của hệ thống, không chứng minh mọi sự kiện doanh nghiệp đã được xử lý.',
        'Nếu dữ liệu bị chặn, không dùng các dự báo phía sau để đưa quyết định mở vị thế.'),
    'liquidity': (
        'Thanh khoản trả lời câu hỏi có thể mua bán một lượng cổ phiếu hợp lý mà ít làm thay đổi giá hay không. Nó khác với câu hỏi cổ phiếu sẽ tăng hay giảm.',
        'Cần ít nhất 20 phiên giá và khối lượng, cùng quy tắc lô giao dịch của sàn. Giá trị giao dịch được xấp xỉ bằng giá đóng cửa nhân số cổ phiếu giao dịch; cần xét cả những phiên không có giao dịch.',
        'Giá trị giao dịch bình quân cao thường cho thấy thị trường hấp thụ lệnh tốt hơn, nhưng một vài phiên đột biến có thể kéo trung bình lên. Hệ thống còn hạn chế lượng mua theo tỷ lệ tham gia vào thanh khoản và quy tắc lô.',
        'Thanh khoản ảnh hưởng chi phí trượt giá và quy mô vị thế; tín hiệu tăng không vượt qua được cổng thanh khoản bị chặn.'),
    'dist': (
        'Phân phối lợi suất là hình dạng của các mức tăng giảm từng ngày. Độ lệch cho biết hai phía tăng và giảm có đối xứng không; excess kurtosis đo mức nhạy của phân phối với các quan sát xa trung bình, so với mốc phân phối chuẩn bằng 0.',
        'Cần tối thiểu 30 lợi suất tính từ hai giá đóng cửa liên tiếp, cùng đơn vị và không bị giá sai hoặc điều chỉnh doanh nghiệp làm méo. Kiểm định cần đủ mẫu; không coi một cửa sổ ngắn là đại diện cho mọi trạng thái thị trường.',
        'Kurtosis dùng lũy thừa bậc bốn của độ lệch nên một số phiên biến động rất lớn có thể làm giá trị tăng mạnh. Nó không cho biết riêng đuôi giảm: phải đọc cùng độ lệch, các kiểm định và những phiên cực đoan thực tế.',
        'Đây là bước kiểm tra mức độ tin cậy của cách mô tả rủi ro. Sharpe thuận lợi vẫn cần thận trọng nếu mẫu có đuôi dày; dự báo rủi ro theo phân phối chuẩn có thể chưa bao quát tốt các kịch bản cực đoan.'),
    'stats': (
        'Nhóm này tóm tắt hiệu suất đường giá trong quá khứ. Sharpe so lợi suất vượt lãi suất phi rủi ro với biến động; Sortino tập trung biến động giảm; MaxDD đo mức giảm sâu nhất từ một đỉnh trước đó; Calmar so tăng trưởng năm với mức giảm sâu nhất.',
        'Cần tối thiểu 20 giá đóng cửa hợp lệ và một cửa sổ nhất quán. Quy đổi năm dùng 252 phiên; lãi suất phi rủi ro lấy từ cấu hình. Đây là thống kê nắm giữ theo giá, chưa phải lợi nhuận các lệnh của một chiến lược sau phí.',
        'Sharpe tăng khi lợi suất bình quân vượt lãi suất phi rủi ro tăng hoặc biến động giảm. MaxDD lớn xuất hiện khi giá rơi xa đỉnh trước đó; mức tăng trưởng năm còn phụ thuộc thời gian giữa giá đầu và giá cuối.',
        'Dùng để hiểu lịch sử lợi nhuận và tổn thất, sau đó đối chiếu phân phối, tín hiệu hiện tại và backtest. Hiệu suất quá khứ tốt chưa tạo ra điều kiện mua hôm nay.'),
    'vol': (
        'Chế độ biến động đo mức dao động của lợi suất đang co lại hay tăng lên. Vol Ratio so biến động 10 phiên gần nhất với 60 phiên; đây là thước đo độ rộng dao động, không phải hướng giá.',
        'Cần đủ lợi suất cho các cửa sổ 10, 20 và 60 phiên. Các độ lệch chuẩn được quy đổi năm giống nhau; mẫu nền cần có biến động khác 0 để tỷ số có ý nghĩa.',
        'Tỷ số nhỏ hơn 1 cho biết 10 phiên gần đây ít dao động hơn nền 60 phiên; lớn hơn 1 là dao động mạnh hơn. Hệ thống gán co hẹp dưới 0,7, mở rộng trên 1,3 và bình thường ở giữa.',
        'Đối chiếu GARCH để xem cú sốc biến động có kéo dài không, rồi dùng ATR và rủi ro mô phỏng để thiết kế dừng lỗ.'),
    'ac': (
        'Tự tương quan đo lợi suất hiện tại có liên hệ với lợi suất các phiên trước hay không. Dương có thể phản ánh sự tiếp diễn ngắn hạn; âm có thể phản ánh đảo chiều; gần 0 là chưa thấy quan hệ tuyến tính rõ.',
        'Cần đủ lịch sử lợi suất cho các độ trễ. Trung bình lag 1–3 được so với ngưỡng xấp xỉ phụ thuộc số quan sát; phải lưu ý nhiều lần kiểm định có thể tạo tín hiệu ngẫu nhiên.',
        'Kết quả xuất phát từ việc ghép lợi suất với chính chuỗi đó sau khi dịch 1–3 phiên. Một vài đoạn tăng giảm lặp lại có thể tạo tương quan trong mẫu nhưng không tồn tại ổn định ở mẫu mới.',
        'Đối chiếu momentum, Hurst và trạng thái thị trường trước khi tin vào tiếp diễn hoặc hồi quy về trung bình.'),
    'arima': (
        'ARIMA dự báo cấu trúc trung bình của chuỗi lợi suất từ các độ trễ và sai số trước đó. Nó tìm sự phụ thuộc theo thời gian, khác với GARCH chủ yếu dự báo mức biến động.',
        'Cần tối thiểu 60 lợi suất; kiểm tra tính dừng và khả năng khớp mô hình. Trong hệ thống này thành phần sai phân bằng 0 vì đầu vào đã là lợi suất, không phải mức giá.',
        'Các bậc mô hình được thử và chọn theo AIC, một tiêu chí cân bằng độ khớp với số tham số. Các lợi suất dự báo được nhân nối vào giá cuối để tạo đường giá; AIC thấp hơn chỉ tốt hơn tương đối trong nhóm thử trên cùng dữ liệu.',
        'ARIMA là chẩn đoán dự báo trung bình. Không đếm nó như một tín hiệu mua độc lập nếu bộ tổng hợp của hệ thống không sử dụng nó; cần kiểm định ngoài mẫu để đánh giá độ chính xác.'),
    'garch': (
        'GARCH mô tả hiện tượng phiên biến động mạnh thường đi cùng một giai đoạn biến động mạnh. EGARCH bổ sung việc cú sốc tăng và giảm có thể ảnh hưởng độ biến động khác nhau.',
        'Cần tối thiểu 100 lợi suất ngày, tính theo phần trăm, cùng mô hình khớp thành công. Cần kiểm tra từng nhánh GARCH và EGARCH riêng nếu một nhánh không có kết quả.',
        'Trong GARCH, alpha đo tác động của cú sốc mới, beta đo ảnh hưởng của phương sai quá khứ. Tổng alpha và beta càng gần 1 thì cú sốc biến động càng lâu suy giảm; gần hoặc vượt 1 cần kiểm tra tính ổn định. EGARCH dùng hệ số bất đối xứng để mô tả tác động khác nhau theo dấu cú sốc.',
        'GARCH cung cấp nền biến động cho mô phỏng rủi ro. Một dự báo biến động lớn không đồng nghĩa giá sẽ giảm, nhưng làm thay đổi dải kịch bản và yêu cầu quản trị vị thế.'),
    'hmm': (
        'HMM coi thị trường có các trạng thái ẩn, chẳng hạn tăng, giảm hoặc đi ngang. Mô hình suy trạng thái từ đặc trưng lợi suất, biến động và khối lượng; nhãn được gắn theo đặc trưng của từng trạng thái đã học.',
        'Cần lịch sử giá–khối lượng đủ dài, các đặc trưng hợp lệ và quá trình khớp mô hình thành công. Khi không khớp được, hệ thống dùng quy tắc thay thế từ giá và đường trung bình; khi đó không có xác suất HMM hợp lệ.',
        'Xác suất trạng thái đo mức mô hình gán quan sát gần đây vào một trạng thái. Nó có thể đổi khi có thêm dữ liệu; một trạng thái đi ngang nghĩa là các đặc trưng đang giống nhóm đi ngang trong mẫu học.',
        'HMM hỗ trợ xác định bối cảnh cho momentum và hồi quy phần dư. Xác suất trạng thái không phải xác suất giao dịch có lãi.'),
    'alpha': (
        'Nhóm này đối chiếu sức mạnh giá với thị trường và tóm tắt kỹ thuật. RS 20 phiên là chênh lệch lợi suất cổ phiếu với VN-Index; beta là mức nhạy với thị trường; alpha là phần lợi suất bình quân chưa giải thích bởi beta trong mẫu.',
        'Cần tối thiểu 30 phiên OHLCV; để có RS, beta và alpha cần thêm lịch sử VN-Index cùng ngày và đủ các quan sát chung. Cần phân biệt hiệu suất vượt chỉ số với lợi nhuận tuyệt đối.',
        'RS âm có thể xảy ra ngay cả khi cổ phiếu tăng, nếu VN-Index tăng mạnh hơn. Beta và alpha được tạo từ đồng biến giữa hai chuỗi lợi suất; kết quả lịch sử không xác định được danh tính người mua bán hay nguyên nhân tin tức.',
        'Đối chiếu CMF để xem vị trí đóng cửa có ủng hộ sức mạnh tương đối không; kết hợp bối cảnh ngành khi có đủ mã so sánh.'),
    'sr': (
        'Hỗ trợ và kháng cự là các vùng giá có nhiều cực trị thấp hoặc cao trong lịch sử, gợi ý những nơi giá từng phản ứng. Đây là vùng tham chiếu, không phải rào chắn chắc chắn.',
        'Cần ít nhất 30 phiên; hệ thống xem các cực trị trong tối đa 120 phiên gần nhất rồi gom các điểm đủ gần theo ATR và khoảng cách giá.',
        'Một vùng mạnh hơn khi có nhiều điểm chạm và các điểm đó gần hiện tại hơn. Vùng được dựng từ cấu trúc giá đã xảy ra, không từ giả định nhà đầu tư chắc chắn sẽ đặt lệnh tại đó.',
        'Dùng làm mốc xác nhận hoặc đánh giá rủi ro cho kế hoạch entry–stop–target, sau khi tín hiệu tổng hợp đã đủ điều kiện.'),
    'trend': (
        'Chất lượng xu hướng phân biệt giá đi có hướng với giá vòng vèo. ER là độ dịch chuyển ròng chia tổng quãng đường giá; mức thay đổi giá cho biết hướng, còn R² đo độ khớp với một đường thẳng.',
        'Cần 21 mức đóng cửa để đo 20 thay đổi liên tiếp. ER nằm từ 0 đến 1; ER không mang dấu nên phải đọc cùng mức tăng giảm của cả cửa sổ.',
        'ER thấp xảy ra khi nhiều bước tăng và giảm triệt tiêu nhau, dù tổng quãng đường giá lớn. ER cao nghĩa là phần lớn chuyển động cùng hướng, nhưng hướng đó có thể là tăng hoặc giảm.',
        'Momentum dễ bị nhiễu khi ER thấp. Ghép với HMM và Hurst để xem có đủ cơ sở theo xu hướng hay chỉ là dao động trong biên.'),
    'flow': (
        'CMF là thước đo áp lực giá–khối lượng: mỗi phiên đóng cửa gần đỉnh nến đóng góp dương, gần đáy đóng góp âm, và phiên có khối lượng lớn được cân nặng hơn. Nó không đo trực tiếp tiền nạp hoặc rút khỏi cổ phiếu.',
        'Cần giá cao nhất, thấp nhất, đóng cửa và khối lượng hợp lệ của tối đa 20 phiên gần nhất; ít nhất 5 phiên mới có đầu ra. Tổng khối lượng phải dương để tỷ số có ý nghĩa; phiên không có biên độ giá được đóng góp bằng 0.',
        'Lấy vị trí đóng cửa trong biên độ nến, nhân khối lượng, cộng các phiên rồi chia tổng khối lượng. Dấu âm xuất hiện khi đóng góp phía đóng cửa thấp lấn át phía đóng cửa cao; dấu dương là trường hợp ngược lại.',
        'Ghép với xu hướng, momentum và RS để biết áp lực giá–khối lượng có xác nhận hướng giá không. CMF −0,2 không có nghĩa 20% tiền rút ra và không đủ để kết luận có tổ chức đang phân phối.'),
    'momentum_alpha': (
        'Momentum là tín hiệu động lượng: mức tăng giảm gần đây có đang ủng hộ tiếp diễn một hướng hay không. Hệ thống gom nhiều cửa sổ thành một lá phiếu để tránh coi các tín hiệu tương quan là nhiều bằng chứng độc lập.',
        'Cần ít nhất 65 giá đóng cửa để có cửa sổ 5, 10, 20 và 60 phiên. Mức thay đổi được chuẩn hóa theo biến động và điều chỉnh bằng độ sạch xu hướng.',
        'Điểm tổng hợp kết hợp các cửa sổ với trọng số khác nhau và chất lượng đường giá. Vì vậy một cửa sổ tăng mạnh chưa chắc tạo tín hiệu tăng nếu các cửa sổ còn lại hoặc cấu trúc xu hướng không ủng hộ.',
        'Đây là một nguồn dự báo hướng tham gia đồng thuận. Đọc cùng Hurst, HMM, CMF và hiệu suất tương đối để phát hiện tín hiệu tăng nhưng thiếu xác nhận.'),
    'hurst': (
        'Hurst đo mức độ phụ thuộc của chuỗi lợi suất qua các thang thời gian. Nó giúp chọn cách dùng tín hiệu tiếp diễn hoặc hồi quy, không tự cho biết cổ phiếu sẽ tăng hay giảm.',
        'Cần đủ lợi suất cho các cửa sổ 64, 128 và 252 khi có dữ liệu. Hệ thống xét cả độ khớp và độ ổn định giữa cửa sổ; độ tin cậy thấp thì giữ trạng thái chưa chắc chắn.',
        'Ước lượng đến từ quan hệ giữa khoảng dao động tích lũy đã chuẩn hóa và độ dài đoạn dữ liệu. Kết quả gần 0,5 gợi ý chưa có bằng chứng rõ về tiếp diễn hay đảo chiều trong mẫu; ngưỡng phân loại lấy theo cấu hình.',
        'Hurst định tuyến trọng số cho các nguồn alpha. Không đếm Hurst như một lá phiếu hướng giá độc lập hoặc một xác suất thắng.'),
    'conditional_mr': (
        'Hồi quy phần dư tìm phần tăng giảm riêng của cổ phiếu sau khi loại tác động thị trường và ngành. Chỉ khi lệch đủ xa và bối cảnh phù hợp, hệ thống mới xem xét khả năng quay về mức thường gặp.',
        'Cần ít nhất 80 phiên của cổ phiếu, một nhân tố thị trường hoặc ngành và đủ 60 phiên chung. Còn cần phần dư đủ cực đoan, bối cảnh hồi quy/đi ngang và hiệu quả xu hướng dưới ngưỡng; thị trường khủng hoảng hoặc chưa xác định sẽ chặn.',
        'Hệ thống hồi quy lợi suất theo các nhân tố rồi đo phần dư 5 phiên so với trung vị và mức phân tán bền vững. Giá thấp hơn đường trung bình tự nó không đủ để nói sẽ hồi phục.',
        'Khi điều kiện không đạt, tín hiệu này không đóng góp vào đồng thuận. Phải đối chiếu Hurst, HMM và xu hướng để tránh bắt đáy trong một xu hướng giảm bền.'),
    'lightgbm_cross_sectional': (
        'LightGBM học quan hệ giữa các đặc trưng của nhiều cổ phiếu và lợi suất sau một khoảng thời gian. Nó nhằm dự báo tương đối trong một tập mã, khác với chỉ kéo dài đường giá của riêng một mã.',
        'Cần universe nhiều cổ phiếu, đặc trưng và nhãn được căn theo thời điểm, đủ mẫu huấn luyện và kiểm định. Việc chỉ tra một mã thường không đủ dữ liệu để tạo dự báo này.',
        'Dự báo xuất phát từ các quy tắc cây được học trên các mẫu đủ điều kiện; độ tin cậy phải xét trên dữ liệu ngoài mẫu. Khi thiếu universe hoặc huấn luyện không thành công, giá trị trung tính đi kèm không có nghĩa mô hình đã dự báo đi ngang.',
        'Chỉ tham gia dự báo hướng khi khả dụng và được kích hoạt. Thiếu module này làm giảm độ phủ bằng chứng, không trở thành một phiếu chống lại cổ phiếu.'),
    'cross_corr': (
        'Tương quan ngành xem các mã có cùng tăng giảm hay không; tương quan trễ và VAR tìm quan hệ theo thời gian giữa các chuỗi. Cùng biến động không chứng minh mã này gây ra biến động mã kia.',
        'Cần ít nhất hai mã cùng ngành, lợi suất được căn trên các phiên chung và đủ lịch sử cho độ trễ đang dùng. Một mã đơn lẻ không thể tạo ma trận tương quan giữa các mã.',
        'Quan hệ đến từ những đoạn lợi suất cùng biến động hoặc nối tiếp nhau trong mẫu. Nhân tố thị trường chung có thể tạo tương quan; quan hệ này cũng có thể đổi giữa các chế độ thị trường.',
        'Dùng để hiểu mức tập trung rủi ro và bối cảnh ngành; không coi tương quan là bằng chứng dòng tiền thực tế đang luân chuyển.'),
    'sector': (
        'Bối cảnh ngành tổng hợp tình trạng giá của các mã được đưa vào nhóm ngành. Nó giúp phân biệt một cổ phiếu mạnh riêng lẻ với một nhóm ngành cùng được thị trường hỗ trợ.',
        'Cần phân ngành có thể xác nhận và đủ mã đại diện có lịch sử hợp lệ. Kết quả từ một mã hoặc nhóm rất nhỏ có thể không đại diện cho ngành.',
        'Bức tranh ngành xuất phát từ các thành viên thực sự có dữ liệu trong lần chạy. Không có các thành viên thì không thể suy rằng toàn ngành đang hút hay mất dòng tiền.',
        'Đối chiếu RS và tương quan ngành để đánh giá tính rộng của tín hiệu; thiếu bối cảnh ngành phải được nêu rõ trong tổng kết.'),
    'cross_sectional_model': (
        'Đây là bước kiểm tra chất lượng huấn luyện của mô hình nhiều mã: có đủ mẫu không, đã học được mô hình chưa và kiểm định có hỗ trợ việc sử dụng dự báo không.',
        'Cần universe, số hàng đặc trưng, nhãn theo thời điểm và kết quả kiểm định từ quá trình huấn luyện thực tế. Không có huấn luyện thì không có độ chính xác hợp lệ để trình bày.',
        'Trạng thái đến từ cỡ mẫu và các kiểm tra trong quá trình huấn luyện. Nó giải thích vì sao LightGBM được dùng hoặc bị bỏ qua, không phải thêm một tín hiệu hướng giá.',
        'Dùng kiểm tra độ tin cậy của LightGBM; không đếm mô hình và chẩn đoán huấn luyện của nó thành hai bằng chứng độc lập.'),
    'fcast': (
        'Bộ tổng hợp nối các tín hiệu dự báo hướng với phân phối rủi ro Monte Carlo. Đồng thuận đo tỷ lệ ủng hộ cùng một hướng trong các nguồn đang tham gia; độ phủ đo số nguồn khả dụng so với tập nguồn dự kiến.',
        'Cần các nguồn directional alpha đủ điều kiện, trạng thái thị trường và thông tin rủi ro. Monte Carlo cần giả định biến động/cú sốc hợp lệ và một horizon xác định; nguồn thiếu dữ liệu không được thay bằng bằng chứng có sẵn.',
        'Dự báo hướng là kết hợp các nguồn alpha đã được định tuyến, còn dải Monte Carlo mô tả giá có thể phân tán theo giả định. Hai vai trò khác nhau: mức đồng thuận cao với độ phủ thấp vẫn có thể là bằng chứng hẹp.',
        'Đọc cùng chi phí, rủi ro thời gian chờ thanh toán và meta-label trước khi xác định thời điểm. Dự báo dương hoặc dải giá cao hơn hiện tại chưa tự tạo lệnh mua.'),
    'meta_label_model': (
        'Meta-label đánh giá thêm độ đáng tin của một tín hiệu đã được tạo. Nó học từ các giao dịch được đánh giá sau khi kết quả xuất hiện, thay vì tự sinh một alpha hướng giá mới.',
        'Cần đủ giao dịch đã được đánh giá, cả nhãn thành công và thất bại, cùng đặc trưng được lưu trước kết quả. Khi chưa đủ mẫu thì ở giai đoạn tích lũy dữ liệu.',
        'Khi mô hình sẵn sàng, xác suất được học từ quan hệ giữa bối cảnh tín hiệu và nhãn giao dịch. Xác suất chỉ đáng tin trong phạm vi hiệu chỉnh và kiểm định; chưa đủ mẫu thì không có xác suất thắng hợp lệ.',
        'Đây là cổng bổ sung cho thời điểm giao dịch. Trạng thái chưa đủ mẫu cần được nêu trong tổng kết, không chuyển thành mức chắc chắn giả.'),
    'costs': (
        'Chi phí biến một dự báo tăng giá thành lợi suất ròng dự kiến. Một mức tăng nhỏ có thể bị phí, thuế và trượt giá hấp thụ hết.',
        'Cần dự báo trước chi phí, giả định phí/thuế và thanh khoản để ước lượng tác động lệnh. Giả định phải phù hợp quy mô giao dịch; chi phí thực tế có thể khác.',
        'Lợi suất ròng bằng lợi suất dự báo trước chi phí trừ tổng chi phí khứ hồi. Trượt giá là chênh lệch có thể phát sinh giữa giá mong muốn và giá khớp thực tế, thường nhạy với thanh khoản.',
        'Chỉ đánh giá cơ hội sau chi phí; đối chiếu mức hòa vốn với độ bất định dự báo và rủi ro trước khi cân nhắc mở vị thế.'),
    'sl': (
        'Kế hoạch giá gồm mức tham chiếu vào, dừng lỗ và chốt lời. Nó biến ý tưởng giao dịch thành một phương án có thể đo tổn thất và khoảng lợi nhuận, nhưng không bảo đảm được khớp lệnh.',
        'Cần OHLCV, ATR, cấu trúc giá, dự báo, quy tắc sàn và rủi ro thanh toán. Một phương án mua hợp lệ cần dừng lỗ thấp hơn mức vào, rồi đến hai mục tiêu tăng dần và đều dương.',
        'Khoảng dừng và mục tiêu phản ánh biên độ giá, vùng cấu trúc và giới hạn rủi ro của mô hình. Nếu khoảng lỗ quá lớn hoặc kế hoạch không hợp lệ, không nên biến mức giá tham chiếu thành lệnh.',
        'Chỉ áp dụng khi quyết định tổng hợp và điều kiện vào lệnh đã được xác nhận; đọc cùng quy mô vị thế, chi phí và thanh khoản.'),
    'pos': (
        'Quy mô vị thế trả lời nên đặt bao nhiêu cổ phiếu theo ngân sách rủi ro đã cấu hình. Cùng một ý tưởng giá, khoảng cách dừng lỗ lớn hơn thường dẫn đến lượng mua nhỏ hơn.',
        'Cần mức vào, dừng lỗ, vốn và ngân sách rủi ro cấu hình, cùng quy tắc lô và giới hạn thanh khoản. Vốn cấu hình không phải vốn thực tế của người đang xem.',
        'Lượng mua được giới hạn bởi tổn thất trên mỗi cổ phiếu, ngân sách rủi ro, vốn khả dụng và khả năng hấp thụ lệnh; sau đó làm tròn theo lô. Lượng bằng 0 có nghĩa phương án chưa thực thi được theo cấu hình.',
        'Quy mô không tạo ra alpha; nó kiểm soát tác động của việc tín hiệu sai. Đối chiếu dừng lỗ và thời gian chưa thể bán do thanh toán.'),
    'kelly': (
        'Kelly là quy tắc phân bổ vốn dựa trên xác suất thắng và tương quan mức lãi với mức lỗ của giao dịch. Nó nhạy với sai số ước lượng nên đầu vào chưa được kiểm định dễ tạo quy mô quá lớn.',
        'Cần thống kê giao dịch thực sự đã được kiểm định và hiệu chỉnh, không dùng tỷ lệ số ngày giá tăng. Trong pipeline hiện tại, Kelly được tắt khi chưa có đầu vào giao dịch hợp lệ.',
        'Thiếu xác suất thắng và tỷ lệ lãi/lỗ đáng tin thì không thể tạo tỷ trọng Kelly có ý nghĩa. Trạng thái tắt không có nghĩa cơ hội bằng 0, mà là không dùng phương pháp này để cấp vốn.',
        'Sử dụng quy mô theo ngân sách rủi ro và thanh khoản thay vì suy ra tỷ trọng mua từ thống kê giá.'),
    'rec': (
        'Điểm Quant là cách gộp các đặc trưng thành một thang đánh giá. Điểm cao có thể giúp sàng lọc, nhưng không phải xác suất thắng và không tự thay thế điều kiện hành động.',
        'Cần các yếu tố của lần phân tích và bối cảnh VN-Index. Một batch chỉ có một mã thiếu phân phối toàn sàn, nên điểm đó không dùng như thứ hạng giữa mọi cổ phiếu.',
        'Điểm thay đổi theo các thành phần hiệu suất, xu hướng, biến động, sức mạnh tương đối và điều chỉnh rủi ro thực sự có trong lần chạy. Cổng chặn dữ liệu hoặc giao dịch vẫn ưu tiên hơn điểm.',
        'Dùng làm một phần bức tranh tổng hợp; quyết định mua còn cần dự báo ròng, thời điểm và kế hoạch giao dịch hợp lệ.'),
    'action': (
        'Đây là bước chuyển từ phân tích sang hành động của hệ thống: mua khi đủ điều kiện, tiếp tục theo dõi, hoặc tránh mở vị thế mới. Nó áp dụng các cổng an toàn sau bước chấm điểm.',
        'Cần dữ liệu đạt yêu cầu, thanh khoản, trạng thái VN-Index, dự báo sau chi phí, thời điểm, kế hoạch giá và quy mô vị thế. Thiếu hoặc bị chặn một điều kiện trọng yếu không được bù bằng điểm cao.',
        'Khuyến nghị hình thành từ những điều kiện đã đạt và những cổng còn chặn. Theo dõi có nghĩa có thể có yếu tố đáng chú ý nhưng chưa đủ căn cứ vào lệnh; tránh mở mới không tự đồng nghĩa phải bán một vị thế đang có.',
        'Đây là kết quả cuối của chuỗi bằng chứng. Tổng kết phải nêu yếu tố ủng hộ, yếu tố phản đối và điều kiện có thể làm khuyến nghị thay đổi.'),
    'backtest': (
        'Backtest kiểm tra một quy tắc giao dịch trên các tín hiệu đã được công bố trong quá khứ. Nó khác với việc đo mức tăng của giá: có ngày tạo tín hiệu, ngày vào, ngày thoát và chi phí.',
        'Cần các tín hiệu mua đã lưu trước khi biết kết quả, đủ horizon cho từng giao dịch và đủ số mẫu tối thiểu. Chỉ xét giao dịch đã có đủ dữ liệu kết thúc; không đưa tín hiệu hiện tại chưa hoàn tất vào tỷ lệ thắng.',
        'Quy tắc này vào tại đóng cửa phiên sau tín hiệu, thoát sau số phiên cấu hình và trừ chi phí khứ hồi. Các giao dịch chồng lấn có thể phụ thuộc nhau; đây chưa phải mô phỏng đầy đủ một danh mục có vốn hữu hạn.',
        'Dùng kiểm tra giả thuyết giao dịch, không khẳng định lợi nhuận tương lai. Nếu thiếu lịch sử thì không suy ra tỷ lệ thắng từ Sharpe hay số phiên tăng.'),
}


def num(value):
    if isinstance(value, bool):
        return None
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (ValueError, TypeError):
        return None


def fmt(value, digits=3):
    n = num(value)
    if n is None:
        return 'chưa có'
    text = f'{n:,.{digits}f}'.rstrip('0').rstrip('.') if digits else f'{n:,.0f}'
    return text.replace(',', '\x00').replace('.', ',').replace('\x00', '.')


def at(result, path):
    value = result
    for part in path.split('.'):
        value = value.get(part) if isinstance(value, dict) else None
    return value


LABELS = {'BULL': 'tăng', 'BEAR': 'giảm', 'SIDEWAY': 'đi ngang', 'SIDEWAYS': 'đi ngang',
          'BULLISH': 'thiên tăng', 'BEARISH': 'thiên giảm', 'UP': 'tăng', 'DOWN': 'giảm',
          'NORMAL': 'bình thường', 'EXPANSION': 'mở rộng', 'CONTRACTION': 'co hẹp',
          'PERSISTENT': 'thiên tiếp diễn', 'MEAN_REVERTING': 'thiên hồi quy về trung bình',
          'RANDOM_WALK': 'chưa có phụ thuộc rõ', 'RANDOM': 'chưa có phụ thuộc rõ',
          'UNCERTAIN': 'chưa đủ chắc chắn', 'NEUTRAL': 'trung tính', 'READY': 'đủ điều kiện thời điểm',
          'WATCH': 'cần theo dõi thêm', 'WAIT': 'chờ xác nhận', 'BLOCKED': 'bị chặn',
          'BUY_NOW': 'mua khi đủ điều kiện', 'BUY_SETUP': 'chờ thiết lập mua', 'AVOID': 'tránh mở vị thế mới',
          'PASS': 'đạt kiểm tra', 'WARN': 'có cảnh báo', 'FAIL': 'không đạt', 'WARMUP': 'chưa đủ mẫu'}


def label(value):
    text = str(value or '').upper()
    for key in sorted(LABELS, key=len, reverse=True):
        if text == key or text.endswith(' '+key):
            return LABELS[key]
    return 'chưa có kết luận được xác nhận'


REASONS = {
    'DATA_QUALITY_FAIL': 'Dữ liệu chưa đạt kiểm tra chất lượng.', 'LIQUIDITY_FAIL': 'Thanh khoản chưa đạt mức tối thiểu.',
    'VNI_CRISIS': 'Thị trường chung đang ở trạng thái khủng hoảng.', 'TIMING_BLOCKED': 'Tín hiệu hoặc bối cảnh đang chặn thời điểm vào lệnh.',
    'SETTLEMENT_LOCK_RISK': 'Rủi ro trong thời gian chờ thanh toán chưa đạt yêu cầu.', 'NET_FORECAST_TOO_LOW': 'Dự báo sau chi phí chưa đạt mức yêu cầu.',
    'INVALID_FORECAST': 'Chưa có dự báo hợp lệ.', 'UNKNOWN_EXCHANGE': 'Chưa xác nhận được quy tắc sàn giao dịch.',
    'VNI_DATA_MISSING': 'Chưa đủ dữ liệu VN-Index để xác định thị trường chung.', 'INVALID_TRADE_PLAN': 'Kế hoạch vào, dừng lỗ và chốt lời chưa hợp lệ.',
    'ZERO_POSITION_SIZE': 'Quy mô theo ngân sách rủi ro hoặc thanh khoản chưa đủ một vị thế.', 'TIMING_NOT_READY': 'Thời điểm vào lệnh chưa sẵn sàng.',
}


def availability(key, result, status):
    if status == 'fallback':
        return 'Mô hình HMM chưa khớp được; kết luận đang dựa vào quy tắc giá và đường trung bình thay thế. Không dùng nhãn này như một xác suất HMM.'
    if status in ('missing', 'unavailable', 'warmup', 'disabled'):
        if key in ('lightgbm_cross_sectional', 'cross_sectional_model'):
            return 'Lần chạy chưa tạo được dự báo nhiều mã hợp lệ: có thể thiếu universe, lịch sử chung, mẫu huấn luyện hoặc kiểm định. Kết quả này không được tính thành lá phiếu hướng giá.'
        if key in ('sector', 'cross_corr'):
            return 'Chưa có đủ thành viên ngành hoặc lịch sử chung hợp lệ để kết luận. Không suy rộng kết quả của một cổ phiếu thành dòng tiền của toàn ngành.'
        if key == 'meta_label_model':
            return 'Chưa có đủ giao dịch đã đánh giá để xác nhận mô hình hiệu chỉnh tín hiệu. Vì vậy báo cáo chưa có xác suất giao dịch thắng được kiểm chứng từ bước này.'
        if key == 'kelly':
            return 'Hệ thống chưa sử dụng Kelly vì thiếu đầu vào giao dịch đã hiệu chỉnh. Tỷ lệ phiên tăng của giá không được thay thế xác suất giao dịch thắng.'
        if key == 'backtest':
            return 'Chưa có backtest hoàn tất với đủ tín hiệu đã công bố và đủ thời gian theo dõi. Không đưa ra tỷ lệ thắng hoặc lợi nhuận chiến lược khi thiếu bằng chứng này.'
        return 'Chưa có đầu ra hợp lệ cho module này. Có thể thiếu lịch sử, đầu vào hoặc quá trình khớp mô hình chưa thành công; chưa thể dùng nó làm bằng chứng cho khuyến nghị.'
    return None


METRICS = {
    'data_quality': [('status', 'Chất lượng dữ liệu', '', 'label'), ('n_rows', 'Số phiên kiểm tra', 'phiên')],
    'liquidity': [('adv20_value_vnd', 'Giá trị giao dịch bình quân 20 phiên', 'đồng'), ('capacity_shares', 'Giới hạn lượng cổ phiếu theo thanh khoản', 'cổ phiếu')],
    'dist': [('excess_kurtosis', 'Độ nhọn dư của phân phối', ''), ('skewness', 'Độ lệch của phân phối', ''), ('tests.jarque_bera.p', 'Mức ý nghĩa quan sát của Jarque–Bera', ''), ('tests.shapiro_wilk.p', 'Mức ý nghĩa quan sát của Shapiro–Wilk', '')],
    'stats': [('sharpe', 'Sharpe của đường giá', ''), ('sortino', 'Sortino của đường giá', ''), ('calmar', 'Calmar', ''), ('max_dd_pct', 'Sụt giảm sâu nhất trong cửa sổ', '%'), ('ann_return_pct', 'Tăng trưởng quy đổi năm', '%'), ('n', 'Số lợi suất quan sát', 'phiên')],
    'vol': [('vol_ratio', 'Tỷ số biến động ngắn hạn / nền', ''), ('vol_10d', 'Biến động 10 phiên, quy đổi năm', '%'), ('vol_60d', 'Biến động 60 phiên, quy đổi năm', '%')],
    'ac': [('avg_short', 'Tự tương quan trung bình lag 1–3', ''), ('threshold', 'Ngưỡng so sánh theo cỡ mẫu', '')],
    'arima': [('stationarity.adf_p', 'Mức ý nghĩa quan sát của kiểm định tính dừng', ''), ('best.aic', 'Tiêu chí lựa chọn mô hình AIC', '')],
    'garch': [('garch.alpha', 'Ảnh hưởng cú sốc mới', ''), ('garch.beta', 'Ảnh hưởng biến động quá khứ', ''), ('garch.persistence', 'Độ kéo dài cú sốc biến động', ''), ('garch.half_life', 'Thời gian cú sốc giảm còn một nửa', 'phiên'), ('egarch.gamma', 'Bất đối xứng tác động cú sốc', '')],
    'hmm': [('current', 'Trạng thái thị trường của cổ phiếu', '', 'label'), ('prob_pct', 'Xác suất gán trạng thái', '%')],
    'alpha': [('cross_sectional.rs_20d_pct', 'Chênh lệch hiệu suất với VN-Index 20 phiên', 'điểm %'), ('cross_sectional.beta', 'Độ nhạy với VN-Index', ''), ('cross_sectional.alpha_ann_pct', 'Alpha lịch sử quy đổi năm', '%')],
    'sr': [], 'trend': [('er', 'Hiệu quả đường giá ER', ''), ('slope_pct', 'Thay đổi giá trong 20 phiên', '%'), ('r2', 'Độ khớp xu hướng tuyến tính', '')],
    'flow': [('cmf', 'Áp lực giá–khối lượng CMF', '')],
    'momentum_alpha': [('signal', 'Hướng động lượng', '', 'label'), ('score', 'Điểm động lượng tổng hợp', '')],
    'hurst': [('hurst', 'Hurst của chuỗi lợi suất', ''), ('regime', 'Cấu trúc phụ thuộc', '', 'label'), ('confidence', 'Độ ổn định / khớp của ước lượng', '')],
    'conditional_mr': [('residual_z', 'Độ lệch phần dư chuẩn hóa', ''), ('residual_5d_pct', 'Phần lợi suất riêng trong 5 phiên', '%'), ('signal', 'Hướng tín hiệu khi đủ điều kiện', '', 'label')],
    'lightgbm_cross_sectional': [('proj_pct', 'Dự báo từ mô hình nhiều mã', '%')],
    'cross_corr': [('avg_pairwise_corr', 'Tương quan trung bình giữa các mã ngành', ''), ('n_obs', 'Số phiên có dữ liệu chung', 'phiên')],
    'sector': [], 'cross_sectional_model': [],
    'fcast': [('ensemble_ret_pct', 'Dự báo hướng tổng hợp', '%'), ('agreement_pct', 'Mức đồng thuận của các nguồn tham gia', '%'), ('coverage_pct', 'Độ phủ nguồn tín hiệu', '%'), ('timing_status', 'Điều kiện thời điểm', '', 'label'), ('lock_risk.prob_loss_gt_3pct', 'Rủi ro mô phỏng lỗ trên 3% trong thời gian chờ thanh toán', '%')],
    'meta_label_model': [],
    'costs': [('gross_forecast_pct', 'Dự báo trước chi phí', '%'), ('roundtrip_cost_pct', 'Chi phí khứ hồi giả định', '%'), ('net_forecast_pct', 'Dự báo sau chi phí', '%')],
    'sl': [('entry', 'Mức vào tham chiếu', 'đồng'), ('sl_swing', 'Mức dừng lỗ tham chiếu', 'đồng'), ('tp1', 'Mục tiêu thứ nhất', 'đồng'), ('tp2', 'Mục tiêu thứ hai', 'đồng')],
    'pos': [('shares', 'Lượng cổ phiếu theo cấu hình', 'cổ phiếu')], 'kelly': [],
    'rec': [('score', 'Điểm Quant của lần chạy', '/ 100')],
    'action': [('action', 'Hành động theo hệ thống', '', 'label'), ('net_forecast_pct', 'Dự báo ròng dùng ở cổng hành động', '%')],
    'backtest': [('sample_size', 'Số giao dịch đã đủ thời gian theo dõi', 'giao dịch'), ('horizon_sessions', 'Thời gian giữ theo quy tắc kiểm định', 'phiên'), ('win_rate_pct', 'Tỷ lệ giao dịch lãi sau chi phí', '%'), ('average_return_pct', 'Lợi suất ròng bình quân mỗi giao dịch', '%')],
}


def narrative(key, result, prices, status):
    definition, conditions, mechanism, connection = GUIDES[key]
    evidence = []
    metrics = []
    unavailable = availability(key, result, status)
    for metric in METRICS.get(key, []):
        path, title, unit, *kind = metric
        value = at(result, path)
        if value is None or (status in ('missing', 'unavailable', 'disabled', 'warmup') and path not in ('sample_size', 'horizon_sessions')):
            continue
        if key == 'hmm' and status == 'fallback' and path == 'prob_pct':
            continue
        if not kind and num(value) is None:
            continue
        metrics.append({'label': title, 'value': label(value) if kind else num(value), 'unit': unit})
    reading = unavailable or 'Module đã trả kết quả trên cửa sổ dữ liệu của lần chạy. Các số dưới đây chỉ được dùng trong vai trò được mô tả, không tự tạo một khuyến nghị độc lập.'
    why = mechanism
    if not unavailable or status == 'fallback':
        if key == 'dist':
            k, skew = num(result.get('excess_kurtosis')), num(result.get('skewness'))
            if k is not None:
                reading = f'Excess kurtosis {fmt(k)} {"cao hơn" if k > 0 else "thấp hơn" if k < 0 else "bằng"} mốc chuẩn 0. '+('Trong cửa sổ này, độ lệch cực đoan đóng góp mạnh hơn vào moment bậc bốn so với phân phối chuẩn; đây là dấu hiệu cần xét rủi ro đuôi.' if k > 0 else 'Chỉ riêng thước đo này chưa cho thấy đuôi dày hơn chuẩn; không từ đó khẳng định rủi ro cực đoan không tồn tại.')
            if skew is not None:
                reading += f' Độ lệch {fmt(skew)} {"thiên về phía giảm" if skew < 0 else "thiên về phía tăng" if skew > 0 else "gần đối xứng"}; dấu kurtosis tự nó không cho biết phía giảm.'
            tests = result.get('tests') or {}
            checked = [x for x in tests.values() if isinstance(x, dict) and isinstance(x.get('reject'), bool)]
            if checked:
                reading += f' Có {sum(x["reject"] for x in checked)}/{len(checked)} kiểm định bác bỏ giả thuyết phân phối chuẩn theo ngưỡng của lần chạy; các kiểm định cùng dùng một mẫu nên không phải các bằng chứng độc lập.'
        elif key == 'stats':
            reading = f'Sharpe {fmt(result.get("sharpe"))} cho biết lợi suất vượt lãi suất phi rủi ro trên mỗi đơn vị biến động quy đổi năm. Tăng trưởng năm {fmt(result.get("ann_return_pct"))}% mô tả đoạn giá đã quan sát; MaxDD {fmt(result.get("max_dd_pct"))}% là tổn thất sâu nhất so với một đỉnh trước đó trong cùng cửa sổ. Đây không phải xác suất thắng của lệnh tiếp theo.'
        elif key == 'vol':
            ratio = num(result.get('vol_ratio'))
            reading = f'Vol Ratio {fmt(ratio)}: '+(f'biến động 10 phiên bằng khoảng {fmt(ratio*100,1)}% mức biến động 60 phiên. ' if ratio is not None else 'chưa đủ giá trị để so mức biến động hai cửa sổ. ')+f'Trạng thái được hệ thống gán là {label(result.get("regime"))}; chưa suy ra được hướng giá từ tỷ số này.'
        elif key == 'ac':
            a, threshold = num(result.get('avg_short')), num(result.get('threshold'))
            detected = a is not None and threshold is not None and abs(a) > threshold
            reading = f'Tự tương quan ngắn hạn {fmt(a)}, ngưỡng so sánh {fmt(threshold)}. '+('Có dấu hiệu tiếp diễn ngắn hạn.' if detected and a > 0 else 'Có dấu hiệu đảo chiều ngắn hạn.' if detected else 'Chưa vượt ngưỡng để kết luận có cấu trúc tiếp diễn hoặc đảo chiều theo quy tắc này.')
        elif key == 'arima':
            p = num(at(result, 'stationarity.adf_p'))
            reading = f'AIC {fmt(at(result,"best.aic"))} là độ tốt tương đối của mô hình được chọn trong nhóm đã thử, không có nghĩa độ chính xác bằng một tỷ lệ phần trăm. '+(f'Kiểm định tính dừng có p-value {fmt(p,6)}; '+('mẫu có bằng chứng bác bỏ giả thuyết đơn vị gốc tại mức 5%.' if p < .05 else 'mẫu chưa bác bỏ giả thuyết đơn vị gốc tại mức 5%, cần thận trọng với giả định tính dừng.') if p is not None else 'Chưa có kết quả kiểm định tính dừng để giải thích thêm.')
            forecast = at(result, 'forecast.returns_pct')
            if isinstance(forecast, (list, tuple)) and forecast:
                reading += f' Lợi suất dự báo phiên đầu {fmt(forecast[0])}% là ước lượng có điều kiện trên lịch sử, không phải mức giá chắc chắn đạt.'
        elif key == 'garch':
            persist = num(at(result, 'garch.persistence'))
            reading = f'Độ kéo dài cú sốc {fmt(persist)} đến từ tổng ảnh hưởng cú sốc mới và biến động quá khứ. '+('Giá trị gần 1 cho thấy cú sốc có thể suy giảm chậm trong mô hình.' if persist is not None and .9 <= persist < 1 else 'Giá trị từ 1 trở lên cần thận trọng về tính ổn định của phương sai.' if persist is not None and persist >= 1 else 'Cần đọc độ kéo dài cùng dự báo biến động và độ tin cậy quá trình khớp.')
            if status == 'partial':
                reading += ' Một phần mô hình không có kết quả hợp lệ; chỉ dùng nhánh đã khớp thành công.'
        elif key == 'hmm':
            reading = (unavailable if status == 'fallback' else f'Trạng thái hiện tại được gán là {label(result.get("current"))}, với mức gán trạng thái {fmt(result.get("prob_pct"))}%. Điều này nói các đặc trưng gần đây giống trạng thái đó trong mẫu học, không phải {fmt(result.get("prob_pct"))}% cơ hội kiếm lời.')
        elif key == 'alpha':
            rs = num(at(result, 'cross_sectional.rs_20d_pct'))
            reading = (f'RS 20 phiên {fmt(rs)} điểm phần trăm nghĩa là cổ phiếu {"tốt hơn" if rs > 0 else "kém hơn" if rs < 0 else "ngang"} VN-Index về lợi suất cùng cửa sổ. Chỉ số tương đối này chưa nói riêng giá cổ phiếu đang tăng hay giảm.' if rs is not None else 'Chưa có hiệu suất tương đối hợp lệ với VN-Index; không tự suy ra cổ phiếu mạnh hơn thị trường.')
        elif key == 'sr':
            supports, resistances = result.get('supports') or [], result.get('resistances') or []
            reading = f'Có {len(supports)} vùng hỗ trợ và {len(resistances)} vùng kháng cự được nhận diện. Nhiều lần chạm có thể cho thấy vùng từng có phản ứng lặp lại; chưa chứng minh vùng đó sẽ giữ được ở lần tới.'
            for title, levels in [('Vùng hỗ trợ', supports), ('Vùng kháng cự', resistances)]:
                for index, level in enumerate(levels[:3]):
                    if isinstance(level, dict) and num(level.get('price')) is not None:
                        metrics.append({'label': f'{title} {index+1}', 'value': num(level['price']), 'unit': 'đồng'})
        elif key == 'trend':
            er, slope = num(result.get('er')), num(result.get('slope_pct'))
            reading = f'ER {fmt(er)} '+(f'nghĩa là độ dịch chuyển ròng bằng khoảng {fmt(er*100,1)}% tổng quãng đường giá trong cửa sổ. ' if er is not None else 'chưa đủ để đo độ sạch xu hướng. ')+f'Giá thay đổi {fmt(slope)}% trong 20 phiên; '+('các bước tăng giảm còn triệt tiêu nhiều, chưa có đường giá đi một hướng rõ.' if er is not None and er <= .3 else 'cần đọc dấu thay đổi giá để phân biệt xu hướng tăng với giảm.')
            if len(prices) >= 21:
                tail = prices.close.tail(21);net = abs(float(tail.iloc[-1]-tail.iloc[0]));path = float(tail.diff().abs().sum())
                evidence = [{'label':'Dịch chuyển giá ròng, trị tuyệt đối', 'value':net, 'unit':'đồng'}, {'label':'Tổng quãng đường giá qua 20 phiên','value':path,'unit':'đồng'}]
        elif key == 'flow':
            cmf = num(result.get('cmf'));window = prices.tail(20)
            if cmf is not None and {'high','low','close','volume'}.issubset(window.columns):
                spread = window.high-window.low;weighted = ((2*window.close-window.high-window.low)/spread.replace(0,1e-9))*window.volume
                total = float(window.volume.sum());positive = float(weighted.clip(lower=0).sum());negative = -float(weighted.clip(upper=0).sum())
                evidence = [{'label':'Số phiên quan sát','value':len(window),'unit':'phiên'}, {'label':'Tổng khối lượng','value':total,'unit':'cổ phiếu'}, {'label':'Đóng góp CMF phía dương','value':positive,'unit':'khối lượng có trọng số'}, {'label':'Đóng góp CMF phía âm (trị tuyệt đối)','value':negative,'unit':'khối lượng có trọng số'}, {'label':'CMF tính lại từ OHLCV','value':(positive-negative)/total if total > 0 else None,'unit':''}]
                if (spread == 0).all():
                    reading = "Các phiên đều không có biên độ giá nên thước đo vị trí đóng cửa không phân biệt được áp lực hai phía; không dùng CMF bằng 0 như bằng chứng mua bán cân bằng."
                elif total <= 0:
                    reading = 'Cửa sổ không có tổng khối lượng dương nên giá trị CMF bằng 0 trong đầu ra chỉ là quy ước xử lý; không thể kết luận áp lực mua và bán đang cân bằng.'
                else:
                    side = 'nửa dưới' if cmf < 0 else 'nửa trên' if cmf > 0 else 'hai phía cân bằng'
                    reading = f'CMF {fmt(cmf)} '+('cho thấy áp lực đóng cửa thiên phía bán.' if cmf < 0 else 'cho thấy áp lực đóng cửa thiên phía mua.' if cmf > 0 else 'cho thấy đóng góp có trọng số gần cân bằng trong cửa sổ.')+' Đây là mô tả giá–khối lượng, không đo tiền rút/nạp thực tế.'
                    why = f'Trong {len(window)} phiên, đóng góp dương là {fmt(positive,0)}, đóng góp âm theo trị tuyệt đối là {fmt(negative,0)}, trên tổng khối lượng {fmt(total,0)}. '+('Các phiên đóng cửa ở '+side+' biên độ nến lấn át khi được cân theo khối lượng. ' if cmf else 'Đóng góp hai phía gần cân bằng. ')+f'Chênh lệch đóng góp chia tổng khối lượng tạo ra giá trị khoảng {fmt((positive-negative)/total)}; phiên giao dịch lớn ảnh hưởng mạnh hơn phiên nhỏ.'
        elif key == 'momentum_alpha':
            reading = f'Động lượng đang {label(result.get("signal"))}, điểm tổng hợp {fmt(result.get("score"))}. Đây là kết quả gộp nhiều cửa sổ; cần xem các cửa sổ có cùng hướng hay chỉ một đoạn giá kéo điểm lên.'
            components = result.get('components') or {}
            for horizon in (5,10,20,60):
                value = num(components.get(f'ret_{horizon}d_pct'))
                if value is not None:
                    metrics.append({'label':f'Thay đổi giá {horizon} phiên','value':value,'unit':'%'})
        elif key == 'hurst':
            reading = f'Hurst {fmt(result.get("hurst"))}, bối cảnh {label(result.get("regime"))}, độ ổn định/khớp {fmt(result.get("confidence"))}. '+('Chưa có cơ sở đủ ổn định để định tuyến mạnh theo một chế độ.' if label(result.get('regime')) == LABELS['UNCERTAIN'] else 'Đây là mô tả cấu trúc phụ thuộc, không phải dự báo dấu lợi suất hoặc xác suất thắng.')
        elif key == 'conditional_mr':
            reading = ('Tín hiệu hồi quy phần dư đang được kích hoạt, hướng '+label(result.get('signal'))+'. ' if result.get('active') is True else 'Tín hiệu hồi quy phần dư chưa được kích hoạt vì điều kiện lệch cực đoan và bối cảnh chưa được xác nhận đồng thời. ')+f'Độ lệch chuẩn hóa phần dư {fmt(result.get("residual_z"))}; không thể kết luận mua chỉ vì giá đã giảm.'
        elif key == 'lightgbm_cross_sectional':
            reading = f'Mô hình nhiều mã có đầu ra khả dụng, dự báo {fmt(result.get("proj_pct"))}% theo horizon của lần chạy. '+('Nguồn này đang được dùng trong tín hiệu hướng.' if result.get('active') is True else 'Có đầu ra không đồng nghĩa tín hiệu đủ mạnh để tham gia đồng thuận; cần xem trạng thái kích hoạt.')
        elif key == 'cross_corr':
            reading = f'Tương quan trung bình giữa các cặp mã là {fmt(result.get("avg_pairwise_corr"))}. Các cặp cùng biến động có thể chia sẻ rủi ro thị trường/ngành; quan hệ trễ chưa chứng minh quan hệ nhân quả.'
        elif key == 'sector':
            reading = 'Bối cảnh ngành được tạo từ các thành viên có trong lần chạy. Phạm vi này có thể hẹp hơn toàn ngành; không dùng một nhãn ngành để khẳng định có dòng tiền thật đi vào toàn bộ nhóm.'
        elif key == 'cross_sectional_model':
            reading = 'Quá trình huấn luyện mô hình nhiều mã đã có chẩn đoán. Đây là thông tin kiểm tra khả năng sử dụng dự báo, không phải một lá phiếu hướng giá bổ sung.'
        elif key == 'fcast':
            reading = f'Dự báo hướng tổng hợp {fmt(result.get("ensemble_ret_pct"))}% trong {fmt(result.get("horizon"),0)} phiên; đồng thuận {fmt(result.get("agreement_pct"))}% với độ phủ {fmt(result.get("coverage_pct"))}%. Thời điểm đang {label(result.get("timing_status"))}. Đồng thuận là mức cùng hướng của các nguồn, không phải tỷ lệ giao dịch sẽ thắng.'
        elif key == 'meta_label_model':
            reading = 'Đã có mô hình hiệu chỉnh tín hiệu trong lần chạy. Khả năng áp dụng cần được đọc cùng chất lượng kiểm định và đặc trưng của giao dịch, không suy từ xác suất HMM.'
        elif key == 'costs':
            net = num(result.get('net_forecast_pct'))
            reading = f'Dự báo sau chi phí {fmt(net)}%. '+('Chi phí đã hấp thụ hết hoặc vượt lợi suất dự kiến; chưa có lợi thế ròng dương theo giả định.' if net is not None and net <= 0 else 'Dự báo ròng dương vẫn cần đủ biên an toàn so với bất định và ngưỡng giao dịch của hệ thống.')
        elif key == 'sl':
            reading = 'Các mốc giá dưới đây là một kế hoạch tham chiếu, không phải lệnh đã được khuyến nghị thực hiện. Chỉ dùng khi hành động tổng hợp đủ điều kiện; cần xét khả năng khớp, nhảy giá và thời gian chưa thể thoát lệnh.'
        elif key == 'pos':
            reading = f'Lượng cổ phiếu theo cấu hình là {fmt(result.get("shares"),0)}. Số này xuất phát từ vốn và giới hạn của hệ thống, không phải tỷ trọng cá nhân đã được tư vấn cho người xem.'
        elif key == 'rec':
            reading = f'Điểm Quant {fmt(result.get("score"),1)}/100 tóm tắt các yếu tố của lần chạy. Đây không phải {fmt(result.get("score"),1)}% xác suất có lãi và điểm một mã không xác định thứ hạng toàn sàn.'
        elif key == 'action':
            reasons = [REASONS.get(x, 'Có điều kiện giao dịch chưa được xác nhận.') for x in result.get('reason_codes',[]) if isinstance(x,str)]
            reading = f'Hành động hiện tại: {label(result.get("action"))}. '+(' '.join(reasons) if reasons else 'Đầu ra không ghi thêm lý do chặn; vẫn cần đối chiếu xác nhận cổng thực thi và các module rủi ro.')
        elif key == 'backtest':
            reading = f'Trong {fmt(result.get("sample_size"),0)} giao dịch đã đủ horizon, tỷ lệ lãi sau chi phí là {fmt(result.get("win_rate_pct"))}% và lợi suất ròng bình quân {fmt(result.get("average_return_pct"))}%. Đây là kết quả của quy tắc được kiểm định, không phải xác suất thắng của tín hiệu hiện tại.'
    return {'definition':definition, 'conditions':conditions, 'reading':reading, 'why':why,
            'connection':connection, 'metrics':metrics, 'evidence':evidence}


GROUPS = [
    ('Nền dữ liệu và khả năng giao dịch', ['data_quality','liquidity']),
    ('Hiệu suất quá khứ và cấu trúc rủi ro', ['stats','dist','vol','garch']),
    ('Xu hướng hiện tại có được xác nhận không?', ['trend','sr','flow','momentum_alpha','ac','hurst','hmm']),
    ('Sức mạnh riêng và bối cảnh thị trường / ngành', ['alpha','sector','cross_corr','conditional_mr','lightgbm_cross_sectional','cross_sectional_model']),
    ('Dự báo có đủ bằng chứng và lợi thế sau chi phí không?', ['arima','fcast','meta_label_model','costs']),
    ('Từ tín hiệu đến kế hoạch và khuyến nghị', ['sl','pos','kelly','backtest','rec','action']),
]


def synthesize(modules):
    by_id = {m['id']:m for m in modules}
    def result(key):
        m = by_id.get(key, {})
        return m.get('result', {}) if m.get('status') in ('computed','partial','fallback') else {}
    def value(key, path):
        return num(at(result(key),path))
    def available(key):
        return bool(result(key))
    sections = []
    for index, (title, ids) in enumerate(GROUPS):
        members = [by_id[key] for key in ids if key in by_id]
        sentences = [f'{m["title"]}: {m.get("reading") or availability(m["id"],m.get("result",{}),m.get("status")) or "Chưa đủ diễn giải được xác nhận."}' for m in members]
        if index == 0:
            link = 'Dữ liệu quyết định có thể tin các phép tính hay không; thanh khoản quyết định tín hiệu đó có thể giao dịch trong thực tế hay không. Hai điều kiện này phải đứng trước mọi đánh giá điểm số.'
        elif index == 1:
            link = 'Hiệu suất đường giá mô tả quá khứ, còn phân phối và biến động kiểm tra rủi ro đã đi kèm hiệu suất đó. Không dùng Sharpe cao để bỏ qua đuôi phân phối hoặc cú sốc biến động kéo dài.'
        elif index == 2:
            er, cmf = value('trend','er'), value('flow','cmf')
            link = 'Xu hướng đo đường đi của giá; momentum đo động lượng; CMF kiểm tra áp lực đóng cửa có trọng số khối lượng. HMM và Hurst cung cấp bối cảnh, còn tự tương quan là chẩn đoán cấu trúc; không đếm chúng thành các phiếu dự báo độc lập.'
            if er is not None and er <= .3:
                link += f' ER {fmt(er)} cho thấy nhiều bước giá triệt tiêu, nên một tín hiệu động lượng cần được xác nhận thêm.'
            if cmf is not None and cmf < 0:
                link += f' CMF {fmt(cmf)} cho thấy đóng cửa thiên phía thấp theo khối lượng, làm yếu phần xác nhận cho một ý tưởng tăng giá; chưa đủ để suy ra dòng tiền thật đang rút ra.'
            elif cmf is not None and cmf > 0:
                link += f' CMF {fmt(cmf)} bổ sung áp lực đóng cửa thiên phía cao, nhưng không thay thế điều kiện xu hướng và thời điểm.'
        elif index == 3:
            rs = value('alpha','cross_sectional.rs_20d_pct')
            link = 'RS cho biết mạnh/yếu tương đối với thị trường; ngành và tương quan kiểm tra tín hiệu có rộng hay chỉ tập trung ở một mã. Hồi quy phần dư và LightGBM chỉ đóng góp khi có đầu vào và điều kiện hợp lệ.'
            if rs is not None and rs < 0:
                link += f' RS {fmt(rs)} điểm phần trăm cho thấy đang kém VN-Index trong 20 phiên; nếu CMF cũng âm thì hai cách đo khác nhau cùng làm yếu luận điểm sức mạnh hiện tại.' if value('flow','cmf') is not None and value('flow','cmf') < 0 else f' RS {fmt(rs)} điểm phần trăm là một yếu tố cần đối chiếu với luận điểm tăng.'
            if not available('lightgbm_cross_sectional'):
                link += ' Thiếu dự báo nhiều mã làm bằng chứng hẹp hơn, không được ghi như một phiếu dự báo giảm.'
        elif index == 4:
            forecast, net, cmf = value('fcast','ensemble_ret_pct'), value('costs','net_forecast_pct'), value('flow','cmf')
            link = 'Đồng thuận cần được đọc cùng độ phủ: nhiều nguồn cùng hướng nhưng thiếu nhiều nguồn dự kiến vẫn là tập bằng chứng hẹp. Monte Carlo bổ sung phân phối rủi ro, meta-label kiểm tra độ tin cậy khi đủ mẫu, rồi chi phí kiểm tra lợi thế ròng.'
            if forecast is not None and forecast > 0 and cmf is not None and cmf < 0:
                link += f' Có mâu thuẫn cần theo dõi: dự báo hướng +{fmt(forecast)}% nhưng CMF {fmt(cmf)} chưa xác nhận áp lực giá–khối lượng phía mua. Đây là lý do không dùng riêng dự báo dương để mua.'
            if net is not None and net <= 0:
                link += ' Sau chi phí, lợi thế ròng không dương nên luận điểm giao dịch bị suy yếu trực tiếp.'
        else:
            link = 'Điểm tóm tắt mức hấp dẫn; cổng hành động quyết định có đủ điều kiện thực thi không. Mốc giá và quy mô chỉ là kế hoạch có điều kiện. Backtest kiểm tra quy tắc quá khứ, Kelly đòi hỏi thống kê giao dịch đã hiệu chỉnh; thiếu hai phần này không được thay bằng tỷ lệ phiên tăng.'
        sections.append({'title':title,'paragraphs':sentences+[link], 'module_ids':[m['id'] for m in members]})
    action = result('action');raw = str(action.get('action') or '').upper()
    quality = result('data_quality').get('status');liq = result('liquidity').get('pass')
    levels = result('sl');values = [num(levels.get(k)) for k in ('sl_swing','entry','tp1','tp2')]
    plan_valid = all(v is not None for v in values) and 0 < values[0] < values[1] < values[2] < values[3]
    confirmed_buy = (raw == 'BUY_NOW' and action.get('gate_pass') is True and action.get('executable') is True
                     and quality in ('PASS','WARN') and liq is True and plan_valid and (value('pos','shares') or 0) > 0
                     and result('fcast').get('timing_status') == 'READY')
    if confirmed_buy:
        headline = 'Đủ điều kiện mua theo quy tắc hệ thống'
        recommendation = 'Các cổng thực thi và kế hoạch đã được xác nhận trong lần chạy. Chỉ cân nhắc theo kế hoạch và ngân sách rủi ro đã cấu hình; dữ liệu, bối cảnh hoặc chi phí thay đổi có thể làm điều kiện này mất hiệu lực.'
    elif raw == 'AVOID' or quality == 'FAIL' or liq is False:
        headline = 'Tránh mở vị thế mới theo kết quả hiện tại'
        recommendation = 'Có điều kiện trọng yếu bị chặn hoặc bộ tổng hợp không ủng hộ mở mới. Không dùng hiệu suất quá khứ hoặc điểm số để bỏ qua cổng chặn; kết luận này không tự đồng nghĩa phải bán một vị thế đang nắm giữ.'
    else:
        headline = 'Tiếp tục theo dõi, chưa đủ xác nhận mở vị thế mới'
        recommendation = 'Các yếu tố thuận lợi cần được nối với xác nhận xu hướng, sức mạnh tương đối, dự báo sau chi phí và điều kiện thời điểm. Nếu hệ thống chưa cung cấp đầy đủ cổng thực thi, báo cáo giữ kết luận có điều kiện thay vì tự nâng thành khuyến nghị mua.'
    reasons = [REASONS.get(code,'Có điều kiện giao dịch chưa được xác nhận.') for code in action.get('reason_codes',[]) if isinstance(code,str)]
    if not reasons and not confirmed_buy:
        reasons = ['Kết luận hành động hiện tại chưa xác nhận đầy đủ điều kiện thực thi mua.']
    missing = [m['title'] for m in modules if m.get('status') in ('missing','unavailable','warmup','disabled','fallback','partial')]
    conditions = ['Kiểm tra lại dữ liệu và thanh khoản của phiên mới trước khi dùng kết luận.',
                  'Theo dõi sự xác nhận giữa hướng giá, động lượng, CMF và sức mạnh so với VN-Index; các nguồn này có thể phụ thuộc nhau.',
                  'Chỉ chuyển sang xem xét mua khi bộ tổng hợp xác nhận thời điểm, lợi thế sau chi phí, rủi ro thanh toán, kế hoạch giá và quy mô hợp lệ.',
                  'Bổ sung kiểm định tín hiệu và mẫu nhiều mã khi các model tương ứng chưa có đủ đầu vào.']
    return {'headline':headline,'recommendation':recommendation,'sections':sections,'reasons':reasons,
            'conditions':conditions,'limitations':missing,
            'covered_module_ids':[m['id'] for m in modules],
            'note':'Các quan hệ được diễn giải từ dữ liệu và đầu ra mô hình của lần chạy, không xác định được nguyên nhân tin tức, danh tính người mua bán hay dòng tiền thực tế.'}
