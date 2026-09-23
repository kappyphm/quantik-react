"""One scheduler process for PRE_OPEN and POST_CLOSE scan slots.

Configure holiday dates through QUANTIK_HOLIDAYS=YYYY-MM-DD,YYYY-MM-DD.
Only one scheduler instance should run for the SQLite deployment.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from runtime_env import load_project_env
from store import connect, create_scan, heartbeat_service, init_db

load_project_env()
log = logging.getLogger("quantik.scheduler")
ZONE = ZoneInfo("Asia/Ho_Chi_Minh")


def tick(current=None):
    current = current or datetime.now(ZONE)
    date = current.date().isoformat()
    heartbeat_service("scheduler", "ready", {
        "local_time": current.isoformat(timespec="seconds"),
        "pre_open": os.getenv("QUANTIK_PRE_OPEN_TIME", "07:00"),
        "post_close": os.getenv("QUANTIK_POST_CLOSE_TIME", "16:20"),
    })
    holidays = {item.strip() for item in os.getenv("QUANTIK_HOLIDAYS", "").split(",") if item.strip()}
    with connect() as db:
        override = db.execute("SELECT is_trading_day FROM trading_calendar WHERE trading_date=?", (date,)).fetchone()
    is_trading_day = bool(override["is_trading_day"]) if override else current.weekday() < 5 and date not in holidays
    if not is_trading_day:
        return
    slots = (("PRE_OPEN", os.getenv("QUANTIK_PRE_OPEN_TIME", "07:00")),
             ("POST_CLOSE", os.getenv("QUANTIK_POST_CLOSE_TIME", "16:20")))
    for slot, scheduled in slots:
        try:
            hour, minute = map(int, scheduled.split(":"))
            scheduled_at = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
        except (ValueError, TypeError):
            log.error("Invalid schedule for %s: %r", slot, scheduled)
            continue
        if not scheduled_at <= current < scheduled_at + timedelta(minutes=5):
            continue
        with connect() as db:
            existing = db.execute("SELECT 1 FROM scan_runs WHERE trading_date=? AND slot=?",
                                  (date, slot)).fetchone()
        if not existing:
            try:
                created = create_scan(slot, date)
                log.info("Enqueued %s scan %s for %s", slot, created["run_id"], date)
            except ValueError:
                log.info("Scan %s for %s was already enqueued", slot, date)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
    while True:
        tick()
        time.sleep(30)
