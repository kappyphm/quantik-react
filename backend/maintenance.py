"""Backup, verify and restore QuanTik's durable SQLite data and report artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from runtime_env import load_project_env

load_project_env()
from store import DB_PATH

ARTIFACT_ROOT = Path(os.getenv("QUANTIK_ARTIFACT_ROOT", Path(__file__).resolve().parent / "data" / "artifacts"))


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def backup(output: Path) -> dict:
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        snapshot = Path(temporary) / "quantik.sqlite"
        source = sqlite3.connect(DB_PATH, timeout=30)
        target = sqlite3.connect(snapshot)
        try:
            source.backup(target)
        finally:
            target.close()
            source.close()
        entries = {"database/quantik.sqlite": snapshot.read_bytes()}
        if ARTIFACT_ROOT.is_dir():
            for path in ARTIFACT_ROOT.rglob("*"):
                if path.is_file():
                    entries[f"artifacts/{path.relative_to(ARTIFACT_ROOT).as_posix()}"] = path.read_bytes()
        manifest = {"format": 1, "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "files": {name: {"size": len(data), "sha256": digest(data)}
                              for name, data in sorted(entries.items())}}
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for name, data in entries.items():
                archive.writestr(name, data)
            archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    return {"archive": str(output), "files": len(entries), "created_at": manifest["created_at"]}


def verify(archive_path: Path) -> dict:
    with zipfile.ZipFile(archive_path, "r") as archive:
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("format") != 1 or "database/quantik.sqlite" not in manifest.get("files", {}):
            raise ValueError("Định dạng backup không hợp lệ")
        for name, expected in manifest["files"].items():
            data = archive.read(name)
            if len(data) != expected["size"] or digest(data) != expected["sha256"]:
                raise ValueError(f"Checksum không khớp: {name}")
    return {"valid": True, "files": len(manifest["files"]), "created_at": manifest["created_at"]}


def restore(archive_path: Path, target_dir: Path) -> dict:
    verified = verify(archive_path)
    target_dir = Path(target_dir).resolve()
    if target_dir.exists() and any(target_dir.iterdir()):
        raise ValueError("Thư mục restore phải rỗng")
    target_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive_path, "r") as archive:
        manifest = json.loads(archive.read("manifest.json"))
        for name in manifest["files"]:
            relative = Path(name)
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError("Đường dẫn backup không an toàn")
            destination = target_dir / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(name))
    restored_db = target_dir / "database" / "quantik.sqlite"
    db = sqlite3.connect(restored_db)
    try:
        check = db.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        db.close()
    if check != "ok":
        raise ValueError(f"SQLite restore lỗi: {check}")
    return {**verified, "target": str(target_dir), "sqlite_integrity": check}


def main():
    parser = argparse.ArgumentParser()
    actions = parser.add_subparsers(dest="action", required=True)
    create = actions.add_parser("backup")
    create.add_argument("output", type=Path)
    inspect = actions.add_parser("verify")
    inspect.add_argument("archive", type=Path)
    recover = actions.add_parser("restore")
    recover.add_argument("archive", type=Path)
    recover.add_argument("target", type=Path, help="An empty directory; never restores over the live database")
    args = parser.parse_args()
    result = backup(args.output) if args.action == "backup" else verify(args.archive) if args.action == "verify" else restore(args.archive, args.target)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
