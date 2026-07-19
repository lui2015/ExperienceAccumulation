"""上传文件服务：HTML 与封面图的安全校验、保存、删除。"""
from __future__ import annotations

import shutil
from pathlib import Path

from bs4 import BeautifulSoup
from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

# 允许的图片类型 + magic number 头
_IMAGE_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),  # 后续还要校验 WEBP 标识
}


_UTF8_BOM = b"\xef\xbb\xbf"


def _ensure_html(content: bytes) -> None:
    """校验上传文件确实是 HTML（粗校验：去除 BOM/空白后以 < 开头，且能解析出标签）。"""
    if content.startswith(_UTF8_BOM):
        content = content[len(_UTF8_BOM):]
    head = content.lstrip()[:1024].lower()
    if not head.startswith(b"<"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "文件不是合法的 HTML（未以 < 开头）")
    # 用 bs4 简单解析下，能解析出至少一个标签即可
    try:
        soup = BeautifulSoup(content, "html.parser")
        if soup.find() is None:
            raise ValueError("no tag")
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "文件不是合法的 HTML") from None


def _ensure_image(content: bytes) -> str:
    """校验并返回图片 MIME 类型。"""
    for mime, sigs in _IMAGE_SIGNATURES.items():
        for sig in sigs:
            if content.startswith(sig):
                if mime == "image/webp":
                    if content[8:12] != b"WEBP":
                        continue
                return mime
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "封面图格式不支持，仅支持 JPG/PNG/WebP")


def _read_with_limit(file: UploadFile, max_bytes: int, kind: str) -> bytes:
    """读取上传文件内容，超过限制立即拒绝。"""
    # 优先使用 SpooledTemporaryFile 的 size 属性
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"{kind}文件超过 {max_bytes // 1024 // 1024}MB 限制",
        )
    return file.file.read()


def save_html_file(file: UploadFile, target_id: str) -> tuple[str, int]:
    """保存 HTML 文件到 storage/html/{target_id}.html，返回相对路径与字节数。"""
    settings = get_settings()
    if not (file.filename or "").lower().endswith(".html") and not (file.filename or "").lower().endswith(".htm"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "仅支持 .html / .htm 文件")
    content = _read_with_limit(file, settings.max_html_bytes, "HTML")
    _ensure_html(content)

    rel_path = f"html/{target_id}.html"
    abs_path = settings.storage_dir / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(content)
    return rel_path, len(content)


def save_cover_file(file: UploadFile, target_id: str) -> str:
    """保存封面图，返回相对路径。"""
    settings = get_settings()
    content = _read_with_limit(file, settings.max_cover_bytes, "封面图")
    mime = _ensure_image(content)
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[mime]

    rel_path = f"covers/{target_id}.{ext}"
    abs_path = settings.storage_dir / rel_path
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(content)
    return rel_path


def remove_file(rel_path: str | None) -> None:
    """安全删除文件，禁止路径穿越。"""
    if not rel_path:
        return
    settings = get_settings()
    abs_target = (settings.storage_dir / rel_path).resolve()
    base = settings.storage_dir.resolve()
    try:
        abs_target.relative_to(base)
    except ValueError:
        # 路径穿越，拒绝删除
        return
    if abs_target.is_file():
        abs_target.unlink(missing_ok=True)


def remove_cover_with_any_ext(experience_id: str) -> None:
    """删除任意扩展名的封面图（含预设产生的 svg）。"""
    settings = get_settings()
    for ext in ("jpg", "png", "webp", "svg"):
        p = settings.cover_dir / f"{experience_id}.{ext}"
        if p.is_file():
            p.unlink(missing_ok=True)


def cleanup_storage() -> None:
    """清空整个 storage 目录（仅用于测试/重置）。"""
    settings = get_settings()
    if settings.storage_dir.exists():
        shutil.rmtree(settings.storage_dir)
    settings.ensure_dirs()


def storage_path(rel_path: str) -> Path:
    settings = get_settings()
    return settings.storage_dir / rel_path
