"""Explicit local demo seed. Run from backend/: python seed_demo.py.

Reads the existing FE PoC fixture via Node; never labels synthetic prices as live.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from store import connect, dumps, init_db, now

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = """
import {stocks} from './src/demo.js';
import {demoBars} from './src/demoPrices.js';
console.log(JSON.stringify({stocks:stocks.map(s=>({...s,bars:demoBars(s.symbol,s.score)})),indexBars:demoBars('VNINDEX',72).map(b=>({...b,open:b.open*14.2,high:b.high*14.2,low:b.low*14.2,close:b.close*14.2}))}));
"""


def seed():
    init_db()
    fixture = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", SCRIPT], cwd=ROOT))
    run_id = "DEMO-POST-20260921"
    with connect(write=True) as db:
        if db.execute("SELECT 1 FROM scan_runs WHERE id=?", (run_id,)).fetchone():
            print("Demo run already exists; leaving database unchanged")
            return
        db.execute("""INSERT INTO scan_runs(id,trading_date,slot,attempt,status,created_at,published_at,
                      data_as_of,universe_count,analyzed_count,index_json)
                      VALUES (?,'2026-09-21','POST_CLOSE',1,'published',?,?,?,?,?,?)""",
                   (run_id, now(), now(), "2026-09-21", len(fixture["stocks"]),
                    len(fixture["stocks"]), dumps(fixture["indexBars"])))
        for stock in fixture["stocks"]:
            bars = stock.pop("bars")
            summary = {"symbol": stock["symbol"], "name": stock["name"],
                       "exchange": stock["exchange"], "recommendation": stock["recommendation"],
                       "gate_pass": stock["gatePass"], "gate_explanation": stock["gateExplanation"],
                       "score": stock["score"], "rating": stock["rating"], "hold_plan": stock["holdPlan"],
                       "vni_trend": stock["vniTrend"], "sector": stock["sector"],
                       "sector_trend": stock["sectorTrend"], "analysis_status": "demo"}
            detail = {**summary, "source_meta": {"kind": "synthetic_demo"},
                      "commentary": stock["gateExplanation"], "screener": {}, "quant": {}}
            db.execute("""INSERT INTO scan_results(run_id,symbol,summary_json,detail_json,ohlcv_json)
                          VALUES (?,?,?,?,?)""",
                       (run_id, stock["symbol"], dumps(summary), dumps(detail), dumps(bars)))
        db.execute("""INSERT INTO publication(key,run_id) VALUES ('latest',?)
                      ON CONFLICT(key) DO NOTHING""", (run_id,))
    print(f"Seeded {len(fixture['stocks'])} demo symbols; source=synthetic_demo")


if __name__ == "__main__":
    seed()
