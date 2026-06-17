"""FastAPI 依赖：当前用户、Owner 守卫。"""
from typing import Annotated

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus

ACCESS_COOKIE_NAME = "exp_access_token"


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str | None, Cookie(alias=ACCESS_COOKIE_NAME)] = None,
) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "登录已过期，请重新登录") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "无效的登录态") from None

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token 类型错误")

    user = db.get(User, payload.get("sub"))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户不存在")
    if user.status != UserStatus.ACTIVE.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "账号已被禁用")
    return user


def require_owner(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != UserRole.OWNER.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "需要站主权限")
    return user
