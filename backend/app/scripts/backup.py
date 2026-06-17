"""每日备份：打包 data + storage 到 backups/，保留最近 7 份。"""
from __future__ import annotations

import sys
import tarfile
from datetime import datetime
from pathlib import Path

from app.core.config import get_settings


def run_backup() -> Path:
    settings = get_settings()
    settings.ensure_dirs()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive = settings.backup_dir / f"backup_{ts}.tar.gz"

    with tarfile.open(archive, "w:gz") as tar:
        if settings.data_dir.exists():
            tar.add(settings.data_dir, arcname="data")
        if settings.storage_dir.exists():
            tar.add(settings.storage_dir, arcname="storage")

    # 保留最近 7 份
    backups = sorted(settings.backup_dir.glob("backup_*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in backups[7:]:
        old.unlink(missing_ok=True)

    print(f"[backup] {archive} ({archive.stat().st_size} bytes) 完成；保留 {min(len(backups) + 1, 7)} 份")
    return archive


if __name__ == "__main__":
    try:
        run_backup()
    except Exception as e:  # noqa: BLE001
        print(f"[backup] 失败：{e}", file=sys.stderr)
        sys.exit(1)
