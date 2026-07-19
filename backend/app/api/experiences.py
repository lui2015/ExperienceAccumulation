"""经验文档管理路由。"""
import io
import zipfile
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user, require_owner
from app.core.security import create_html_token, create_share_token
from app.db.session import get_db
from app.models._helpers import gen_uuid, utcnow
from app.models.category import Category
from app.models.experience import Experience
from app.models.group import Group
from app.models.user import User
from app.schemas.experience import ExperienceOut, HtmlTokenOut, MoveItem
from app.services import storage as storage_svc
from app.services import search as search_svc
from app.services import cover_presets as preset_svc
from app.services.ordering import next_experience_order

router = APIRouter(prefix="/experiences", tags=["experiences"])


def _to_out(exp: Experience, settings) -> ExperienceOut:
    cover_url = None
    if exp.cover_path:
        cover_url = f"{settings.app_root_path}/api/v1/experiences/{exp.id}/cover"
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


def _check_group(db: Session, group_id: str | None, category_id: str) -> None:
    """校验分组存在且属于该分类。"""
    if group_id is None:
        return
    g = db.get(Group, group_id)
    if not g:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分组不存在")
    if g.category_id != category_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "分组不属于该分类")


@router.get("", response_model=list[ExperienceOut])
def list_experiences(
    category_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[ExperienceOut]:
    settings = get_settings()
    if not db.get(Category, category_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分类不存在")
    stmt = (
        select(Experience)
        .where(Experience.category_id == category_id, Experience.deleted_at.is_(None))
        .order_by(Experience.order.asc())
    )
    return [_to_out(e, settings) for e in db.execute(stmt).scalars().all()]


@router.post("", response_model=ExperienceOut, status_code=status.HTTP_201_CREATED)
def create_experience(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_owner)],
    title: Annotated[str, Form(min_length=1, max_length=120)],
    category_id: Annotated[str, Form()],
    html_file: Annotated[UploadFile, File()],
    summary: Annotated[str | None, Form(max_length=255)] = None,
    group_id: Annotated[str | None, Form()] = None,
    cover_file: Annotated[UploadFile | None, File()] = None,
    cover_preset: Annotated[str | None, Form(max_length=64)] = None,
) -> ExperienceOut:
    settings = get_settings()
    if not db.get(Category, category_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "分类不存在")
    # 表单空字符串当作 None
    group_id = group_id or None
    _check_group(db, group_id, category_id)

    exp_id = gen_uuid()
    html_path, html_size = storage_svc.save_html_file(html_file, exp_id)

    # 封面：上传文件优先；否则使用预设；都没有则空
    cover_path: str | None = None
    if cover_file is not None:
        cover_path = storage_svc.save_cover_file(cover_file, exp_id)
    elif cover_preset:
        try:
            cover_path = preset_svc.apply_preset_to_experience(cover_preset, exp_id)
        except ValueError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from None

    exp = Experience(
        id=exp_id,
        category_id=category_id,
        group_id=group_id,
        title=title.strip(),
        summary=(summary or None),
        cover_path=cover_path,
        html_path=html_path,
        html_size=html_size,
        order=next_experience_order(db, category_id),
        owner_id=user.id,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)

    # 建索引
    html_text = search_svc.extract_text_from_file(html_path)
    search_svc.upsert_index(
        db,
        experience_id=exp.id,
        title=exp.title,
        summary=exp.summary,
        group_id=exp.group_id,
        html_text=html_text,
    )
    db.commit()
    return _to_out(exp, settings)


@router.put("/{exp_id}", response_model=ExperienceOut)
def update_experience(
    exp_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_owner)],
    title: Annotated[str | None, Form(max_length=120)] = None,
    summary: Annotated[str | None, Form(max_length=255)] = None,
    category_id: Annotated[str | None, Form()] = None,
    group_id: Annotated[str | None, Form()] = None,
    # 显式标记是否清空分组（前端传 "1" 表示清空）
    clear_group: Annotated[str | None, Form()] = None,
    html_file: Annotated[UploadFile | None, File()] = None,
    cover_file: Annotated[UploadFile | None, File()] = None,
    cover_preset: Annotated[str | None, Form(max_length=64)] = None,
) -> ExperienceOut:
    settings = get_settings()
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "经验不存在")

    if title is not None:
        exp.title = title.strip()
    if summary is not None:
        exp.summary = summary or None

    target_category = exp.category_id
    if category_id is not None and category_id != exp.category_id:
        if not db.get(Category, category_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "目标分类不存在")
        target_category = category_id
        exp.category_id = category_id
        exp.order = next_experience_order(db, category_id)
        # 跨分类时清空原分组（避免分组与分类不一致）
        exp.group_id = None

    # 处理分组：clear_group=1 表示清空；否则按 group_id 字段
    if clear_group == "1":
        exp.group_id = None
    elif group_id is not None and group_id != "":
        _check_group(db, group_id, target_category)
        exp.group_id = group_id

    if html_file is not None:
        new_path, new_size = storage_svc.save_html_file(html_file, exp.id)
        exp.html_path = new_path
        exp.html_size = new_size
    if cover_file is not None:
        # 上传文件优先：替换任何已有封面（含旧预设）
        storage_svc.remove_cover_with_any_ext(exp.id)
        exp.cover_path = storage_svc.save_cover_file(cover_file, exp.id)
    elif cover_preset:
        # 仅当没有上传文件时，应用预设
        storage_svc.remove_cover_with_any_ext(exp.id)
        try:
            exp.cover_path = preset_svc.apply_preset_to_experience(cover_preset, exp.id)
        except ValueError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from None

    db.commit()
    db.refresh(exp)

    # 同步索引（标题/简介/分组/HTML 任何变化都重建该条索引）
    html_text = search_svc.extract_text_from_file(exp.html_path) if exp.html_path else ""
    search_svc.upsert_index(
        db,
        experience_id=exp.id,
        title=exp.title,
        summary=exp.summary,
        group_id=exp.group_id,
        html_text=html_text,
    )
    db.commit()
    return _to_out(exp, settings)


