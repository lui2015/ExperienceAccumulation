"""分组模型（分类下的二级分组，如「金融投资 > 仓位管理」）。"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models._helpers import gen_uuid, utcnow


class Group(Base):
    __tablename__ = "groups"
    __table_args__ = (UniqueConstraint("category_id", "name", name="uq_group_category_name"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_uuid)
    category_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("categories.id"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(32), nullable=True)
    order: Mapped[float] = mapped_column(Float, default=0.0, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
