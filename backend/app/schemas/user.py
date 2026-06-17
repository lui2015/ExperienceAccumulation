"""用户管理 schema（站主管理所有账号，包括其他 Owner / Visitor）。"""
from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    role: str = Field(pattern=r"^(owner|visitor)$")
    password: str | None = Field(default=None, min_length=6, max_length=128)
    """留空时自动生成 12 位随机密码。"""
    remark: str | None = Field(default=None, max_length=128)


class UserUpdate(BaseModel):
    remark: str | None = Field(default=None, max_length=128)
    status: str | None = Field(default=None, pattern=r"^(active|disabled)$")
    role: str | None = Field(default=None, pattern=r"^(owner|visitor)$")
    new_password: str | None = Field(default=None, min_length=6, max_length=128)
    """如果只是想"重置成随机"，使用 reset_password=true 即可。"""
    reset_password: bool = False


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    remark: str | None
    status: str
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreatedOut(UserOut):
    """创建/重置密码时返回，包含一次性明文密码（仅 reset_password=true 或 password 为空时返回）。"""
    initial_password: str | None = None
