// PoC frontend: dữ liệu cố định, không phải kết quả phân tích hay giá trực tiếp.
export const run = { id:'DEMO-POST-20260921', slot:'Sau phiên', asOf:'21/09/2026', published:'21/09/2026 · 17:42 ICT' };
const rows = [
  ['FPT','Công nghệ FPT','HOSE','Công nghệ',89,'MUA',1,'Xu hướng tăng; động lượng và thanh khoản đạt ngưỡng','Tích cực','2–6 tháng','Tăng','Tăng'],
  ['MWG','Thế Giới Di Động','HOSE','Bán lẻ',85,'MUA',1,'Động lượng tích cực; rủi ro trong ngưỡng','Tích cực','2–4 tháng','Tăng','Đi ngang'],
  ['HPG','Tập đoàn Hòa Phát','HOSE','Thép',82,'MUA',1,'Dòng tiền cải thiện; xu hướng ngành đồng thuận','Tích cực','1–3 tháng','Tăng','Tăng'],
  ['SSI','Chứng khoán SSI','HOSE','Chứng khoán',81,'THEO DÕI',1,'Điểm đạt; chờ xác nhận dòng tiền','Khá','1–3 tháng','Tăng','Tăng'],
  ['MBB','Ngân hàng Quân đội','HOSE','Ngân hàng',78,'THEO DÕI',1,'Xu hướng ổn định; biến động ngắn hạn tăng','Khá','2–6 tháng','Tăng','Đi ngang'],
  ['VCB','Vietcombank','HOSE','Ngân hàng',76,'THEO DÕI',1,'Chất lượng xu hướng tốt; điểm vào chưa tối ưu','Khá','3–6 tháng','Tăng','Đi ngang'],
  ['ACB','Ngân hàng Á Châu','HOSE','Ngân hàng',74,'THEO DÕI',1,'Thanh khoản đạt; tín hiệu ngành trung tính','Khá','2–4 tháng','Tăng','Đi ngang'],
  ['MSN','Tập đoàn Masan','HOSE','Tiêu dùng',73,'THEO DÕI',1,'Động lượng cải thiện; cần thêm phiên xác nhận','Khá','1–3 tháng','Tăng','Đi ngang'],
  ['SHS','Chứng khoán Sài Gòn - Hà Nội','HNX','Chứng khoán',70,'THEO DÕI',1,'Qua bộ lọc nhưng thanh khoản cần theo dõi','Trung tính','1–2 tháng','Tăng','Đi ngang'],
  ['ACV','Cảng hàng không Việt Nam','UPCoM','Hạ tầng',69,'THEO DÕI',1,'Xu hướng dài hạn ổn định; cần xác nhận động lượng','Trung tính','3–6 tháng','Tăng','Đi ngang'],
  ['TCB','Techcombank','HOSE','Ngân hàng',68,'TRUNG LẬP',0,'Chưa đạt điều kiện động lượng ngắn hạn','Trung tính','Chờ tín hiệu','Tăng','Đi ngang'],
  ['VIC','Vingroup','HOSE','Bất động sản',65,'TRUNG LẬP',0,'Biến động lớn; rủi ro vượt ngưỡng lọc','Trung tính','Chờ tín hiệu','Tăng','Giảm'],
  ['VNM','Vinamilk','HOSE','Thực phẩm',62,'TRUNG LẬP',0,'Xu hướng ngang; thiếu xác nhận dòng tiền','Trung tính','Chờ tín hiệu','Tăng','Đi ngang'],
  ['VPB','VPBank','HOSE','Ngân hàng',61,'TRUNG LẬP',0,'Động lượng chưa vượt ngưỡng bộ lọc','Trung tính','Chờ tín hiệu','Tăng','Đi ngang'],
  ['GAS','PV GAS','HOSE','Dầu khí',58,'THẬN TRỌNG',0,'Xu hướng ngành suy yếu; điểm rủi ro tăng','Thận trọng','Chờ tín hiệu','Tăng','Giảm'],
  ['VHM','Vinhomes','HOSE','Bất động sản',54,'THẬN TRỌNG',0,'Chưa đạt xu hướng và thanh khoản','Thận trọng','Chờ tín hiệu','Tăng','Giảm'],
];
export const stocks = rows.map(([symbol,name,exchange,sector,score,recommendation,gatePass,gateExplanation,rating,holdPlan,vniTrend,sectorTrend]) => ({symbol,name,exchange,sector,score,recommendation,gatePass:!!gatePass,gateExplanation,rating,holdPlan,vniTrend,sectorTrend}));
export const phases = [
  ['queued','Đang chờ trong hàng đợi',0],['fetch','Thu thập dữ liệu giá và thị trường',12],['quality','Kiểm tra chất lượng dữ liệu',24],['models','Chạy các mô hình định lượng',53],['risk','Đánh giá rủi ro và tín hiệu',70],['backtest','Kiểm định lịch sử',86],['visual','Tạo báo cáo và biểu đồ',96],['done','Hoàn tất báo cáo',100],
];
