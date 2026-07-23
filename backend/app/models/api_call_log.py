"""开放接口调用统计日志。

每次通过开放接口（Bearer 令牌鉴权）调用成功时写入一条记录，
用于统计当日 / 累计调用次数。
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models._helpers import gen_uuid, utcnow


class ApiCallLog(Base):
    __tablename__ = "api_call_logs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id"), index=True, nullable=False
    )
    user_role: Mapped[str | None] = mapped_column(String(16), nullable=True)
    endpoint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
