"""首次启动初始化：建表 + 创建 Owner + 种子分类。"""
from __future__ import annotations

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import Category, User  # noqa: F401  (确保导入后注册到 Base.metadata)
from app.models.category import Category
from app.models.user import User, UserRole, UserStatus

# 种子分类（用户原始诉求的三个 Tab）
SEED_CATEGORIES = [
    {"slug": "pm", "name": "互联网项目管理", "icon": "💼", "order": 1000.0},
    {"slug": "finance", "name": "金融投资", "icon": "📈", "order": 2000.0},
    {"slug": "mindset", "name": "思维认知", "icon": "🧠", "order": 3000.0},
]


def bootstrap() -> None:
    """启动钩子：建表（含轻量迁移） + 必要种子数据。可重复执行（幂等）。"""
    settings = get_settings()
    settings.ensure_dirs()
    Base.metadata.create_all(bind=engine)

    # 兼容已存在的旧库：补建新表/新列
    from app.scripts.migrate import migrate as _migrate
    _migrate()

    with SessionLocal() as db:
        # 1) Owner 账号（仅当不存在 owner 时创建）
        owner = db.execute(
            select(User).where(User.role == UserRole.OWNER.value)
        ).scalar_one_or_none()
        if owner is None:
            owner = User(
                username=settings.owner_username,
                password_hash=hash_password(settings.owner_password),
                role=UserRole.OWNER.value,
                status=UserStatus.ACTIVE.value,
                remark="站主",
            )
            db.add(owner)
            db.flush()
            print(f"[init] 已创建站主账号：{owner.username}")

        # 2) 种子分类
        existing_slugs = set(db.execute(select(Category.slug)).scalars().all())
        for seed in SEED_CATEGORIES:
            if seed["slug"] not in existing_slugs:
                db.add(Category(**seed))
                print(f"[init] 已创建分类：{seed['name']}")

        db.commit()


if __name__ == "__main__":
    bootstrap()
    print("[init] 完成。")
