"""One scheduler process for PRE_OPEN and POST_CLOSE scan slots.

Configure holiday dates through QUANTIK_HOLIDAYS=YYYY-MM-DD,YYYY-MM-DD.
Only one scheduler instance should run for the SQLite deployment.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from runtime_env import load_project_env
from store import connect, create_scan, init_db

load_project_env()
log = logging.getLogger("quantik.scheduler")
ZONE = ZoneInfo("Asia/Ho_Chi_Minh")


def tick():
    current = datetime.now(ZONE)
    date = current.date().isoformat()
    holidays = {item.strip() for item in os.getenv("QUANTIK_HOLIDAYS", "").split(",") if item.strip()}
    if current.weekday() >= 5 or date in holidays:
        return
    clock = current.strftime("%H:%M")
    slots = (("PRE_OPEN", os.getenv("QUANTIK_PRE_OPEN_TIME", "07:00")),
             ("POST_CLOSE", os.getenv("QUANTIK_POST_CLOSE_TIME", "16:20")))
    for slot, scheduled in slots:
        if clock < scheduled:
            continue
        with connect() as db:
            existing = db.execute("SELECT 1 FROM scan_runs WHERE trading_date=? AND slot=?",
                                  (date, slot)).fetchone()
        if not existing:
            created = create_scan(slot, date)
            log.info("Enqueued %s scan %s for %s", slot, created["run_id"], date)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
    while True:
        tick()
        time.sleep(30)
