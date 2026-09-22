"""QuanTik API. From backend/: uvicorn server:app --reload --port 8000."""
from __future__ import annotations

import asyncio
import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from runtime_env import load_project_env
from store import connect, create_scan, init_db, loads, new_job, new_session, session_exists, now
from market import overview as live_market_overview

load_project_env()
app = FastAPI(title="QuanTik API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
SYMBOL_RE = re.compile(r"^[A-Z]{3,5}$")
SORT_FIELDS = {"symbol", "recommendation", "gate_pass", "gate_explanation", "score", "rating",
               "hold_plan", "vni_trend", "sector", "sector_trend", "exchange"}
COOKIE_SECURE = os.getenv("QUANTIK_COOKIE_SECURE", "false").lower() == "true"


@app.on_event("startup")
def startup():
    init_db()


def symbol_or_400(raw: str) -> str:
    symbol = raw.strip().upper()
    if not SYMBOL_RE.fullmatch(symbol):
        raise HTTPException(400, detail={"code": "INVALID_SYMBOL", "message": "Mã cổ phiếu không hợp lệ"})
    return symbol


def owner_or_401(request: Request) -> str:
    sid = request.cookies.get("quantik_sid")
    if not session_exists(sid):
        raise HTTPException(401, detail={"code": "SESSION_REQUIRED", "message": "Cần mở phiên truy cập trước"})
    return sid


def admin_or_403(x_admin_key: str | None):
    configured = os.getenv("QUANTIK_ADMIN_KEY")
    if not configured or not x_admin_key:
        raise HTTPException(403, detail={"code": "ADMIN_DISABLED", "message": "Thiếu khóa quản trị"})
    import hmac
    if not hmac.compare_digest(configured, x_admin_key):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "Không có quyền quản trị"})


def latest_run(db):
    row = db.execute("""SELECT r.* FROM scan_runs r JOIN publication p ON p.run_id=r.id
                        WHERE p.key='latest' AND r.status='published'""").fetchone()
    if not row or (row["id"].startswith("DEMO-") and os.getenv("QUANTIK_ALLOW_DEMO", "false").lower() != "true"):
        raise HTTPException(404, detail={"code": "NO_PUBLISHED_SCAN", "message": "Chưa có bản quét được công bố"})
    return row


def owned_job(db, job_id: str, owner: str):
    row = db.execute("SELECT * FROM jobs WHERE id=? AND owner=?", (job_id, owner)).fetchone()
    if not row or row["kind"] != "quant":
        raise HTTPException(404, detail={"code": "JOB_NOT_FOUND", "message": "Không tìm thấy job"})
    return row


def public_job(row):
    params = loads(row["params_json"], {})
    return {"id": row["id"], "job_id": row["id"], "symbol": row["symbol"],
            "status": row["status"], "phase": row["phase"], "progress_pct": row["progress_pct"],
            "requested_at": row["created_at"], "started_at": row["started_at"],
            "finished_at": row["finished_at"], "error": row["error"],
            "reference_run_id": params.get("reference_run_id"),
            "report_id": row["id"] if row["status"] == "succeeded" else None}


@app.get("/health/live")
def live():
    return {"status": "ok"}


@app.get("/health/ready")
def ready():
    with connect() as db:
        db.execute("SELECT 1")
    return {"status": "ok", "storage": "sqlite"}


@app.post("/api/v1/session")
def session(request: Request, response: Response):
    sid = request.cookies.get("quantik_sid")
    if not session_exists(sid):
        sid = new_session()
        response.set_cookie("quantik_sid", sid, httponly=True, samesite="lax",
                            secure=COOKIE_SECURE, max_age=60 * 60 * 24 * 90)
    return {"ready": True}


@app.get("/api/v1/scans/latest")
def scan_latest():
    with connect() as db:
        row = latest_run(db)
        return {key: row[key] for key in ("id", "slot", "trading_date", "status", "data_as_of",
                                           "published_at", "universe_count", "analyzed_count", "failed_count")}


