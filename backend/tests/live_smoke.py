"""Optional real-source integration check: python tests/live_smoke.py.

Uses a temporary database and artifacts; never publishes into the active app.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    with tempfile.TemporaryDirectory(prefix="quantik-live-smoke-") as directory:
        os.environ["QUANTIK_DB_PATH"] = str(Path(directory) / "smoke.sqlite")
        os.environ["QUANTIK_ARTIFACT_ROOT"] = str(Path(directory) / "artifacts")
        from fastapi.testclient import TestClient
        from engine import scan_all
        from server import app
        from store import connect, dumps, init_db, now
        from worker import process_one

        init_db()
        result = scan_all(lambda *args: None, symbols=["FPT"],
                          checkpoint_dir=Path(directory) / "scan_cache")
        assert result["analyzed_count"] == 1 and result["index_bars"]
        run_id = "LIVE-SMOKE-FPT"
        with connect(write=True) as db:
            db.execute("""INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,published_at,
                       data_as_of,universe_count,analyzed_count,index_json)
                       VALUES (? ,?,'MANUAL',1,'published',?,?,?,?,?,?)""",
                       (run_id, result["data_as_of"], now(), now(), result["data_as_of"],
                        1, 1, dumps(result["index_bars"])))
            for summary, detail, bars in result["results"]:
                db.execute("INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json) VALUES (?,?,?,?,?)",
                           (run_id, summary["symbol"], dumps(summary), dumps(detail), dumps(bars)))
            db.execute("INSERT INTO publication(key,run_id) VALUES ('latest',?)", (run_id,))
        with TestClient(app) as client:
            assert client.get("/api/v1/scans/latest").status_code == 200
            assert client.get("/api/v1/scans/latest/results/FPT/ohlcv").json()["bars"]
            assert client.post("/api/v1/session").status_code == 200
            created = client.post("/api/v1/quant/jobs", json={"symbol": "FPT"})
            assert created.status_code == 202, created.text
            job_id = created.json()["job_id"]
            assert process_one()
            job = client.get(f"/api/v1/quant/jobs/{job_id}").json()
            assert job["status"] == "succeeded", job
            report = client.get(f"/api/v1/quant/reports/{job_id}").json()
            assert report["symbol"] == "FPT"
            assert report["analysis_mode"] == "quant_core"
            assert len(report["chart_manifest"]) == 7, report.get("visual_errors")
            for artifact in report["chart_manifest"]:
                image = client.get(artifact["url"])
                assert image.status_code == 200 and image.headers["content-type"] == "image/png"
            print({"scan": result["data_as_of"], "job": job["status"],
                   "report_mode": report["analysis_mode"], "charts": len(report["chart_manifest"])})


if __name__ == "__main__":
    main()
