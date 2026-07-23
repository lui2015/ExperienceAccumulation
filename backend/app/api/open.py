"""开放接口：站主生成 API 令牌，供 AI 代理直接提交经验。

设计要点：
- 令牌以 Bearer 形式传递，后端只保存其 SHA-256 哈希。
- /open/token（生成/吊销/状态）走站主 Cookie 登录。
- /open/meta、/open/experiences 走 Bearer 令牌，便于 AI 代理从任意环境调用。
- 提交时 html 既支持原始文本字段（AI 友好），也兼容文件上传。
"""
from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Response, status, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_owner
from app.core.security import (
    generate_open_token,
    hash_open_token,
    verify_open_token,
)
from app.db.session import get_db
from app.models._helpers import gen_uuid, utcnow
from app.models.api_call_log import ApiCallLog
from app.models.category import Category
from app.models.experience import Experience
from app.models.group import Group
from app.models.user import User
from app.schemas.experience import ExperienceOut
from app.scripts.init_data import DRAFT_CATEGORY_NAME, DRAFT_CATEGORY_SLUG
from app.services import cover_presets as cover_svc
from app.services import ordering as ordering_svc
from app.services import search as search_svc
from app.services import storage as storage_svc

router = APIRouter(prefix="/open", tags=["open-api"])


# ----------------------------- Schemas ----------------------------- #
class OpenTokenOut(BaseModel):
    token: str
    note: str


class OpenTokenStatus(BaseModel):
    exists: bool


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


# ----------------------------- Bearer 鉴权 ----------------------------- #
def get_user_by_open_token(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "缺少 Bearer 令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "令牌为空")
    user = db.query(User).filter(User.api_token_hash == hash_open_token(token)).first()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "令牌无效")
    return user


# ----------------------------- 令牌管理（站主 Cookie） ----------------------------- #
@router.post("/token", response_model=OpenTokenOut)
def create_open_token(
    user: Annotated[User, Depends(require_owner)],
    db: Session = Depends(get_db),
) -> OpenTokenOut:
    """生成（或重置）当前站主的开放接口令牌，明文仅返回一次。"""
    plain = generate_open_token()
    user.api_token_hash = hash_open_token(plain)
    db.commit()
    return OpenTokenOut(token=plain, note="请妥善保存，仅显示这一次")


@router.delete("/token", status_code=status.HTTP_204_NO_CONTENT)
def revoke_open_token(
    user: Annotated[User, Depends(require_owner)],
    db: Session = Depends(get_db),
) -> Response:
    """吊销开放接口令牌。"""
    user.api_token_hash = None
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/token/status", response_model=OpenTokenStatus)
def open_token_status(
    user: Annotated[User, Depends(require_owner)],
) -> OpenTokenStatus:
    """查询是否已存在令牌（不返回明文）。"""
    return OpenTokenStatus(exists=bool(user.api_token_hash))


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


# ----------------------------- 元数据（Bearer） ----------------------------- #
@router.get("/meta", response_model=OpenMetaOut)
def open_meta(
    user: Annotated[User, Depends(get_user_by_open_token)],
    db: Session = Depends(get_db),
) -> OpenMetaOut:
    """返回可用分类与封面预设，供 AI 提交前枚举合法取值。"""
    _record_call(db, user, "/open/meta", 200)
    cats = db.query(Category).order_by(Category.order).all()
    return OpenMetaOut(
        categories=[OpenCategoryOut(id=c.id, name=c.name, slug=c.slug) for c in cats],
        cover_presets=cover_svc.list_presets(),
    )


# ----------------------------- 提交经验（Bearer） ----------------------------- #
def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", name.strip().lower()).strip("-")
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
    user: Annotated[User, Depends(get_user_by_open_token)],
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
    """开放接口：提交一条经验（归属令牌对应的站主）。

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
    return ExperienceOut.from_attributes(exp)