@app.get("/api/v1/scans/status")
def scan_status():
    """Show real scan progress even before the first real publication."""
    with connect() as db:
        run = db.execute("SELECT * FROM scan_runs WHERE id NOT LIKE 'DEMO-%' ORDER BY created_at DESC LIMIT 1").fetchone()
        if not run:
            return {"status": "not_started"}
        job = db.execute("SELECT status,phase,progress_pct,error FROM jobs WHERE kind='scan' AND params_json LIKE ? ORDER BY created_at DESC LIMIT 1",
                         (f'%{run["id"]}%',)).fetchone()
    return {"run_id": run["id"], "status": run["status"], "slot": run["slot"],
            "trading_date": run["trading_date"], "data_as_of": run["data_as_of"],
            "universe_count": run["universe_count"], "analyzed_count": run["analyzed_count"],
            "phase": job["phase"] if job else None, "progress_pct": job["progress_pct"] if job else 0,
            "error": run["error"] or (job["error"] if job else None)}


def query_results(run_id: str, q: str, exchange: str | None, recommendation: str | None,
                  gate_pass: bool | None, sector: str | None, score_min: float | None,
                  score_max: float | None, sort: str, order: str, page: int, page_size: int):
    with connect() as db:
        raw = db.execute("SELECT summary_json FROM scan_results WHERE run_id=?", (run_id,)).fetchall()
    items = [loads(row["summary_json"], {}) for row in raw]
    q = q.casefold().strip()
    items = [item for item in items if
             (not q or q in (item.get("symbol", "") + " " + item.get("name", "")).casefold()) and
             (not exchange or item.get("exchange") == exchange) and
             (not recommendation or item.get("recommendation") == recommendation) and
             (gate_pass is None or item.get("gate_pass") == gate_pass) and
             (not sector or item.get("sector") == sector) and
             (score_min is None or (item.get("score") is not None and item["score"] >= score_min)) and
             (score_max is None or (item.get("score") is not None and item["score"] <= score_max))]
    sort = sort if sort in SORT_FIELDS else "score"
    items.sort(key=lambda item: (item.get(sort) is None,
                                 item.get(sort) if isinstance(item.get(sort), (int, float, bool)) else str(item.get(sort) or "").casefold() if isinstance(item.get(sort), str) else item.get(sort) or 0),
               reverse=order.lower() != "asc")
    total = len(items)
    return {"total": total, "page": page, "page_size": page_size,
            "items": items[(page - 1) * page_size:page * page_size]}


@app.get("/api/v1/scans/latest/results")
def scan_results(q: str = "", exchange: str | None = None, recommendation: str | None = None,
                 gate_pass: bool | None = None, sector: str | None = None,
                 score_min: float | None = None, score_max: float | None = None,
                 sort: str = "score", order: str = "desc", page: int = 1, page_size: int = 10):
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(422, "page/page_size không hợp lệ")
    with connect() as db:
        run = latest_run(db)
    return {"run_id": run["id"], "data_as_of": run["data_as_of"],
            **query_results(run["id"], q, exchange, recommendation, gate_pass, sector,
                            score_min, score_max, sort, order, page, page_size)}


@app.get("/api/v1/scans/latest/facets")
def scan_facets():
    with connect() as db:
        run = latest_run(db)
        rows = db.execute("SELECT summary_json FROM scan_results WHERE run_id=?", (run["id"],)).fetchall()
    summaries = [loads(row["summary_json"], {}) for row in rows]
    return {"run_id": run["id"], **{
        key: sorted({str(item[key]) for item in summaries if item.get(key) not in (None, "")})
        for key in ("exchange", "recommendation", "sector")}}


@app.get("/api/v1/scans/latest/results/{symbol}/ohlcv")
def scan_ohlcv(symbol: str, limit: int = 260):
    symbol = symbol_or_400(symbol)
    if not 1 <= limit <= 260:
        raise HTTPException(422, "limit phải nằm trong 1..260")
    with connect() as db:
        run = latest_run(db)
        row = db.execute("SELECT summary_json,ohlcv_json FROM scan_results WHERE run_id=? AND symbol=?",
                         (run["id"], symbol)).fetchone()
    if not row:
        raise HTTPException(404, "Không tìm thấy mã")
    bars = loads(row["ohlcv_json"], [])[-limit:]
    if not bars:
        raise HTTPException(404, detail={"code": "OHLCV_UNAVAILABLE", "message": "Không có OHLCV cho mã"})
    summary = loads(row["summary_json"])
    return {"symbol": symbol, "exchange": summary.get("exchange"), "run_id": run["id"],
            "data_as_of": run["data_as_of"], "adjustment": "provider", "price_unit": "VND",
            "volume_unit": "shares", "source_meta": {"kind": "scan_snapshot"}, "bars": bars}


