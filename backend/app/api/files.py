"""文件下载路由：HTML 通过 Token 鉴权，封面图通过登录鉴权。"""
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.db.session import get_db
from app.models.experience import Experience
from app.models.user import User
from app.services import storage as storage_svc

router = APIRouter(tags=["files"])


# 注：HTML 路径不带 /api/v1 前缀，方便部署在独立子域 view.luliming.xyz
@router.get("/files/html/{token}", include_in_schema=True)
def download_html(token: str, db: Annotated[Session, Depends(get_db)]) -> Response:
    """通过短期 Token 下载 HTML 文档（沙箱域使用）。"""
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "链接已过期，请重新打开") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "无效的链接") from None

    if payload.get("type") != "html":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token 类型错误")

    exp_id = payload.get("exp_id")
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "经验不存在")

    abs_path = storage_svc.storage_path(exp.html_path)
    if not abs_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "文件丢失")

    # 安全响应头：阻止脚本访问主站
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        # 浏览器侧再加一层 CSP（与 iframe sandbox 互补）
        "Content-Security-Policy": "frame-ancestors 'self' " + get_settings().app_base_url,
    }
    return FileResponse(abs_path, media_type="text/html; charset=utf-8", headers=headers)


@router.get("/api/v1/experiences/{exp_id}/cover")
def download_cover(
    exp_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Response:
    """封面图下载（登录态访问，主站同源）。"""
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None or not exp.cover_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "封面不存在")
    abs_path = storage_svc.storage_path(exp.cover_path)
    if not abs_path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "封面文件丢失")
    ext = abs_path.suffix.lstrip(".")
    media = {
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "svg": "image/svg+xml",
    }.get(ext, "application/octet-stream")
    return FileResponse(abs_path, media_type=media)