@router.delete("/{exp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_experience(
    exp_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> None:
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "经验不存在")
    exp.deleted_at = utcnow()
    db.commit()


@router.post("/{exp_id}/restore", response_model=ExperienceOut)
def restore_experience(
    exp_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> ExperienceOut:
    settings = get_settings()
    exp = db.get(Experience, exp_id)
    if not exp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "经验不存在")
    exp.deleted_at = None
    db.commit()
    db.refresh(exp)
    return _to_out(exp, settings)


class MovePayload(BaseModel):
    items: list[MoveItem]


@router.patch("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_experiences(
    payload: MovePayload,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> None:
    """支持跨组拖拽：可更新 group_id + order。"""
    ids = [it.id for it in payload.items]
    rows = db.query(Experience).filter(Experience.id.in_(ids)).all()
    by_id = {e.id: e for e in rows}
    changed_group: list[Experience] = []
    for it in payload.items:
        e = by_id.get(it.id)
        if not e:
            continue
        if it.group_id is not None:
            _check_group(db, it.group_id, e.category_id)
            if e.group_id != it.group_id:
                e.group_id = it.group_id
                changed_group.append(e)
        e.order = it.order
    db.commit()

    # 分组变更 → 重建索引（group_name 列要更新）
    for e in changed_group:
        html_text = search_svc.extract_text_from_file(e.html_path) if e.html_path else ""
        search_svc.upsert_index(
            db,
            experience_id=e.id,
            title=e.title,
            summary=e.summary,
            group_id=e.group_id,
            html_text=html_text,
        )
    if changed_group:
        db.commit()


@router.get("/{exp_id}/html-token", response_model=HtmlTokenOut)
def issue_html_token(
    exp_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> HtmlTokenOut:
    settings = get_settings()
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "经验不存在")
    token = create_html_token(exp.id, user_id=user.id)
    url = f"{settings.html_view_base_url.rstrip('/')}/files/html/{token}"
    return HtmlTokenOut(token=token, url=url, expires_in=settings.html_token_expire_minutes * 60)


@router.get("/{exp_id}/share-token", response_model=HtmlTokenOut)
def issue_share_token(
    exp_id: str,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> HtmlTokenOut:
    """签发长期公开分享 Token（仅站主可签发）。
    返回的 URL 任何人持有都可直接访问对应 HTML 详情，无需登录。
    """
    settings = get_settings()
    exp = db.get(Experience, exp_id)
    if not exp or exp.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "经验不存在")
    ttl_days = 365
    token = create_share_token(exp.id, ttl_days=ttl_days)
    url = f"{settings.html_view_base_url.rstrip('/')}/files/html/{token}"
    return HtmlTokenOut(token=token, url=url, expires_in=ttl_days * 86400)


@router.get("/batch-download", include_in_schema=True)
def batch_download_html(
    ids: Annotated[list[str], Query()],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_owner)],
) -> StreamingResponse:
    """批量下载 HTML 文件（仅站主），将选中的经验 HTML 打包为 ZIP 返回。"""
    if not ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "请选择至少一个经验")

    stmt = select(Experience).where(
        Experience.id.in_(ids),
        Experience.deleted_at.is_(None),
    )
    exps = db.execute(stmt).scalars().all()

    if not exps:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "未找到有效的经验")

    # 按标题排序，文件名使用标题（去除不安全字符）
    exps = sorted(exps, key=lambda e: e.title)

    buf = io.BytesIO()
    seen_names: dict[str, int] = {}
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for exp in exps:
            abs_path = storage_svc.storage_path(exp.html_path)
            if not abs_path.is_file():
                continue

            # 安全文件名：去除路径分隔符等危险字符，保留中文
            safe_title = "".join(c for c in exp.title if c not in r'\/:*?"<>|')
            safe_title = safe_title.strip() or exp.id
            base = safe_title
            if base in seen_names:
                seen_names[base] += 1
                arcname = f"{base} ({seen_names[base]}).html"
            else:
                seen_names[base] = 0
                arcname = f"{base}.html"

            zf.write(abs_path, arcname)

    if seen_names:
        # 有文件写入
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="experiences-html.zip"'},
        )
    else:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "所选经验暂无有效 HTML 文件")