@app.get("/api/v1/scans/latest/results/{symbol}")
def scan_detail(symbol: str):
    symbol = symbol_or_400(symbol)
    with connect() as db:
        run = latest_run(db)
        row = db.execute("SELECT detail_json FROM scan_results WHERE run_id=? AND symbol=?",
                         (run["id"], symbol)).fetchone()
    if not row:
        raise HTTPException(404, "Không tìm thấy mã")
    return {"run_id": run["id"], "data_as_of": run["data_as_of"], **loads(row["detail_json"], {})}


@app.get("/api/v1/market/overview")
def market_overview(page: int = 1, page_size: int = 5):
    if page < 1 or page_size not in (5, 10, 20):
        raise HTTPException(422, "page/page_size không hợp lệ")
    try:
        return live_market_overview(page, page_size)
    except Exception as exc:
        raise HTTPException(503, detail={"code": "MARKET_SOURCE_UNAVAILABLE",
                                         "message": str(exc)}) from exc


class QuantRequest(BaseModel):
    symbol: str
    include_backtest: bool = True


@app.post("/api/v1/quant/jobs", status_code=202)
def create_quant_job(body: QuantRequest, request: Request,
                     idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    owner = owner_or_401(request)
    symbol = symbol_or_400(body.symbol)
    with connect() as db:
        run = latest_run(db)
        if not db.execute("SELECT 1 FROM scan_results WHERE run_id=? AND symbol=?", (run["id"], symbol)).fetchone():
            raise HTTPException(404, "Mã chưa có trong bản quét")
    try:
        row = new_job("quant", owner, symbol,
                      {"include_backtest": body.include_backtest, "reference_run_id": run["id"]},
                      idempotency_key)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {"job_id": row["id"], "status": row["status"],
            "status_url": f"/api/v1/quant/jobs/{row['id']}"}


@app.get("/api/v1/quant/jobs")
def list_quant_jobs(request: Request, symbol: str | None = None, page: int = 1, page_size: int = 20):
    owner = owner_or_401(request)
    if page < 1 or not 1 <= page_size <= 100:
        raise HTTPException(422, "page/page_size không hợp lệ")
    if symbol:
        symbol = symbol_or_400(symbol)
    allow_demo = int(os.getenv("QUANTIK_ALLOW_DEMO", "false").lower() == "true")
    with connect() as db:
        rows = db.execute("""SELECT * FROM jobs WHERE kind='quant' AND owner=? AND (? IS NULL OR symbol=?)
                             AND (?=1 OR COALESCE(json_extract(params_json,'$.reference_run_id'),'') NOT LIKE 'DEMO-%')
                             ORDER BY created_at DESC LIMIT ? OFFSET ?""",
                          (owner, symbol, symbol, allow_demo, page_size, (page - 1) * page_size)).fetchall()
        total = db.execute("""SELECT COUNT(*) FROM jobs WHERE kind='quant' AND owner=? AND (? IS NULL OR symbol=?)
                              AND (?=1 OR COALESCE(json_extract(params_json,'$.reference_run_id'),'') NOT LIKE 'DEMO-%')""",
                           (owner, symbol, symbol, allow_demo)).fetchone()[0]
    return {"items": [public_job(row) for row in rows], "total": total, "page": page, "page_size": page_size}


@app.get("/api/v1/quant/jobs/{job_id}")
def get_quant_job(job_id: str, request: Request):
    with connect() as db:
        return public_job(owned_job(db, job_id, owner_or_401(request)))


@app.delete("/api/v1/quant/jobs/{job_id}")
def cancel_quant_job(job_id: str, request: Request):
    owner = owner_or_401(request)
    with connect(write=True) as db:
        row = owned_job(db, job_id, owner)
        if row["status"] != "queued":
            raise HTTPException(409, "Chỉ có thể hủy job đang chờ")
        db.execute("UPDATE jobs SET status='cancelled',phase='cancelled',finished_at=? WHERE id=?", (now(), job_id))
        db.execute("""INSERT INTO job_events(job_id,event_type,phase,progress_pct,message,created_at)
                      VALUES (?,'job.cancelled','cancelled',0,'Đã hủy',?)""", (job_id, now()))
    return {"status": "cancelled"}


@app.get("/api/v1/quant/jobs/{job_id}/events")
async def quant_events(job_id: str, request: Request):
    owner = owner_or_401(request)
    with connect() as db:
        owned_job(db, job_id, owner)
    try:
        cursor = int(request.headers.get("last-event-id", "0"))
    except ValueError:
        cursor = 0

    async def stream():
        nonlocal cursor
        while True:
            if await request.is_disconnected():
                return
            with connect() as db:
                rows = db.execute("SELECT * FROM job_events WHERE job_id=? AND id>? ORDER BY id", (job_id, cursor)).fetchall()
                status = db.execute("SELECT status FROM jobs WHERE id=?", (job_id,)).fetchone()[0]
            for row in rows:
                cursor = row["id"]
                payload = {key: row[key] for key in ("phase", "progress_pct", "message", "created_at")}
                payload["job_id"] = job_id
                yield f"id: {cursor}\nevent: {row['event_type']}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
            if status in ("succeeded", "failed", "cancelled"):
                return
            yield ": heartbeat\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/v1/quant/reports")
