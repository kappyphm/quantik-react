import sqlite3
import tempfile
import unittest
from pathlib import Path

import maintenance


class MaintenanceTest(unittest.TestCase):
    def test_backup_verify_and_isolated_restore(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / 'source.sqlite'
            artifacts = root / 'artifacts'
            artifacts.mkdir()
            (artifacts / 'chart.png').write_bytes(b'png-test')
            db = sqlite3.connect(database)
            try:
                db.execute('CREATE TABLE sample(value TEXT)')
                db.execute("INSERT INTO sample VALUES ('durable')")
                db.commit()
            finally:
                db.close()
            original_db, original_artifacts = maintenance.DB_PATH, maintenance.ARTIFACT_ROOT
            maintenance.DB_PATH, maintenance.ARTIFACT_ROOT = database, artifacts
            try:
                archive = root / 'backup.zip'
                self.assertEqual(maintenance.backup(archive)['files'], 2)
                self.assertTrue(maintenance.verify(archive)['valid'])
                restored = root / 'restored'
                self.assertEqual(maintenance.restore(archive, restored)['sqlite_integrity'], 'ok')
                db = sqlite3.connect(restored / 'database' / 'quantik.sqlite')
                try:
                    self.assertEqual(db.execute('SELECT value FROM sample').fetchone()[0], 'durable')
                finally:
                    db.close()
                self.assertEqual((restored / 'artifacts' / 'chart.png').read_bytes(), b'png-test')
            finally:
                maintenance.DB_PATH, maintenance.ARTIFACT_ROOT = original_db, original_artifacts


if __name__ == '__main__':
    unittest.main()
