"""用户管理路由（仅 Owner 可操作）。"""
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_owner
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserCreate, UserCreatedOut, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _gen_password() -> str:
    return secrets.token_urlsafe(9)  # ≈12 字符


@router.get("", response_model=list[UserOut])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> list[User]:
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserCreatedOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> UserCreatedOut:
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "用户名已被占用")

    initial_password = payload.password or _gen_password()
    user = User(
        username=payload.username,
        password_hash=hash_password(initial_password),
        role=payload.role,
        remark=payload.remark,
        status=UserStatus.ACTIVE.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserCreatedOut(
        id=user.id,
        username=user.username,
        role=user.role,
        remark=user.remark,
        status=user.status,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        # 用户自己设了密码就不展示明文（他知道密码）；自动生成才展示
        initial_password=None if payload.password else initial_password,
    )


@router.patch("/{user_id}", response_model=UserCreatedOut)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[User, Depends(require_owner)],
) -> UserCreatedOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")

    if payload.remark is not None:
        user.remark = payload.remark
    if payload.status is not None:
        # 不允许把自己禁用
        if user.id == current.id and payload.status == UserStatus.DISABLED.value:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能禁用自己的账号")
        user.status = payload.status
    if payload.role is not None:
        # 不允许把最后一个 Owner 降级为 visitor
        if (
            user.role == UserRole.OWNER.value
            and payload.role != UserRole.OWNER.value
            and db.query(User).filter(User.role == UserRole.OWNER.value).count() <= 1
        ):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "至少需要保留一名站主")
        user.role = payload.role

    new_pwd: str | None = None
    if payload.new_password:
        user.password_hash = hash_password(payload.new_password)
    elif payload.reset_password:
        new_pwd = _gen_password()
        user.password_hash = hash_password(new_pwd)

    db.commit()
    db.refresh(user)

    return UserCreatedOut(
        id=user.id,
        username=user.username,
        role=user.role,
        remark=user.remark,
        status=user.status,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        initial_password=new_pwd,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Annotated[Session, Depends(get_db)],
    current: Annotated[User, Depends(require_owner)],
) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    # 不允许删除自己
    if user.id == current.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能删除自己的账号")
    # 不允许删除最后一个 Owner
    if (
        user.role == UserRole.OWNER.value
        and db.query(User).filter(User.role == UserRole.OWNER.value).count() <= 1
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "至少需要保留一名站主")
    db.delete(user)
    db.commit()
