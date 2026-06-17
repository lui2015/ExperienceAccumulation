"""排序辅助：用浮点数实现廉价的拖拽排序。"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.experience import Experience


def next_experience_order(db: Session, category_id: str) -> float:
    """获取某分类下最大 order + 1000，新建时追加到末尾。"""
    stmt = select(func.coalesce(func.max(Experience.order), 0.0)).where(
        Experience.category_id == category_id, Experience.deleted_at.is_(None)
    )
    return float(db.execute(stmt).scalar_one()) + 1000.0


def next_category_order(db: Session) -> float:
    stmt = select(func.coalesce(func.max(Category.order), 0.0))
    return float(db.execute(stmt).scalar_one()) + 1000.0
