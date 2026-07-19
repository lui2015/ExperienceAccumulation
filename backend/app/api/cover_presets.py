"""封面预设：列表 + 单张预览。"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.models.user import User
from app.services import cover_presets as preset_svc

router = APIRouter(tags=["cover-presets"])


class CoverPresetOut(BaseModel):
    key: str
    label: str
    color: str
    url: str


@router.get("/api/v1/cover-presets", response_model=list[CoverPresetOut])
def list_cover_presets(
    _: Annotated[User, Depends(get_current_user)],
) -> list[CoverPresetOut]:
    """登录用户均可获取预设列表（访客也能浏览到封面缩略）。"""
    return [CoverPresetOut(**item) for item in preset_svc.list_presets()]


@router.get("/api/v1/cover-presets/{key}")
def preview_cover_preset(
    key: str,
    _: Annotated[User, Depends(get_current_user)],
) -> FileResponse:
    """返回指定预设的 SVG 内容。"""
    path = preset_svc.preset_path(key)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "预设不存在")
    # SVG 自身可执行脚本，但来源完全可信（白名单本地文件），且仅在主站登录态展示
    return FileResponse(
        path,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )
