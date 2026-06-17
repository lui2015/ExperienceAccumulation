"""全站搜索路由。"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.experience import Experience
from app.models.group import Group
from app.models.user import User
from app.services import search as search_svc

router = APIRouter(prefix="/search", tags=["search"])


class SearchHit(BaseModel):
    experience_id: str
    title: str
    summary: str | None
    snippet: str  # 含 <mark> 高亮
    score: float
    category_id: str
    category_slug: str
    category_name: str
    group_id: str | None
    group_name: str | None


class SearchResponse(BaseModel):
    query: str
    mode: str
    total: int
    hits: list[SearchHit]


@router.get("", response_model=SearchResponse)
def search(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
    q: Annotated[str, Query(min_length=1, max_length=80)],
    mode: Annotated[Literal["meta", "content"], Query()] = "meta",
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> SearchResponse:
    raw_hits = search_svc.search(db, q, mode=mode, limit=limit)
    if not raw_hits:
        return SearchResponse(query=q, mode=mode, total=0, hits=[])

    ids = [h["experience_id"] for h in raw_hits]
    exps = {
        e.id: e
        for e in db.query(Experience).filter(Experience.id.in_(ids)).all()
    }
    cat_ids = {e.category_id for e in exps.values() if e}
    grp_ids = {e.group_id for e in exps.values() if e and e.group_id}
    cats = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()}
    grps = {g.id: g for g in db.query(Group).filter(Group.id.in_(grp_ids)).all()}

    out: list[SearchHit] = []
    for h in raw_hits:
        e = exps.get(h["experience_id"])
        if not e:
            continue
        c = cats.get(e.category_id)
        g = grps.get(e.group_id) if e.group_id else None
        out.append(
            SearchHit(
                experience_id=e.id,
                title=e.title,
                summary=e.summary,
                snippet=h["snippet"] or "",
                score=h["score"],
                category_id=e.category_id,
                category_slug=c.slug if c else "",
                category_name=c.name if c else "",
                group_id=e.group_id,
                group_name=g.name if g else None,
            )
        )

    return SearchResponse(query=q, mode=mode, total=len(out), hits=out)
