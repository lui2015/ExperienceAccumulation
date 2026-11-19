"""开放接口（Open API）
===================

面向 AI 编程助手 / 外部系统的极简接口，无需任何令牌，可直接调用：

写入类
  - POST /open/experiences          新建一条经验（表单），统一归属站主账号
  - GET  /open/meta                 读取站点元数据（分类、封面预设）
读取类
  - GET  /open/experiences          分页读取经验列表（可按分类过滤）
  - GET  /open/experiences/{id}     读取单条经验元数据
  - GET  /open/experiences/{id}/html 读取经验正文 HTML（text/html）
  - GET  /open/search               全文搜索（元数据 / 正文）
管理类
  - GET  /open/stats                调用统计（站主 Cookie 登录后查看）

设计取舍：为简化调用、方便 AI 与第三方直接接入，开放接口不校验令牌，所有写入
统一归属到站主（role=owner）账号，可在后台统一管理；读取仅返回已发布（未删除）
经验，不含任何用户隐私数据。
"""
from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, status, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import require_owner
from app.db.session import get_db
from app.models._helpers import gen_uuid, utcnow
from app.models.api_call_log import ApiCallLog
from app.models.category import Category
from app.models.experience import Experience
from app.models.group import Group
from app.models.user import User, UserRole
from app.schemas.experience import ExperienceOut
from app.scripts.init_data import DRAFT_CATEGORY_NAME, DRAFT_CATEGORY_SLUG
from app.services import cover_presets as cover_svc
from app.services import ordering as ordering_svc
from app.services import search as search_svc
from app.services import storage as storage_svc

router = APIRouter(prefix="/open", tags=["open-api"])


# ----------------------------- Schemas ----------------------------- #
class OpenCategoryOut(BaseModel):
    id: str
    name: str
    slug: str


class OpenMetaOut(BaseModel):
    categories: list[OpenCategoryOut]
    cover_presets: list[dict[str, str]]


class OpenStatsOut(BaseModel):
    """开放接口调用统计。"""
    total_calls: int
    today_calls: int


class OpenExperienceListOut(BaseModel):
    """经验分页列表。"""
    items: list[ExperienceOut]
    total: int
    page: int
    page_size: int
    has_more: bool


class OpenSearchItem(BaseModel):
    """搜索命中项。"""
    experience_id: str
    snippet: str
    score: float


class OpenSearchOut(BaseModel):
    """搜索结果。"""
    items: list[OpenSearchItem]
    query: str


# ----------------------------- 免令牌：统一归属站主 ----------------------------- #
def get_owner_user(db: Session = Depends(get_db)) -> User:
    """开放接口免令牌调用时，统一把内容归属到站主账号。"""
    owner = db.query(User).filter(User.role == UserRole.OWNER.value).first()
    if owner is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "未找到站主账号")
    return owner


# ----------------------------- 调用统计（站主 Cookie） ----------------------------- #
@router.get("/stats", response_model=OpenStatsOut)
def open_stats(
    user: Annotated[User, Depends(require_owner)],
    db: Session = Depends(get_db),
) -> OpenStatsOut:
    """返回开放接口累计调用次数与当日调用次数。"""
    total_calls = db.query(func.count(ApiCallLog.id)).scalar() or 0
    today_start = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_calls = (
        db.query(func.count(ApiCallLog.id))
        .filter(ApiCallLog.created_at >= today_start)
        .scalar()
        or 0
    )
    return OpenStatsOut(total_calls=total_calls, today_calls=today_calls)


# ----------------------------- 调用记录 ----------------------------- #
def _record_call(db: Session, user: User, endpoint: str, status_code: int) -> None:
    """写入一次开放接口调用记录（非关键路径，异常静默）。"""
    try:
        db.add(
            ApiCallLog(
                user_id=user.id,
                user_role=user.role,
                endpoint=endpoint,
                status_code=status_code,
            )
        )
        db.commit()
    except Exception:
        db.rollback()


# ----------------------------- 元数据（免令牌） ----------------------------- #
@router.get("/meta", response_model=OpenMetaOut)
def open_meta(
    user: Annotated[User, Depends(get_owner_user)],
    db: Session = Depends(get_db),
) -> OpenMetaOut:
    """返回可用分类与封面预设，供 AI 提交前枚举合法取值。无需令牌。"""
    _record_call(db, user, "/open/meta", 200)
    cats = db.query(Category).order_by(Category.order).all()
    return OpenMetaOut(
        categories=[OpenCategoryOut(id=c.id, name=c.name, slug=c.slug) for c in cats],
        cover_presets=cover_svc.list_presets(),
    )


# ----------------------------- 提交经验（免令牌） ----------------------------- #
def _slugify(name: str) -> str:
    # 仅保留 ASCII 字母数字，其余（含中文）替换为连字符；为空时回退为短 uuid。
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return (s or gen_uuid()[:8])[:60]


def _get_or_create_draft_category(db: Session) -> Category:
    """获取（或创建）草稿分类，作为未指定分类时的默认归属。"""
    cat = db.query(Category).filter(Category.slug == DRAFT_CATEGORY_SLUG).first()
    if cat is None:
        cat = Category(
            id=gen_uuid(),
            slug=DRAFT_CATEGORY_SLUG,
            name=DRAFT_CATEGORY_NAME,
            icon="📝",
            order=9000.0,
        )
        db.add(cat)
        db.flush()
    return cat


def _resolve_category(db: Session, category_id: str | None, category_name: str | None) -> Category:
    if category_id:
        cat = db.get(Category, category_id)
        if cat is not None:
            return cat
    if category_name and category_name.strip():
        cat = db.query(Category).filter(Category.name == category_name).first()
        if cat is None:
            base = _slugify(category_name)
            slug = base
            while db.query(Category).filter(Category.slug == slug).first():
                slug = f"{base}-{gen_uuid()[:4]}"
            order = float((db.query(func.max(Category.order)).scalar() or 0) + 1)
            cat = Category(id=gen_uuid(), slug=slug, name=category_name, order=order)
            db.add(cat)
            db.flush()
        return cat
    # 未指定任何分类：归入草稿
    return _get_or_create_draft_category(db)


def _resolve_group(db: Session, category_id: str, group_id: str | None, group_name: str | None) -> Group | None:
    if group_id:
        g = db.get(Group, group_id)
        return g if (g and g.category_id == category_id) else None
    if group_name:
        g = db.query(Group).filter(Group.category_id == category_id, Group.name == group_name).first()
        if g is None:
            g = Group(id=gen_uuid(), category_id=category_id, name=group_name, order=9000.0)
            db.add(g)
            db.flush()
        return g
    return None


@router.post("/experiences", response_model=ExperienceOut)
async def open_create_experience(
    user: Annotated[User, Depends(get_owner_user)],
    db: Session = Depends(get_db),
    title: str = Form(..., min_length=1, max_length=120),
    summary: str | None = Form(None, max_length=255),
    category_id: str | None = Form(None),
    category_name: str | None = Form(None),
    group_id: str | None = Form(None),
    group_name: str | None = Form(None),
    html: str | None = Form(None, description="经验正文 HTML（原始文本，AI 友好）"),
    html_file: UploadFile | None = File(None),
    cover_preset: str | None = Form(None),
    cover_file: UploadFile | None = File(None),
) -> ExperienceOut:
    """开放接口：提交一条经验（无需令牌，统一归属站主）。

    分类为非必传：未指定 category_id / category_name 时自动归入「草稿」。
    """
    category = _resolve_category(db, category_id, category_name)
    group = _resolve_group(db, category.id, group_id, group_name)

    exp_id = gen_uuid()

    # HTML：优先文件，其次原始文本
    if html_file is not None and (html_file.filename or "").strip():
        html_path, html_size = storage_svc.save_html_file(html_file, exp_id)
    elif html is not None and html.strip():
        html_path, html_size = storage_svc.save_html_text(html, exp_id)
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "html 或 html_file 至少提供一个")

    # 封面：优先文件，其次预设
    cover_path: str | None = None
    if cover_file is not None and (cover_file.filename or "").strip():
        cover_path = storage_svc.save_cover_file(cover_file, exp_id)
    elif cover_preset:
        try:
            cover_path = cover_svc.apply_preset_to_experience(cover_preset, exp_id)
        except ValueError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    exp = Experience(
        id=exp_id,
        category_id=category.id,
        group_id=group.id if group else None,
        title=title,
        summary=summary,
        cover_path=cover_path,
        html_path=html_path,
        html_size=html_size,
        order=ordering_svc.next_experience_order(db, category.id),
        owner_id=user.id,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)

    _record_call(db, user, "/open/experiences", 200)

    html_text = search_svc.extract_text_from_file(exp.html_path)
    search_svc.upsert_index(
        db,
        experience_id=exp.id,
        title=exp.title,
        summary=exp.summary,
        group_id=exp.group_id,
        html_text=html_text,
    )
    db.commit()
    settings = get_settings()
    cover_url = (
        f"{settings.app_root_path}/api/v1/experiences/{exp.id}/cover"
        if exp.cover_path
        else None
    )
    return ExperienceOut(
        id=exp.id,
        category_id=exp.category_id,
        group_id=exp.group_id,
        title=exp.title,
        summary=exp.summary,
        cover_url=cover_url,
        has_cover=bool(exp.cover_path),
        html_size=exp.html_size,
        order=exp.order,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


# ============================================================ #
# 读取类接口（免令牌，仅返回未删除的公开经验）
# ============================================================ #
def _exp_to_out(exp: Experience, settings) -> ExperienceOut:
    """ORM → 对外 schema，cover_url 指向免令牌的开放封面接口。"""
    return ExperienceOut(
        id=exp.id,
        category_id=exp.category_id,
        group_id=exp.group_id,
        title=exp.title,
        summary=exp.summary,
        cover_url=(
            f"{settings.app_root_path}/api/v1/open/experiences/{exp.id}/cover"
            if exp.cover_path
            else None
        ),
        has_cover=bool(exp.cover_path),
        html_size=exp.html_size,
        order=exp.order,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


@router.get("/experiences", response_model=OpenExperienceListOut)
def open_list_experiences(
    user: Annotated[User, Depends(get_owner_user)],
    db: Annotated[Session, Depends(get_db)],
    category_id: str | None = Query(None, description="按分类 ID 过滤；不传则返回全站经验"),
    page: int = Query(1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数，1–100"),
) -> OpenExperienceListOut:
    """分页读取经验列表（免令牌）。

    按发布时间倒序返回；每条含 id/title/summary/分类/封面地址等元数据，
    正文请用 `GET /open/experiences/{id}/html`。
    """
    _record_call(db, user, "/open/experiences(GET)", 200)
    filters = [Experience.deleted_at.is_(None)]
    if category_id:
        filters.append(Experience.category_id == category_id)
    total = db.scalar(select(func.count(Experience.id)).where(*filters)) or 0
    rows = db.execute(
        select(Experience)
        .where(*filters)
        .order_by(Experience.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    settings = get_settings()
    return OpenExperienceListOut(
        items=[_exp_to_out(e, settings) for e in rows],
        total=total,
        page=page,
        page_size=page_size,
        has_more=page * page_size < total,
    )


@router.get("/experiences/{exp_id}/html", response_class=Response)
def open_get_experience_html(
    exp_id: str,
    user: Annotated[User, Depends(get_owner_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """读取单条经验的正文 HTML（免令牌，text/html）。

    返回原始 HTML 字符串；若经验不存在或正文丢失返回 404。
    """
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None or not exp.html_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "经验不存在")
    content = storage_svc.read_file_bytes(exp.html_path)
    if content is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "正文文件丢失")
    _record_call(db, user, "/open/experiences/{id}/html", 200)
    return Response(
        content=content,
        media_type="text/html; charset=utf-8",
        headers={"X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"},
    )


@router.get("/experiences/{exp_id}/cover")
def open_get_experience_cover(
    exp_id: str,
    user: Annotated[User, Depends(get_owner_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """读取单条经验的封面图（免令牌）。供开放接口返回的 cover_url 直接使用。"""
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None or not exp.cover_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "封面不存在")
    content = storage_svc.read_file_bytes(exp.cover_path)
    if content is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "封面文件丢失")
    ext = exp.cover_path.rsplit(".", 1)[-1].lower()
    media = {
        "jpg": "image/jpeg", "png": "image/png",
        "webp": "image/webp", "svg": "image/svg+xml",
    }.get(ext, "application/octet-stream")
    _record_call(db, user, "/open/experiences/{id}/cover", 200)
    return Response(content=content, media_type=media)


@router.get("/experiences/{exp_id}", response_model=ExperienceOut)
def open_get_experience(
    exp_id: str,
    user: Annotated[User, Depends(get_owner_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ExperienceOut:
    """读取单条经验元数据（免令牌）。正文请用 `/html` 子接口。"""
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "经验不存在")
    _record_call(db, user, "/open/experiences/{id}", 200)
    return _exp_to_out(exp, get_settings())


@router.get("/search", response_model=OpenSearchOut)
def open_search(
    user: Annotated[User, Depends(get_owner_user)],
    db: Annotated[Session, Depends(get_db)],
    q: str = Query(..., min_length=1, max_length=100, description="搜索关键词"),
    mode: str = Query("content", pattern="^(meta|content)$", description="meta=仅元数据；content=含正文"),
    limit: int = Query(20, ge=1, le=100, description="返回条数"),
) -> OpenSearchOut:
    """全文搜索公开经验（免令牌）。

    `mode=meta` 只匹配标题/简介/分组；`mode=content`  additionally 匹配正文，
    返回带 `<mark>` 高亮的片段。
    """
    _record_call(db, user, "/open/search", 200)
    hits = search_svc.search(db, q, mode=mode, limit=limit)
    return OpenSearchOut(
        items=[OpenSearchItem(**h) for h in hits],
        query=q,
    )
