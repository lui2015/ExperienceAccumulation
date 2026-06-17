"""经验文档模型。"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models._helpers import gen_uuid, utcnow


class Experience(Base):
    __tablename__ = "experiences"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_uuid)
    category_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("categories.id"), index=True, nullable=False
    )
    # 二级分组（可空：兼容未分组）
    group_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("groups.id"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cover_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    html_path: Mapped[str] = mapped_column(String(255), nullable=False)
    html_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    order: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, index=True)
    owner_id: Mapped[str] = mapped_column(String(32), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
