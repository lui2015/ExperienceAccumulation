"""把本地 storage 下的 HTML 与封面图全量迁移到 COS。

用法：
    python -m app.scripts.migrate_html_to_cos             # 迁移 html/ + covers/
    python -m app.scripts.migrate_html_to_cos --only html # 仅迁移 HTML
    python -m app.scripts.migrate_html_to_cos --only covers
    python -m app.scripts.migrate_html_to_cos --dry-run   # 仅列出待迁移文件

说明：
- 对象 key 沿用相对路径（html/{id}.html、covers/{id}.{ext}），加 COS_PREFIX，数据库无需改动。
- 幂等：重复执行覆盖同名对象；用 head_object 的 Content-Length 校验，不依赖流式下载。
- 只上传，不删除本地文件（迁移期保留副本便于回退）。
"""
from __future__ import annotations

import argparse
import sys

from app.core.config import get_settings
from app.services import cos as cos_svc

_MIME = {
    "html": "text/html; charset=utf-8",
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "svg": "image/svg+xml",
}


def _collect(settings, only: str | None) -> list[tuple[str, object, str]]:
    """返回 [(rel_path, local_path, content_type)]。"""
    out: list[tuple[str, object, str]] = []
    if only in (None, "html"):
        d = settings.storage_dir / "html"
        if d.is_dir():
            for p in sorted(d.glob("*.html")):
                if p.is_file():
                    out.append((f"html/{p.name}", p, _MIME["html"]))
    if only in (None, "covers"):
        d = settings.storage_dir / "covers"
        if d.is_dir():
            for p in sorted(d.iterdir()):
                if p.is_file() and p.suffix.lstrip(".").lower() in ("jpg", "png", "webp", "svg"):
                    ext = p.suffix.lstrip(".").lower()
                    out.append((f"covers/{p.name}", p, _MIME[ext]))
    return out


def run(dry_run: bool = False, only: str | None = None) -> tuple[int, int, int]:
    settings = get_settings()
    files = _collect(settings, only)
    total = len(files)
    print(
        f"[migrate-cos] 待迁移 {total} 个文件（范围={only or 'html+covers'}）；"
        f"前缀={settings.cos_prefix or '(根)'} bucket={settings.cos_bucket or '(未配置)'}"
    )
    if dry_run:
        for rel, p, _ in files:
            print(f"  - {rel} ({p.stat().st_size} bytes)")
        return total, 0, 0

    if not cos_svc.is_enabled():
        print("[migrate-cos] 错误：COS_ENABLED 未开启，请在 .env 配置 COS_ENABLED=true 及凭证", file=sys.stderr)
        sys.exit(1)

    client = cos_svc._client()
    ok = failed = 0
    for idx, (rel, path, ctype) in enumerate(files, 1):
        size = path.stat().st_size
        try:
            cos_svc.upload_file(rel, str(path), content_type=ctype)
            head = client.head_object(Bucket=settings.cos_bucket, Key=cos_svc.key_for(rel))
            remote_size = int(head["Content-Length"])
            if remote_size != size:
                raise RuntimeError(f"大小校验失败：本地 {size} / COS {remote_size}")
            ok += 1
            if idx % 10 == 0 or idx == total:
                print(f"[migrate-cos] 进度 {idx}/{total}  key={cos_svc.key_for(rel)}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"[migrate-cos] 失败 {rel}: {e}", file=sys.stderr)

    print(f"[migrate-cos] 完成：成功 {ok}，失败 {failed}，总计 {total}")
    return total, ok, failed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="迁移本地 HTML/封面到腾讯云 COS")
    parser.add_argument("--dry-run", action="store_true", help="仅列出待迁移文件，不上传")
    parser.add_argument("--only", choices=("html", "covers"), help="仅迁移指定类型")
    args = parser.parse_args()
    run(dry_run=args.dry_run, only=args.only)
