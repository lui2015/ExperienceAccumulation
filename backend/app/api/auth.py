"""认证相关路由。"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import ACCESS_COOKIE_NAME, get_current_user
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models._helpers import utcnow
from app.models.user import User, UserStatus
from app.schemas.auth import LoginIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, response: Response, request: Request, db: Annotated[Session, Depends(get_db)]) -> User:
    settings = get_settings()
    user = db.query(User).filter(User.username == payload.username).one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        # 不区分用户名错与密码错，避免帐号枚举
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    if user.status != UserStatus.ACTIVE.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "账号已被禁用")

    user.last_login_at = utcnow()
    db.commit()

    token = create_access_token(user.id, role=user.role)
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
def me(user: Annotated[User, Depends(get_current_user)]) -> User:
    return user
