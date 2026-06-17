"""通用模型工具。"""
import uuid
from datetime import datetime, timezone


def gen_uuid() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
