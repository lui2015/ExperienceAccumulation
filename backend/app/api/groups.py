"""分组（Tab 内子分组）路由。"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_owner
from app.db.session import get_db
from app.models.category import Category
from app.models.experience import Experience
from app.models.group import Group
from app.models.user import User
from app.schemas.category import ReorderIn
from app.schemas.group import GroupCreate, GroupOut, GroupUpdate
from app.services import search as search_svc

router = APIRouter(prefix="/groups", tags=["groups"])


def _next_order(db: Session, category_id: str) -> float:
    stmt = select(func.coalesce(func.max(Group.order), 0.0)).where(
        Group.category_id == category_id
    )
    return float(db.execute(stmt).scalar_one()) + 1000.0


@router.get("", response_model=list[GroupOut])
def list_groups(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    category_id: str | None = None,
) -> list[Group]:
    stmt = select(Group)
    if category_id:
        stmt = stmt.where(Group.category_id == category_id)
    stmt = stmt.order_by(Group.category_id.asc(), Group.order.asc())
    return list(db.execute(stmt).scalars().all())


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> Group:
    if not db.get(Category, payload.category_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分类不存在")
    # 同分类下分组名唯一
    exists = (
        db.query(Group)
        .filter(Group.category_id == payload.category_id, Group.name == payload.name)
        .first()
    )
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "该分类下已存在同名分组")

    g = Group(
        category_id=payload.category_id,
        name=payload.name,
        icon=payload.icon,
        order=_next_order(db, payload.category_id),
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.put("/{gid}", response_model=GroupOut)
def update_group(
    gid: str,
    payload: GroupUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> Group:
    g = db.get(Group, gid)
    if not g:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分组不存在")
    if payload.name is not None and payload.name != g.name:
        dup = (
            db.query(Group)
            .filter(
                Group.category_id == g.category_id,
                Group.name == payload.name,
                Group.id != gid,
            )
            .first()
        )
        if dup:
            raise HTTPException(status.HTTP_409_CONFLICT, "同分类下已存在同名分组")
        g.name = payload.name
        # 改名后，刷新该分组下所有经验的 FTS 索引（group_name 列）
        affected = (
            db.query(Experience)
            .filter(Experience.group_id == gid, Experience.deleted_at.is_(None))
            .all()
        )
        for e in affected:
            html_text = (
                search_svc.extract_text_from_file(e.html_path) if e.html_path else ""
            )
            search_svc.upsert_index(
                db,
                experience_id=e.id,
                title=e.title,
                summary=e.summary,
                group_id=e.group_id,
                html_text=html_text,
            )
    if payload.icon is not None:
        g.icon = payload.icon
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{gid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    gid: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> None:
    g = db.get(Group, gid)
    if not g:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分组不存在")
    has_exp = (
        db.query(Experience)
        .filter(Experience.group_id == gid, Experience.deleted_at.is_(None))
        .first()
        is not None
    )
    if has_exp:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "该分组下仍有经验文档，请先迁移或删除后再操作",
        )
    db.delete(g)
    db.commit()


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_groups(
    payload: ReorderIn,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> None:
    ids = [it.id for it in payload.items]
    rows = db.query(Group).filter(Group.id.in_(ids)).all()
    by_id = {g.id: g for g in rows}
    for it in payload.items:
        g = by_id.get(it.id)
        if g:
            g.order = it.order
    db.commit()
