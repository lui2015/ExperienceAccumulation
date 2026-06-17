"""分类（Tab）管理路由。"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_owner
from app.db.session import get_db
from app.models.category import Category
from app.models.experience import Experience
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ReorderIn,
)
from app.services.ordering import next_category_order

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[Category]:
    stmt = select(Category).order_by(Category.order.asc())
    return list(db.execute(stmt).scalars().all())


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> Category:
    if db.query(Category).filter(Category.slug == payload.slug).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "slug 已存在")
    cat = Category(slug=payload.slug, name=payload.name, icon=payload.icon, order=next_category_order(db))
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{cat_id}", response_model=CategoryOut)
def update_category(
    cat_id: str,
    payload: CategoryUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> Category:
    cat = db.get(Category, cat_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分类不存在")
    if payload.slug and payload.slug != cat.slug:
        if db.query(Category).filter(Category.slug == payload.slug).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "slug 已存在")
        cat.slug = payload.slug
    if payload.name is not None:
        cat.name = payload.name
    if payload.icon is not None:
        cat.icon = payload.icon
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    cat_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> None:
    cat = db.get(Category, cat_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分类不存在")
    # 非空分类禁止删除
    has_exp = (
        db.query(Experience)
        .filter(Experience.category_id == cat_id, Experience.deleted_at.is_(None))
        .first()
        is not None
    )
    if has_exp:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "该分类下仍有经验文档，请先迁移或删除后再操作"
        )
    db.delete(cat)
    db.commit()


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_categories(
    payload: ReorderIn,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> None:
    ids = [item.id for item in payload.items]
    cats = db.query(Category).filter(Category.id.in_(ids)).all()
    by_id = {c.id: c for c in cats}
    for item in payload.items:
        c = by_id.get(item.id)
        if c:
            c.order = item.order
    db.commit()
