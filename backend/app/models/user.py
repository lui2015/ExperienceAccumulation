"""用户模型：站主 + 访客。"""
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models._helpers import gen_uuid, utcnow


class UserRole(str, Enum):
    OWNER = "owner"
    VISITOR = "visitor"


class UserStatus(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_uuid)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default=UserRole.VISITOR.value, nullable=False)
    remark: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default=UserStatus.ACTIVE.value, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    # 开放接口令牌（仅哈希存储；明文只在生成时返回一次）
    api_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    @property
    def is_owner(self) -> bool:
        return self.role == UserRole.OWNER.value

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE.value
