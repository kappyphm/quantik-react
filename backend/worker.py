"""Separate durable worker: python worker.py (run one: python worker.py --once)."""
from __future__ import annotations

import argparse
import logging
import os
import re
import shutil
import time
import threading
import uuid
from datetime import date
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

from runtime_env import load_project_env

load_project_env()
from engine import quant_from_snapshot, scan_all
from backtest_service import recommendation_backtest
from store import claim_job, connect, dumps, heartbeat_job, init_db, loads, now, update_job

log = logging.getLogger("quantik.worker")
ARTIFACT_ROOT = Path(os.getenv("QUANTIK_ARTIFACT_ROOT", Path(__file__).resolve().parent / "data" / "artifacts"))


def validate_scan_result(result: dict, slot: str, trading_date: str):
    universe = max(1, result["universe_count"])
    coverage = result["analyzed_count"] / universe
    min_coverage = float(os.getenv("QUANTIK_MIN_COVERAGE", "0.80"))
    if coverage < min_coverage:
        raise RuntimeError(f"Độ phủ {coverage:.1%} thấp hơn ngưỡng {min_coverage:.1%}; run không được công bố")
    if not result["index_bars"]:
        raise RuntimeError("Thiếu OHLCV VN-Index; run không được công bố")
    index_date = date.fromisoformat(result["index_bars"][-1]["time"][:10])
    requested_date = date.fromisoformat(trading_date)
    age = (requested_date - index_date).days
    max_age = int(os.getenv("QUANTIK_MAX_DATA_AGE_DAYS", "7"))
    if age < 0 or age > max_age:
        raise RuntimeError(f"VN-Index có ngày dữ liệu {index_date} không hợp lệ cho {trading_date}")
    if slot == "POST_CLOSE" and index_date != requested_date:
        raise RuntimeError(f"POST_CLOSE thiếu dữ liệu phiên {trading_date}; VN-Index đến {index_date}")
    if slot == "PRE_OPEN" and index_date >= requested_date:
        raise RuntimeError(f"PRE_OPEN không được dùng dữ liệu phiên {trading_date}")
    if result["data_as_of"] != index_date.isoformat():
        raise RuntimeError(f"Ngày dữ liệu mã ({result['data_as_of']}) không khớp VN-Index ({index_date})")
    fresh = sum(summary.get("analysis_status") in ("completed", "screened_out")
                and bars and bars[-1]["time"][:10] == index_date.isoformat()
                for summary, _, bars in result["results"])
    min_fresh = float(os.getenv("QUANTIK_MIN_FRESH_COVERAGE", "0.75"))
    if fresh / universe < min_fresh:
        raise RuntimeError(f"Chỉ {fresh}/{universe} mã có dữ liệu cùng ngày với VN-Index; cần {min_fresh:.0%}")


def run_scan(job):
    params = loads(job["params_json"], {})
    run_id = params["run_id"]
    with connect() as db:
        existing = db.execute("SELECT status,rerun_of FROM scan_runs WHERE id=?", (run_id,)).fetchone()
    if existing and existing["status"] == "published":
        update_job(job["id"], "done", 100, "Bản quét đã công bố", status="succeeded")
        return
    with connect(write=True) as db:
        try:
            source_version = f"vnstock-{version('vnstock')}"
        except PackageNotFoundError:
            source_version = "vnstock-unknown"
        scan_config = {
            "fetch_interval_seconds": float(os.getenv("QUANTIK_FETCH_INTERVAL_SECONDS", "1.5")),
            "min_coverage": float(os.getenv("QUANTIK_MIN_COVERAGE", "0.80")),
            "min_fresh_coverage": float(os.getenv("QUANTIK_MIN_FRESH_COVERAGE", "0.75")),
            "max_data_age_days": int(os.getenv("QUANTIK_MAX_DATA_AGE_DAYS", "7")),
        }
        db.execute("""UPDATE scan_runs SET status='running',started_at=?,model_version=?,
                      source_version=?,config_json=? WHERE id=?""",
                   (now(), os.getenv("QUANTIK_MODEL_VERSION", "quant-engine-v7-copy"),
                    source_version, dumps(scan_config), run_id))

    def progress(phase, pct, message):
        update_job(job["id"], phase, pct, message)

    def universe_ready(count):
        with connect(write=True) as db:
            db.execute("UPDATE scan_runs SET universe_count=? WHERE id=?", (count, run_id))

    try:
        cache_root = ARTIFACT_ROOT.parent / "scan_cache"
        checkpoint_dir = cache_root / run_id
        if existing and existing["rerun_of"]:
            previous_dir = cache_root / existing["rerun_of"]
            if previous_dir.is_dir():
                checkpoint_dir.mkdir(parents=True, exist_ok=True)
                copied = 0
                for source in previous_dir.iterdir():
                    if not source.is_file() or not re.fullmatch(r"[A-Z0-9]{3,5}\.(csv|source)", source.name):
                        continue
                    target = checkpoint_dir / source.name
                    if not target.exists():
                        shutil.copy2(source, target)
                        copied += 1
                progress("collecting", 4, f"Dùng lại {copied} file dữ liệu của lượt quét gốc")
        result = scan_all(progress, symbols=params.get("symbols"),
                          checkpoint_dir=checkpoint_dir,
                          universe_ready=universe_ready)
        with connect(write=True) as db:
            for summary, detail, bars in result["results"]:
                db.execute("""INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json)
                              VALUES (?,?,?,?,?) ON CONFLICT(run_id,symbol) DO UPDATE SET
                              summary_json=excluded.summary_json,detail_json=excluded.detail_json,
                              ohlcv_json=excluded.ohlcv_json""",
                           (run_id, summary["symbol"], dumps(summary), dumps(detail), dumps(bars)))
            db.execute("""UPDATE scan_runs SET data_as_of=?,universe_count=?,analyzed_count=?,
                          failed_count=?,index_json=? WHERE id=?""",
                       (result["data_as_of"], result["universe_count"], result["analyzed_count"],
                        result["failed_count"], dumps(result["index_bars"]), run_id))
        with connect() as db:
            scan_slot = db.execute("SELECT slot,trading_date FROM scan_runs WHERE id=?", (run_id,)).fetchone()
        validate_scan_result(result, scan_slot["slot"], scan_slot["trading_date"])
        with connect(write=True) as db:
            db.execute("UPDATE scan_runs SET status='published',published_at=? WHERE id=?", (now(), run_id))
            db.execute("""INSERT INTO publication(key,run_id) VALUES ('latest',?)
                          ON CONFLICT(key) DO UPDATE SET run_id=excluded.run_id""", (run_id,))
        update_job(job["id"], "done", 100, "Đã công bố bản quét", status="succeeded")
    except Exception as exc:
        with connect(write=True) as db:
            safe_error = f"{type(exc).__name__}: {exc}"[:1000]
            db.execute("UPDATE scan_runs SET status='failed',error=? WHERE id=?", (safe_error, run_id))
        raise