def list_reports(request: Request, symbol: str | None = None):
    owner = owner_or_401(request)
    if symbol:
        symbol = symbol_or_400(symbol)
    allow_demo = int(os.getenv("QUANTIK_ALLOW_DEMO", "false").lower() == "true")
    with connect() as db:
        rows = db.execute("""SELECT * FROM jobs WHERE kind='quant' AND status='succeeded' AND owner=?
                             AND (? IS NULL OR symbol=?)
                             AND (?=1 OR COALESCE(json_extract(params_json,'$.reference_run_id'),'') NOT LIKE 'DEMO-%')
                             ORDER BY finished_at DESC""",
                          (owner, symbol, symbol, allow_demo)).fetchall()
    return {"items": [public_job(row) for row in rows], "total": len(rows)}


@app.get("/api/v1/quant/reports/{report_id}")
def get_report(report_id: str, request: Request):
    with connect() as db:
        row = owned_job(db, report_id, owner_or_401(request))
    if row["status"] != "succeeded":
        raise HTTPException(404, "Báo cáo chưa sẵn sàng")
    return loads(row["report_json"], {})


@app.get("/api/v1/quant/reports/{report_id}/artifacts/{artifact_id}")
def get_artifact(report_id: str, artifact_id: str, request: Request):
    with connect() as db:
        owned_job(db, report_id, owner_or_401(request))
        row = db.execute("SELECT path FROM artifacts WHERE id=? AND job_id=?", (artifact_id, report_id)).fetchone()
    if not row or not Path(row["path"]).is_file():
        raise HTTPException(404, "Không tìm thấy biểu đồ")
    return FileResponse(row["path"], media_type="image/png")


class ScanRequest(BaseModel):
    slot: str = Field(pattern="^(PRE_OPEN|POST_CLOSE|MANUAL)$")
    trading_date: str | None = None
    rerun_of: str | None = None


def audit_admin(action: str, target_id: str, actor: str):
    with connect(write=True) as db:
        db.execute("INSERT INTO admin_audit(action,target_id,actor,created_at) VALUES (?,?,?,?)",
                   (action, target_id, actor[:80], now()))


@app.get("/api/v1/admin/session")
def admin_session(x_admin_key: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    return {"ready": True}


@app.post("/api/v1/admin/scan-runs", status_code=202)
def admin_create_scan(body: ScanRequest, x_admin_key: str | None = Header(default=None),
                      x_admin_actor: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    date = body.trading_date or datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date().isoformat()
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(422, "trading_date không hợp lệ") from exc
    try:
        created = create_scan(body.slot, date, rerun_of=body.rerun_of)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    audit_admin("scan.create", created["run_id"], x_admin_actor or "admin-key")
    return created


@app.get("/api/v1/admin/scan-runs")
def admin_runs(x_admin_key: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    with connect() as db:
        rows = db.execute("""SELECT r.*,j.id AS job_id,j.phase AS job_phase,j.progress_pct AS progress_pct
                             FROM scan_runs r LEFT JOIN jobs j ON j.kind='scan'
                             AND json_extract(j.params_json,'$.run_id')=r.id
                             ORDER BY r.created_at DESC LIMIT 100""").fetchall()
    return {"items": [{k: row[k] for k in row.keys() if k != "index_json"} for row in rows]}


@app.get("/api/v1/admin/scan-runs/{run_id}")
def admin_run(run_id: str, x_admin_key: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    with connect() as db:
        row = db.execute("SELECT * FROM scan_runs WHERE id=?", (run_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Không tìm thấy bản quét")
    return {k: row[k] for k in row.keys() if k != "index_json"}


@app.get("/api/v1/admin/scan-runs/{run_id}/results")
def admin_run_results(run_id: str, x_admin_key: str | None = Header(default=None),
                      q: str = "", exchange: str | None = None, recommendation: str | None = None,
                      gate_pass: bool | None = None, sector: str | None = None,
                      score_min: float | None = None, score_max: float | None = None,
                      sort: str = "score", order: str = "desc", page: int = 1, page_size: int = 10):
    admin_or_403(x_admin_key)
    if page < 1 or not 1 <= page_size <= 100:
        raise HTTPException(422, "page/page_size không hợp lệ")
    with connect() as db:
        run = db.execute("SELECT id,data_as_of FROM scan_runs WHERE id=?", (run_id,)).fetchone()
    if not run:
        raise HTTPException(404, "Không tìm thấy bản quét")
    return {"run_id": run_id, "data_as_of": run["data_as_of"],
            **query_results(run_id, q, exchange, recommendation, gate_pass, sector,
                            score_min, score_max, sort, order, page, page_size)}


@app.get("/api/v1/admin/scan-runs/{run_id}/results/{symbol}")
def admin_run_result(run_id: str, symbol: str, x_admin_key: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    symbol = symbol_or_400(symbol)
    with connect() as db:
        row = db.execute("SELECT detail_json,ohlcv_json FROM scan_results WHERE run_id=? AND symbol=?",
                         (run_id, symbol)).fetchone()
    if not row:
        raise HTTPException(404, "Không tìm thấy kết quả mã")
    return {"run_id": run_id, **loads(row["detail_json"], {}), "ohlcv": loads(row["ohlcv_json"], [])}


@app.get("/api/v1/admin/jobs")
def admin_jobs(x_admin_key: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    with connect() as db:
        rows = db.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100").fetchall()
    return {"items": [public_job(row) | {"kind": row["kind"]} for row in rows]}


@app.post("/api/v1/admin/jobs/{job_id}/retry", status_code=202)
def admin_retry_job(job_id: str, x_admin_key: str | None = Header(default=None),
                    x_admin_actor: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    with connect() as db:
        row = db.execute("SELECT * FROM jobs WHERE id=? AND kind='quant'", (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Không tìm thấy job QUANT")
    if row["status"] != "failed":
        raise HTTPException(409, "Chỉ chạy lại job QUANT thất bại")
    params = loads(row["params_json"], {})
    params["retry_of"] = job_id
    created = new_job("quant", row["owner"], row["symbol"], params,
                      idempotency_key=f"admin-retry:{job_id}")
    audit_admin("job.retry", created["id"], x_admin_actor or "admin-key")
    return {"job_id": created["id"], "retry_of": job_id, "status": created["status"]}


@app.get("/api/v1/admin/audit")
def admin_audit(x_admin_key: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    with connect() as db:
        rows = db.execute("SELECT * FROM admin_audit ORDER BY id DESC LIMIT 100").fetchall()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/v1/admin/quant/reports/{job_id}")
def admin_quant_report(job_id: str, x_admin_key: str | None = Header(default=None)):
    admin_or_403(x_admin_key)
    with connect() as db:
        row = db.execute("SELECT report_json FROM jobs WHERE id=? AND kind='quant' AND status='succeeded'",
                         (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Không tìm thấy báo cáo")
    return loads(row["report_json"], {})
