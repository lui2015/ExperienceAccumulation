"""导入所有模型，便于 Alembic 自动发现。"""
from app.models.user import User  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.group import Group  # noqa: F401
from app.models.experience import Experience  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
