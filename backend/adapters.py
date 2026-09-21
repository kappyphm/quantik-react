"""
Chỗ DUY NHẤT bạn cần nối vào code Python gốc (quant_pipeline.py, quant_visual.py, vnstock_data...).
Mỗi hàm bên dưới đang là bản demo chạy được để thử giao diện. Thay phần thân bằng lời gọi thật,
giữ nguyên chữ ký hàm và định dạng dữ liệu trả về thì server.py và React không phải sửa.
"""
from __future__ import annotations
import hashlib, random, time
from pathlib import Path

# ---- 1. Bảng điện ---------------------------------------------------------
def load_board(group: str) -> list[dict]:
    """Trả về danh sách mã. Giá tính theo nghìn đồng.
    TODO: đọc từ vnstock_data (KBS/VCI) hoặc Google Sheet giá real-time của bạn,
    và lấy `score` từ kết quả pipeline chạy cuối phiên (cache), không tính lại mỗi lần gọi."""
    universe = ["HHP", "HPG", "VCB", "FPT", "VNM", "MWG", "SSI", "VIC", "VHM", "ACB", "TCB", "MBB", "VPB", "GAS", "MSN"]
    if group == "VN30":
        universe = [s for s in universe if s != "HHP"]
    rows = []
    for s in universe:
        r = random.Random(int(hashlib.md5(s.encode()).hexdigest(), 16) + int(time.time() // 5))
        ref = round(10 + (int(hashlib.md5(s.encode()).hexdigest(), 16) % 900) / 10, 2)
        price = round(ref * (1 + r.uniform(-0.03, 0.03)), 2)
        rows.append({
            "sym": s, "name": "", "sector": "", "ref": ref, "price": price,
            "ceil": round(ref * 1.07, 2), "floor": round(ref * 0.93, 2),
            "vol": r.randint(200_000, 3_000_000),
            "score": 40 + int(hashlib.md5(s.encode()).hexdigest(), 16) % 50,
            "spark": [round(ref * (1 + r.uniform(-0.05, 0.05)), 2) for _ in range(30)],
        })
    return rows

# ---- 2. Pipeline quant ----------------------------------------------------
MODULES = [
    {"id": "trend", "name": "Xu hướng", "desc": "Giá so với SMA 20 / 50 / 200"},
    {"id": "mom", "name": "Động lượng", "desc": "RSI 14 và MACD"},
    {"id": "flow", "name": "Dòng tiền", "desc": "Chaikin Money Flow 20 phiên"},
    {"id": "rs", "name": "Sức mạnh tương đối", "desc": "So với VN-Index, hệ số beta"},
    {"id": "hmm", "name": "Trạng thái thị trường (HMM)", "desc": "Tăng, đi ngang hoặc giảm"},
    {"id": "garch", "name": "Biến động (GARCH)", "desc": "Độ bền biến động, ATR"},
    {"id": "mc", "name": "Mô phỏng Monte Carlo", "desc": "1.000 đường giá, 10 phiên"},
    {"id": "risk", "name": "Rủi ro và sụt giảm", "desc": "Max drawdown, VaR, CVaR"},
    {"id": "decision", "name": "Tổng hợp quyết định", "desc": "Điểm, cắt lỗ, chốt lời"},
]

def load_context(symbol: str) -> dict:
    """Nạp dữ liệu giá của mã + VN-Index vào một dict dùng chung cho các module.
    TODO: gọi hàm tải dữ liệu trong quant_pipeline.py / crawl_data.py."""
    return {"symbol": symbol}

def run_module(module_id: str, ctx: dict) -> dict:
    """Chạy MỘT module và ghi kết quả vào ctx.
    TODO: map từng id sang engine thật của bạn, ví dụ:
      hmm   -> HMMEngine        garch -> GARCHEngine      mc   -> FcastEngine (Monte Carlo)
      risk  -> RiskEng (ATR stop, tối ưu expectancy)      decision -> AdaptiveScorer
    Lưu ý: engine nặng (HMM, GARCH) nên chạy được độc lập; module sau có thể đọc ctx của module trước."""
    time.sleep(0.4)  # demo
    ctx[module_id] = {"ok": True}
    return ctx

def summarize(ctx: dict) -> dict:
    """Các con số hiển thị ở hàng đầu bảng kết quả (đơn vị: nghìn đồng)."""
    return {"score": 59, "action": "Theo dõi, chờ xác nhận", "entry": 17.0, "stop": 16.25,
            "tp1": 17.6, "tp2": 17.7, "net_r": 0.63, "atr_pct": 2.12}

def render_image(ctx: dict, path: Path) -> None:
    """Dựng ảnh tổng quan 6 panel và lưu ra `path` (PNG).
    TODO: gọi hàm vẽ trong quant_visual.py, ví dụ fig.savefig(path, dpi=160, facecolor=fig.get_facecolor())."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(12, 5), facecolor="#0b1017")
    ax.set_facecolor("#0b1017"); ax.axis("off")
    ax.text(0.5, 0.5, f"Ảnh demo cho {ctx['symbol']}\nThay bằng quant_visual.py", color="#f5a623", ha="center", va="center", fontsize=18)
    fig.savefig(path, dpi=110, facecolor=fig.get_facecolor()); plt.close(fig)
