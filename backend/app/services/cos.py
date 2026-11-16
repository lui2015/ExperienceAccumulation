"""腾讯云 COS 对象存储访问层（可选）。

设计：
- 仅当 ``settings.cos_enabled`` 为真时启用；凭证从环境变量读取，绝不写入代码/数据库。
- SDK 延迟导入：未安装 cos-python-sdk-v5 或未启用 COS 时，应用照常以本地文件运行。
- 对象 key 由相对路径拼接可配置前缀：``{prefix}/html/{id}.html``。
"""
from __future__ import annotations

from functools import lru_cache

from app.core.config import Settings, get_settings


class CosUnavailable(RuntimeError):
    """COS 未启用、配置不完整或 SDK 缺失。"""


def _full_key(rel_path: str, settings: Settings) -> str:
    rel = rel_path.lstrip("/")
    prefix = settings.cos_prefix.strip("/")
    return f"{prefix}/{rel}" if prefix else rel


@lru_cache
def _client() -> object:
    """构建 COS 客户端（单例，延迟导入 SDK）。"""
    settings = get_settings()
    if not settings.cos_enabled:
        raise CosUnavailable("COS 未启用")
    missing = [
        name
        for name, value in (
            ("COS_BUCKET", settings.cos_bucket),
            ("COS_SECRET_ID", settings.cos_secret_id),
            ("COS_SECRET_KEY", settings.cos_secret_key),
        )
        if not value
    ]
    if missing:
        raise CosUnavailable("COS 配置缺失：" + ", ".join(missing))
    try:
        from qcloud_cos import CosConfig, CosS3Client
    except ImportError:
        raise CosUnavailable("未安装 cos-python-sdk-v5") from None
    config = CosConfig(
        Region=settings.cos_region,
        SecretId=settings.cos_secret_id,
        SecretKey=settings.cos_secret_key,
        Scheme="https",
    )
    return CosS3Client(config)


def is_enabled() -> bool:
    return get_settings().cos_enabled


def bucket() -> str:
    return get_settings().cos_bucket


def key_for(rel_path: str) -> str:
    return _full_key(rel_path, get_settings())


def upload_bytes(rel_path: str, data: bytes, content_type: str | None = None) -> str:
    """上传字节到 COS，返回对象 key。"""
    client = _client()
    settings = get_settings()
    key = _full_key(rel_path, settings)
    kwargs = {"Bucket": settings.cos_bucket, "Body": data, "Key": key}
    if content_type:
        kwargs["ContentType"] = content_type
    client.put_object(**kwargs)
    return key


def upload_file(rel_path: str, file_path: str, content_type: str | None = None) -> str:
    """从本地文件上传到 COS（大文件走 SDK 分块），返回对象 key。"""
    client = _client()
    settings = get_settings()
    key = _full_key(rel_path, settings)
    kwargs = {"Bucket": settings.cos_bucket, "Key": key}
    if content_type:
        kwargs["ContentType"] = content_type
    with open(file_path, "rb") as fh:
        kwargs["Body"] = fh
        client.put_object(**kwargs)
    return key


def download_bytes(rel_path: str) -> bytes:
    """从 COS 下载对象字节。"""
    client = _client()
    settings = get_settings()
    resp = client.get_object(Bucket=settings.cos_bucket, Key=_full_key(rel_path, settings))
    body = resp["Body"]
    # SDK 的 StreamBody.read() 默认只返回首个 1024 字节块，需走原始流读全文
    if hasattr(body, "get_raw_stream"):
        return body.get_raw_stream().read()
    return body.read()


def delete(rel_path: str) -> None:
    """删除 COS 对象（不存在时不报错）。"""
    client = _client()
    settings = get_settings()
    try:
        client.delete_object(Bucket=settings.cos_bucket, Key=_full_key(rel_path, settings))
    except Exception:
        # 删除失败不应阻断主流程
        pass
