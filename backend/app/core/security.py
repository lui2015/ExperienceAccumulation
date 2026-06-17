"""安全相关：密码哈希、JWT 编解码。"""
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(subject: str, *, role: str, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    minutes = expires_minutes or settings.access_token_expire_minutes
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def create_html_token(experience_id: str, *, user_id: str) -> str:
    """签发短期 HTML 访问 Token。"""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "exp_id": experience_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.html_token_expire_minutes)).timestamp()),
        "type": "html",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])
