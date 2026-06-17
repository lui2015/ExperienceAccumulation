"""经验文档 schema。"""
from datetime import datetime

from pydantic import BaseModel, Field


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


class HtmlTokenOut(BaseModel):
    token: str
    url: str
    expires_in: int


class MoveItem(BaseModel):
    """跨组拖拽时的批量更新。"""
    id: str
    group_id: str | None = None
    order: float
