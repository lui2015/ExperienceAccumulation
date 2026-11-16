"""把本地 storage/html 下的 HTML 全量迁移到 COS。

用法：
    python -m app.scripts.migrate_html_to_cos            # 执行迁移（需 COS_ENABLED=true 及凭证）
    python -m app.scripts.migrate_html_to_cos --dry-run  # 仅列出待迁移文件

说明：
- 对象 key 沿用相对路径 html/{id}.html（可加 COS_PREFIX），数据库无需改动。
- 幂等：重复执行会覆盖同名对象；上传后校验对象大小与本地一致。
- 只上传，不删除本地文件（迁移期保留副本便于回退）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.core.config import get_settings
from app.services import cos as cos_svc


def run(dry_run: bool = False) -> tuple[int, int, int]:
    settings = get_settings()
    html_dir = settings.storage_dir / "html"
    if not html_dir.is_dir():
        print(f"[migrate-cos] 本地 HTML 目录不存在：{html_dir}")
        return 0, 0, 0

    files = sorted(p for p in html_dir.glob("*.html") if p.is_file())
    total = len(files)
    print(
        f"[migrate-cos] 待迁移 {total} 个 HTML；"
        f"COS 前缀={settings.cos_prefix or '(根)'} bucket={settings.cos_bucket or '(未配置)'}"
    )
    if dry_run:
        for p in files:
            print(f"  - {p.name} ({p.stat().st_size} bytes)")
        return total, 0, 0

    if not cos_svc.is_enabled():
        print("[migrate-cos] 错误：COS_ENABLED 未开启，请在 .env 中配置 COS_ENABLED=true 及凭证", file=sys.stderr)
        sys.exit(1)

    ok = failed = 0
    for idx, path in enumerate(files, 1):
        rel = f"html/{path.name}"
        size = path.stat().st_size
        try:
            key = cos_svc.upload_file(rel, str(path), content_type="text/html; charset=utf-8")
            # 校验：下载回来比对字节数（3.3MB 级别，成本低）
            downloaded = cos_svc.download_bytes(rel)
            if len(downloaded) != size:
                raise RuntimeError(f"大小校验失败：本地 {size} / COS {len(downloaded)}")
            ok += 1
            if idx % 10 == 0 or idx == total:
                print(f"[migrate-cos] 进度 {idx}/{total}  key={key}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"[migrate-cos] 失败 {rel}: {e}", file=sys.stderr)

    print(f"[migrate-cos] 完成：成功 {ok}，失败 {failed}，总计 {total}")
    return total, ok, failed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="迁移本地 HTML 到腾讯云 COS")
    parser.add_argument("--dry-run", action="store_true", help="仅列出待迁移文件，不上传")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
