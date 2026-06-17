"""访客管理 schema。"""
from datetime import datetime

from pydantic import BaseModel, Field


class VisitorCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    remark: str | None = Field(default=None, max_length=128)


class VisitorUpdate(BaseModel):
    remark: str | None = Field(default=None, max_length=128)
    status: str | None = Field(default=None, pattern=r"^(active|disabled)$")
    reset_password: bool = False


class VisitorOut(BaseModel):
    id: str
    username: str
    remark: str | None
    status: str
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VisitorCreatedOut(VisitorOut):
    """创建/重置密码时返回，包含一次性明文密码。"""
    initial_password: str
