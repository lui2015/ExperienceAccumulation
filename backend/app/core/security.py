"""安全相关：密码哈希、JWT 编解码、开放接口令牌。"""
import hashlib
import hmac
import secrets
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


def create_share_token(experience_id: str, *, ttl_days: int = 365) -> str:
    """签发长期公开分享 Token（与短 token 共用 type=html，files.py 仅校验 exp_id）。

    与 create_html_token 不同的是：
    - 不绑定 sub（user_id），任何人持 token 都可访问对应 HTML
    - 默认有效期 365 天
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "share",
        "exp_id": experience_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=ttl_days)).timestamp()),
        "type": "html",
        "scope": "share",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])


def generate_open_token() -> str:
    """生成开放接口令牌（明文，仅返回一次）。"""
    return "ea_" + secrets.token_urlsafe(32)


def hash_open_token(token: str) -> str:
    """对令牌做 SHA-256 哈希，用于安全存储。"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_open_token(token: str, stored_hash: str | None) -> bool:
    """恒定时间比对令牌与存储的哈希。"""
    if not token or not stored_hash:
        return False
    return hmac.compare_digest(hash_open_token(token), stored_hash)
