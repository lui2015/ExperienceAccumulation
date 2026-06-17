"""应用配置：从环境变量加载。"""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    app_env: Literal["dev", "prod"] = "dev"
    app_debug: bool = True
    app_base_url: str = "http://localhost:5173"
    app_root_path: str = ""

    # Security
    secret_key: str
    access_token_expire_minutes: int = 60 * 24 * 7
    html_token_expire_minutes: int = 5
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # Owner bootstrap
    owner_username: str = "admin"
    owner_password: str = "please_change_me"

    # Storage
    data_dir: Path = Path("./data")
    storage_dir: Path = Path("./storage")
    backup_dir: Path = Path("./backups")

    # Limits
    max_html_size_mb: int = 20
    max_cover_size_mb: int = 5

    # HTML 沙箱
    html_view_base_url: str = "http://localhost:5174"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def db_path(self) -> Path:
        return self.data_dir / "app.db"

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.db_path.as_posix()}"

    @property
    def html_dir(self) -> Path:
        return self.storage_dir / "html"

    @property
    def cover_dir(self) -> Path:
        return self.storage_dir / "covers"

    @property
    def max_html_bytes(self) -> int:
        return self.max_html_size_mb * 1024 * 1024

    @property
    def max_cover_bytes(self) -> int:
        return self.max_cover_size_mb * 1024 * 1024

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.storage_dir, self.html_dir, self.cover_dir, self.backup_dir):
            p.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()  # type: ignore[call-arg]
    s.ensure_dirs()
    return s
