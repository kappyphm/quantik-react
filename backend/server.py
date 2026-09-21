"""QuanTik API. Chạy:  uvicorn server:app --reload --port 8000"""
from __future__ import annotations
import datetime as dt, threading, time, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import adapters

OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

app = FastAPI(title="QuanTik API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

JOBS: dict[str, dict] = {}
POOL = ThreadPoolExecutor(max_workers=2)  # HMM/GARCH nặng CPU: nếu cần chạy song song thật, đổi sang ProcessPoolExecutor
LOCK = threading.Lock()
NAMES = {m["id"]: m for m in adapters.MODULES}


class JobRequest(BaseModel):
    symbol: str
    modules: list[str] | None = None  # None = chạy tất cả


def eod_key() -> str:
    """Kết quả chỉ đổi khi có dữ liệu phiên mới, nên cache theo ngày."""
    return dt.date.today().isoformat()


@app.get("/api/board")
def board(group: str = "HOSE"):
    return adapters.load_board(group)


@app.get("/api/quant/modules")
def modules():
    return adapters.MODULES


@app.post("/api/quant/jobs")
def create_job(req: JobRequest):
    sym = req.symbol.upper().strip()
    if not sym.isalnum() or len(sym) > 5:
        raise HTTPException(400, "Mã không hợp lệ")
    ids = req.modules or [m["id"] for m in adapters.MODULES]
    unknown = [m for m in ids if m not in NAMES]
    if unknown:
        raise HTTPException(400, f"Module không tồn tại: {unknown}")

    key = f"{sym}_{eod_key()}_{'-'.join(ids)}"
    png = OUT / f"{key}.png"
    job_id = uuid.uuid4().hex[:12]
    job = {
        "id": job_id, "symbol": sym, "status": "queued", "png": png, "error": None, "summary": None,
        "modules": [{"id": i, "name": NAMES[i]["name"], "state": "wait", "sec": None} for i in ids],
    }
    with LOCK:
        JOBS[job_id] = job
    POOL.submit(run_job, job_id, png.exists())
    return {"id": job_id}


def run_job(job_id: str, cached: bool):
    job = JOBS[job_id]
    try:
        job["status"] = "running"
        ctx = adapters.load_context(job["symbol"])
        for m in job["modules"]:
            m["state"] = "running"
            t = time.perf_counter()
            if not cached:
                ctx = adapters.run_module(m["id"], ctx)
            m["sec"] = round(time.perf_counter() - t, 1)
            m["state"] = "done"
        if not cached:
            adapters.render_image(ctx, job["png"])
        job["summary"] = adapters.summarize(ctx)
        job["status"] = "done"
    except Exception as e:  # lỗi thật của pipeline hiện ra trên giao diện
        job["status"], job["error"] = "error", f"{type(e).__name__}: {e}"


@app.get("/api/quant/jobs/{job_id}")
def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Không thấy job")
    return {k: v for k, v in job.items() if k != "png"}


@app.get("/api/quant/jobs/{job_id}/image")
def job_image(job_id: str):
    job = JOBS.get(job_id)
    if not job or job["status"] != "done":
        raise HTTPException(404, "Chưa có ảnh")
    return FileResponse(job["png"], media_type="image/png")
