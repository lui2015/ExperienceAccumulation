"""经验文档 schema。"""
from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_serializer


class ExperienceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    summary: str | None = Field(default=None, max_length=255)
    category_id: str | None = None
    group_id: str | None = None


class ExperienceOut(BaseModel):
    id: str
    category_id: str
    group_id: str | None
    title: str
    summary: str | None
    cover_url: str | None
    has_cover: bool
    html_size: int
    order: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "updated_at")
    def _serialize_dt(self, dt: datetime | None) -> datetime | None:
        # SQLite 读出的 datetime 会丢失时区信息（虽以 UTC 存储）。
        # 这里补回 UTC 时区并保留 +00:00 后缀，避免前端 new Date()
        # 将其误当作本地时间解析，造成偏差约 8 小时（UTC+8）。
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt


class HtmlTokenOut(BaseModel):
    token: str
    url: str
    expires_in: int


class MoveItem(BaseModel):
    """跨组拖拽时的批量更新。"""
    id: str
    group_id: str | None = None
    order: float
