"""Durable storage for the API and the separate worker process.

SQLite is the local deployment default. One writer claims jobs at a time;
PostgreSQL is the intended production replacement when traffic grows.
"""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("QUANTIK_DB_PATH", ROOT / "data" / "quantik.sqlite"))


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False)


def loads(value, default=None):
    return json.loads(value) if value else default


@contextmanager
def connect(write=False):
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout=30000")
    db.execute("PRAGMA foreign_keys=ON")
    if write:
        db.execute("BEGIN IMMEDIATE")
    try:
        yield db
        if write:
            db.commit()
    except Exception:
        if write:
            db.rollback()
        raise
    finally:
        db.close()


def init_db():
    with connect() as db:
        db.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scan_runs (
          id TEXT PRIMARY KEY, trading_date TEXT NOT NULL, slot TEXT NOT NULL,
          attempt INTEGER NOT NULL, status TEXT NOT NULL,
          created_at TEXT NOT NULL, started_at TEXT, published_at TEXT,
          data_as_of TEXT, universe_count INTEGER NOT NULL DEFAULT 0,
          analyzed_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
          index_json TEXT, error TEXT,
          UNIQUE(trading_date, slot, attempt)
        );
        CREATE TABLE IF NOT EXISTS scan_results (
          run_id TEXT NOT NULL, symbol TEXT NOT NULL, summary_json TEXT NOT NULL,
          detail_json TEXT NOT NULL, ohlcv_json TEXT,
          PRIMARY KEY(run_id, symbol),
          FOREIGN KEY(run_id) REFERENCES scan_runs(id)
        );
        CREATE TABLE IF NOT EXISTS publication (
          key TEXT PRIMARY KEY, run_id TEXT NOT NULL,
          FOREIGN KEY(run_id) REFERENCES scan_runs(id)
        );
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner TEXT,
          symbol TEXT, status TEXT NOT NULL, phase TEXT NOT NULL,
          progress_pct INTEGER NOT NULL DEFAULT 0,
          params_json TEXT NOT NULL, report_json TEXT,
          idempotency_key TEXT, created_at TEXT NOT NULL,
          started_at TEXT, finished_at TEXT, error TEXT,
          FOREIGN KEY(owner) REFERENCES sessions(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency ON jobs(owner, idempotency_key)
          WHERE idempotency_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(status, created_at);
        CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner, created_at DESC);
        CREATE TABLE IF NOT EXISTS job_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
          event_type TEXT NOT NULL, phase TEXT NOT NULL, progress_pct INTEGER NOT NULL,
          message TEXT NOT NULL, created_at TEXT NOT NULL,
          FOREIGN KEY(job_id) REFERENCES jobs(id)
        );
        CREATE INDEX IF NOT EXISTS job_events_job ON job_events(job_id, id);
        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY, job_id TEXT NOT NULL, kind TEXT NOT NULL,
          path TEXT NOT NULL, created_at TEXT NOT NULL,
          FOREIGN KEY(job_id) REFERENCES jobs(id)
        );
        """)


def new_session() -> str:
    sid = uuid.uuid4().hex + uuid.uuid4().hex
    with connect(write=True) as db:
        db.execute("INSERT INTO sessions(id, created_at) VALUES (?,?)", (sid, now()))
    return sid


def session_exists(sid: str | None) -> bool:
    if not sid:
        return False
    with connect() as db:
        return db.execute("SELECT 1 FROM sessions WHERE id=?", (sid,)).fetchone() is not None


def new_job(kind: str, owner: str | None, symbol: str | None, params: dict,
            idempotency_key: str | None = None) -> dict:
    with connect(write=True) as db:
        if idempotency_key and owner:
            old = db.execute("SELECT * FROM jobs WHERE owner=? AND idempotency_key=?",
                             (owner, idempotency_key)).fetchone()
            if old:
                if old["kind"] != kind or old["symbol"] != symbol or loads(old["params_json"]) != params:
                    raise ValueError("Idempotency-Key đã được dùng cho yêu cầu khác")
                return dict(old)
        job_id = uuid.uuid4().hex
        db.execute("""INSERT INTO jobs(id,kind,owner,symbol,status,phase,params_json,idempotency_key,created_at)
                      VALUES (?,?,?,?,'queued','queued',?,?,?)""",
                   (job_id, kind, owner, symbol, dumps(params), idempotency_key, now()))
        db.execute("""INSERT INTO job_events(job_id,event_type,phase,progress_pct,message,created_at)
                      VALUES (?,'job.progress','queued',0,?,?)""", (job_id, "Đang chờ worker", now()))
        return dict(db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())


def claim_job() -> dict | None:
    with connect(write=True) as db:
        row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1").fetchone()
        if not row:
            return None
        db.execute("UPDATE jobs SET status='running',phase='starting',started_at=? WHERE id=?", (now(), row["id"]))
        return dict(db.execute("SELECT * FROM jobs WHERE id=?", (row["id"],)).fetchone())


def update_job(job_id: str, phase: str, progress: int, message: str,
               status: str = "running", report: dict | None = None, error: str | None = None):
    progress = max(0, min(100, int(progress)))
    event_type = "job.succeeded" if status == "succeeded" else "job.failed" if status == "failed" else "job.progress"
    with connect(write=True) as db:
        db.execute("""UPDATE jobs SET status=?,phase=?,progress_pct=?,
                      report_json=COALESCE(?,report_json),error=?,
                      finished_at=CASE WHEN ? IN ('succeeded','failed','cancelled') THEN ? ELSE finished_at END
                      WHERE id=?""",
                   (status, phase, progress, dumps(report) if report is not None else None,
                    error, status, now(), job_id))
        db.execute("""INSERT INTO job_events(job_id,event_type,phase,progress_pct,message,created_at)
                      VALUES (?,?,?,?,?,?)""", (job_id, event_type, phase, progress, message, now()))


def create_scan(slot: str, trading_date: str, owner: str | None = None) -> dict:
    with connect(write=True) as db:
        attempt = db.execute("SELECT COALESCE(MAX(attempt),0)+1 FROM scan_runs WHERE trading_date=? AND slot=?",
                             (trading_date, slot)).fetchone()[0]
        run_id = uuid.uuid4().hex
        db.execute("""INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at)
                      VALUES (?,?,?,?,'queued',?)""", (run_id, trading_date, slot, attempt, now()))
        job_id = uuid.uuid4().hex
        db.execute("""INSERT INTO jobs(id,kind,owner,status,phase,params_json,created_at)
                      VALUES (?,'scan',?,'queued','queued',?,?)""",
                   (job_id, owner, dumps({"run_id": run_id}), now()))
        db.execute("""INSERT INTO job_events(job_id,event_type,phase,progress_pct,message,created_at)
                      VALUES (?,'job.progress','queued',0,?,?)""", (job_id, "Đang chờ worker quét", now()))
        return {"run_id": run_id, "job_id": job_id, "slot": slot, "trading_date": trading_date, "attempt": attempt}
