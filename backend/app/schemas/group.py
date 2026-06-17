"""分组 schema。"""
from pydantic import BaseModel, Field


class GroupBase(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    icon: str | None = Field(default=None, max_length=32)


class GroupCreate(GroupBase):
    category_id: str


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    icon: str | None = Field(default=None, max_length=32)


class GroupOut(GroupBase):
    id: str
    category_id: str
    order: float

    model_config = {"from_attributes": True}
