"""A crashed worker must not strand a published scan or its queue job."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import store


class RecoveryTest(unittest.TestCase):
    def test_stale_scan_is_reclaimed(self):
        with tempfile.TemporaryDirectory() as directory:
            original = store.DB_PATH
            store.DB_PATH = Path(directory) / "test.sqlite"
            try:
                store.init_db()
                created = store.create_scan("MANUAL", "2026-09-22")
                first = store.claim_job()
                self.assertEqual(first["id"], created["job_id"])
                with store.connect(write=True) as db:
                    db.execute("UPDATE jobs SET heartbeat_at='2000-01-01T00:00:00+00:00' WHERE id=?", (first["id"],))
                    db.execute("UPDATE scan_runs SET status='running' WHERE id=?", (created["run_id"],))
                second = store.claim_job()
                self.assertEqual(second["id"], first["id"])
                with store.connect() as db:
                    self.assertEqual(db.execute("SELECT status FROM scan_runs WHERE id=?", (created["run_id"],)).fetchone()[0], "queued")
            finally:
                store.DB_PATH = original


if __name__ == "__main__":
    unittest.main()
