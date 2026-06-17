"""认证相关 schema。"""
from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    remark: str | None = None

    model_config = {"from_attributes": True}
