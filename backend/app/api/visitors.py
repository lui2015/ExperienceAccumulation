"""访客管理路由（仅 Owner）。"""
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_owner
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus
from app.schemas.visitor import VisitorCreate, VisitorCreatedOut, VisitorOut, VisitorUpdate

router = APIRouter(prefix="/visitors", tags=["visitors"])


def _gen_password() -> str:
    return secrets.token_urlsafe(9)  # 约 12 字符


@router.get("", response_model=list[VisitorOut])
def list_visitors(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> list[User]:
    return (
        db.query(User)
        .filter(User.role == UserRole.VISITOR.value)
        .order_by(User.created_at.desc())
        .all()
    )


@router.post("", response_model=VisitorCreatedOut, status_code=status.HTTP_201_CREATED)
def create_visitor(
    payload: VisitorCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> VisitorCreatedOut:
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "用户名已被占用")
    raw_password = _gen_password()
    user = User(
        username=payload.username,
        password_hash=hash_password(raw_password),
        role=UserRole.VISITOR.value,
        remark=payload.remark,
        status=UserStatus.ACTIVE.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return VisitorCreatedOut(
        id=user.id,
        username=user.username,
        remark=user.remark,
        status=user.status,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        initial_password=raw_password,
    )


@router.patch("/{user_id}", response_model=VisitorOut | VisitorCreatedOut)
def update_visitor(
    user_id: str,
    payload: VisitorUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
):
    user = db.get(User, user_id)
    if not user or user.role != UserRole.VISITOR.value:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "访客不存在")

    if payload.remark is not None:
        user.remark = payload.remark
    if payload.status is not None:
        user.status = payload.status

    new_pwd: str | None = None
    if payload.reset_password:
        new_pwd = _gen_password()
        user.password_hash = hash_password(new_pwd)

    db.commit()
    db.refresh(user)

    if new_pwd is not None:
        return VisitorCreatedOut(
            id=user.id,
            username=user.username,
            remark=user.remark,
            status=user.status,
            last_login_at=user.last_login_at,
            created_at=user.created_at,
            initial_password=new_pwd,
        )
    return VisitorOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_visitor(
    user_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> None:
    user = db.get(User, user_id)
    if not user or user.role != UserRole.VISITOR.value:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "访客不存在")
    db.delete(user)
    db.commit()