def run_quant(job):
    symbol = job["symbol"]
    params = loads(job["params_json"], {})
    output_dir = ARTIFACT_ROOT / job["id"]
    output_dir.mkdir(parents=True, exist_ok=True)

    def progress(phase, pct, message):
        update_job(job["id"], phase, pct, message)

    current_run = params.get("reference_run_id")
    if not current_run or current_run.startswith("DEMO-"):
        raise RuntimeError("Job không tham chiếu bản quét production")
    with connect() as db:
        snapshot = db.execute("""SELECT s.summary_json,s.ohlcv_json,r.index_json
                                 FROM scan_results s JOIN scan_runs r ON r.id=s.run_id
                                 WHERE s.run_id=? AND s.symbol=? AND r.status='published'
                                 AND r.id NOT LIKE 'DEMO-%'""", (current_run, symbol)).fetchone()
    if not snapshot:
        raise RuntimeError("Snapshot đã công bố không còn khả dụng")
    summary = loads(snapshot["summary_json"], {})
    current_bars = loads(snapshot["ohlcv_json"], [])
    report, visuals, current_bars = quant_from_snapshot(
        symbol, current_bars, loads(snapshot["index_json"], []),
        summary.get("exchange", "UNKNOWN"), progress, output_dir,
        params.get("include_backtest", True))
    report["analysis_mode"] = "quant_core"
    report["job_id"] = job["id"]
    report["reference_run_id"] = current_run
    report["chart_manifest"] = []
    artifact_root = ARTIFACT_ROOT.resolve()
    with connect(write=True) as db:
        for path in visuals.get("generated", []):
            path = Path(path).resolve()
            if not path.is_file() or not path.is_relative_to(artifact_root):
                continue
            artifact_id = uuid.uuid4().hex
            db.execute("INSERT INTO artifacts(id,job_id,kind,path,created_at) VALUES (?,?,?,?,?)",
                       (artifact_id, job["id"], path.stem, str(path), now()))
            report["chart_manifest"].append({"id": artifact_id, "kind": path.stem,
                                              "url": f"/api/v1/quant/reports/{job['id']}/artifacts/{artifact_id}"})
    report["visual_errors"] = visuals.get("skipped", {})
    if params.get("include_backtest"):
        report["backtest"] = recommendation_backtest(symbol, current_bars)
    else:
        report["backtest"] = {"status": "skipped", "reason": "Người dùng không yêu cầu kiểm định lịch sử."}
    update_job(job["id"], "done", 100, "Đã hoàn tất báo cáo", status="succeeded", report=report)


def process_one():
    job = claim_job()
    if not job:
        return False
    log.info("Running %s job %s", job["kind"], job["id"])
    stop_heartbeat = threading.Event()

    def keep_alive():
        while not stop_heartbeat.wait(20):
            try:
                heartbeat_job(job["id"])
            except Exception:
                log.exception("Heartbeat failed for job %s", job["id"])

    heartbeat_thread = threading.Thread(target=keep_alive, daemon=True)
    heartbeat_thread.start()
    try:
        if job["kind"] == "scan":
            run_scan(job)
        else:
            run_quant(job)
    except Exception as exc:
        log.exception("Job %s failed", job["id"])
        update_job(job["id"], "failed", job["progress_pct"], f"Lỗi: {exc}",
                   status="failed", error=f"{type(exc).__name__}: {exc}")
    finally:
        stop_heartbeat.set()
        heartbeat_thread.join(timeout=2)
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Process at most one queued job")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    init_db()
    while True:
        worked = process_one()
        if args.once:
            break
        if not worked:
            time.sleep(2)
