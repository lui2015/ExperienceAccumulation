"""分类 schema。"""
import re

from pydantic import BaseModel, Field, field_validator

_SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")


class CategoryBase(BaseModel):
    slug: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=64)
    icon: str | None = Field(default=None, max_length=32)

    @field_validator("slug")
    @classmethod
    def _slug_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not _SLUG_PATTERN.match(v):
            raise ValueError("slug 仅允许小写字母、数字、连字符，且不能以连字符开头")
        return v


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=64)
    icon: str | None = Field(default=None, max_length=32)

    @field_validator("slug")
    @classmethod
    def _slug_format(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if not _SLUG_PATTERN.match(v):
            raise ValueError("slug 仅允许小写字母、数字、连字符")
        return v


class CategoryOut(CategoryBase):
    id: str
    order: float

    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    id: str
    order: float


class ReorderIn(BaseModel):
    items: list[ReorderItem]
