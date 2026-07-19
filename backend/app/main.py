"""FastAPI 应用入口。"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, categories, cover_presets, experiences, files, groups, open as open_api, search, users, visitors
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时确保目录、初始化数据
    from app.scripts.init_data import bootstrap

    bootstrap()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Experience Accumulation API",
        version="1.0.0",
        root_path=settings.app_root_path,
        lifespan=lifespan,
    )

    # 仅在开发环境放开跨域，生产由 Nginx 同域处理
    if settings.app_env == "dev":
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[settings.app_base_url, settings.html_view_base_url],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # 业务路由：/api/v1/...
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(categories.router, prefix="/api/v1")
    app.include_router(groups.router, prefix="/api/v1")
    app.include_router(experiences.router, prefix="/api/v1")
    app.include_router(search.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(visitors.router, prefix="/api/v1")
    # 文件路由：HTML 走 /files/html/{token}（沙箱域），封面走 /api/v1/...
    app.include_router(files.router)
    # 封面预设（列表 + 单张预览）
    app.include_router(cover_presets.router)
    # 开放接口：令牌管理与 AI 代理提交
    app.include_router(open_api.router, prefix="/api/v1")

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
