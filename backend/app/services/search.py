"""全文检索：基于 SQLite FTS5。

设计：
- 用 FTS5 外部内容（external content）模式，索引随 experiences 表变化自动同步（通过显式 upsert/delete）。
- 索引列：title / summary / group_name / html_text。
- HTML 入库时通过 bs4 提取纯文本（去脚本/样式/标签，保留可见文本）。
- 默认按 BM25 排序。
"""
from __future__ import annotations

from pathlib import Path

from bs4 import BeautifulSoup
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.experience import Experience
from app.models.group import Group


# ============================================================
# 1. Schema 初始化（迁移用）
# ============================================================

FTS_SCHEMA = """
CREATE VIRTUAL TABLE IF NOT EXISTS experiences_fts USING fts5(
    title,
    summary,
    group_name,
    html_text,
    tokenize = 'trigram'
);
"""


def init_fts(engine: Engine) -> None:
    """建 FTS5 表（幂等）。"""
    with engine.begin() as conn:
        conn.execute(text(FTS_SCHEMA))


# ============================================================
# 2. HTML 文本抽取
# ============================================================


def extract_text_from_html(content: bytes | str, max_chars: int = 200_000) -> str:
    """从 HTML 字节/字符串中提取可见正文（去标签/脚本/样式/注释）。"""
    if isinstance(content, bytes):
        # bs4 自己探测编码
        soup = BeautifulSoup(content, "html.parser")
    else:
        soup = BeautifulSoup(content, "html.parser")
    # 去掉脚本/样式/隐藏内容
    for tag in soup(["script", "style", "noscript", "template"]):
        tag.decompose()
    # 取整段文本，块级标签之间用换行分隔
    text_parts = list(soup.stripped_strings)
    raw = " ".join(text_parts)
    if len(raw) > max_chars:
        raw = raw[:max_chars]
    return raw


def extract_text_from_file(rel_path: str, max_chars: int = 200_000) -> str:
    """从 storage 中的 HTML 文件读取并提取正文，找不到时返回空串。"""
    settings = get_settings()
    abs_path: Path = settings.storage_dir / rel_path
    if not abs_path.is_file():
        return ""
    try:
        return extract_text_from_html(abs_path.read_bytes(), max_chars=max_chars)
    except Exception:
        return ""


# ============================================================
# 3. FTS 索引维护
# ============================================================


def _group_name(db: Session, group_id: str | None) -> str:
    if not group_id:
        return ""
    g = db.get(Group, group_id)
    return g.name if g else ""


def upsert_index(
    db: Session,
    *,
    experience_id: str,
    title: str,
    summary: str | None,
    group_id: str | None,
    html_text: str,
) -> None:
    """写/覆盖单条经验的索引（external content 模式：以 experience.id 作为 rowid 不便，因此
    我们用一个映射表 + 在 FTS 上用 docid=hash 不可控，所以这里改用最简单办法：
    每次 upsert 先按 title==? AND group_name==?... 不可靠。
    采用方案：维护一个 experiences_fts_map(experience_id TEXT PRIMARY KEY, fts_rowid INTEGER) 表。
    """
    # 取或创建映射 rowid
    row = db.execute(
        text(
            "INSERT INTO experiences_fts_map(experience_id) VALUES (:eid) "
            "ON CONFLICT(experience_id) DO NOTHING RETURNING fts_rowid"
        ),
        {"eid": experience_id},
    ).first()
    if row:
        fts_rowid = row[0]
    else:
        fts_rowid = db.execute(
            text("SELECT fts_rowid FROM experiences_fts_map WHERE experience_id=:eid"),
            {"eid": experience_id},
        ).scalar_one()

    group_name = _group_name(db, group_id)

    # 先删旧索引行（FTS5 contentless/外部表通用做法），再插入
    db.execute(text("DELETE FROM experiences_fts WHERE rowid=:rid"), {"rid": fts_rowid})
    db.execute(
        text(
            "INSERT INTO experiences_fts(rowid, title, summary, group_name, html_text) "
            "VALUES (:rid, :t, :s, :g, :h)"
        ),
        {
            "rid": fts_rowid,
            "t": title or "",
            "s": summary or "",
            "g": group_name,
            "h": html_text or "",
        },
    )


def delete_index(db: Session, experience_id: str) -> None:
    row = db.execute(
        text("SELECT fts_rowid FROM experiences_fts_map WHERE experience_id=:eid"),
        {"eid": experience_id},
    ).first()
    if not row:
        return
    fts_rowid = row[0]
    db.execute(text("DELETE FROM experiences_fts WHERE rowid=:rid"), {"rid": fts_rowid})
    db.execute(
        text("DELETE FROM experiences_fts_map WHERE experience_id=:eid"),
        {"eid": experience_id},
    )


# ============================================================
# 4. 检索
# ============================================================


def _build_match_query(q: str, *, columns: list[str] | None = None) -> str:
    """转成 FTS5 MATCH 表达式。

    使用 trigram tokenizer 时（FTS5 内置，要求 SQLite >= 3.34），
    对任意子串（含中文）都做 3-gram 全文索引；查询时把空白拆开的每段
    作为短语 + 前缀通配 `"xxx"*`，多段用 AND 连接。
    """
    tokens = [t for t in q.strip().split() if t]
    if not tokens:
        return ""
    parts: list[str] = []
    for t in tokens:
        safe = t.replace('"', '""')
        # trigram 要求 phrase 至少 3 字符；< 3 时仍可匹配（FTS5 内部用 LIKE-bypass）
        parts.append(f'"{safe}"*')
    body = " AND ".join(parts)
    if columns:
        col_list = " ".join(columns)
        return "{" + col_list + "} : (" + body + ")"
    return body


def search(
    db: Session,
    q: str,
    *,
    mode: str = "meta",
    limit: int = 50,
) -> list[dict]:
    """搜索接口。

    mode=meta    → 仅匹配 title / summary / group_name
    mode=content → 匹配全列（标题等元数据也参与，bm25 自动加权）

    实现：
    - 查询长度 ≥ 3 字符 → 走 FTS5 trigram MATCH（高效，自带 snippet）
    - 查询长度 < 3 字符 → 走 LIKE 兜底（trigram 索引最小要求是 3 字符）
    """
    q = q.strip()
    if not q:
        return []

    if len(q) < 3:
        return _search_like(db, q, mode=mode, limit=limit)

    if mode == "content":
        expr = _build_match_query(q)
    else:
        expr = _build_match_query(q, columns=["title", "summary", "group_name"])
    if not expr:
        return []

    sql = text(
        """
        SELECT
            m.experience_id,
            snippet(experiences_fts, -1, '<mark>', '</mark>', ' … ', 12) AS snip,
            bm25(experiences_fts) AS score
        FROM experiences_fts
        JOIN experiences_fts_map m ON m.fts_rowid = experiences_fts.rowid
        WHERE experiences_fts MATCH :q
        ORDER BY score
        LIMIT :lim
        """
    )
    try:
        rows = db.execute(sql, {"q": expr, "lim": limit}).fetchall()
    except Exception:
        # 极端情况下表达式仍非法（如全是标点），降级为 LIKE
        return _search_like(db, q, mode=mode, limit=limit)
    if not rows:
        return []

    ids = [r[0] for r in rows]
    alive_ids = {
        e.id
        for e in db.query(Experience).filter(
            Experience.id.in_(ids), Experience.deleted_at.is_(None)
        )
    }
    return [
        {"experience_id": r[0], "snippet": r[1], "score": r[2]}
        for r in rows
        if r[0] in alive_ids
    ]


def _highlight(haystack: str, needle: str) -> str:
    """简单的高亮：在 haystack 内找 needle，命中前后取 ~12 字符上下文，包裹 <mark>。"""
    if not haystack:
        return ""
    idx = haystack.lower().find(needle.lower())
    if idx < 0:
        return haystack[:60]
    start = max(0, idx - 12)
    end = min(len(haystack), idx + len(needle) + 24)
    prefix = "… " if start > 0 else ""
    suffix = " …" if end < len(haystack) else ""
    seg = haystack[start:end]
    pos = seg.lower().find(needle.lower())
    if pos < 0:
        return prefix + seg + suffix
    highlighted = (
        seg[:pos]
        + "<mark>"
        + seg[pos:pos + len(needle)]
        + "</mark>"
        + seg[pos + len(needle):]
    )
    return prefix + highlighted + suffix


def _search_like(db: Session, q: str, *, mode: str, limit: int) -> list[dict]:
    """LIKE 兜底搜索（用于短查询）。"""
    pattern = f"%{q}%"
    if mode == "content":
        # 短查询通常是元数据搜索，正文 LIKE 太慢且无意义；只搜元数据
        sql = text(
            """
            SELECT m.experience_id,
                   f.title, f.summary, f.group_name
            FROM experiences_fts f
            JOIN experiences_fts_map m ON m.fts_rowid = f.rowid
            WHERE f.title LIKE :p OR f.summary LIKE :p OR f.group_name LIKE :p
                  OR f.html_text LIKE :p
            LIMIT :lim
            """
        )
    else:
        sql = text(
            """
            SELECT m.experience_id,
                   f.title, f.summary, f.group_name
            FROM experiences_fts f
            JOIN experiences_fts_map m ON m.fts_rowid = f.rowid
            WHERE f.title LIKE :p OR f.summary LIKE :p OR f.group_name LIKE :p
            LIMIT :lim
            """
        )
    rows = db.execute(sql, {"p": pattern, "lim": limit}).fetchall()
    if not rows:
        return []
    ids = [r[0] for r in rows]
    alive_ids = {
        e.id
        for e in db.query(Experience).filter(
            Experience.id.in_(ids), Experience.deleted_at.is_(None)
        )
    }
    out: list[dict] = []
    for r in rows:
        if r[0] not in alive_ids:
            continue
        # 取第一处命中作为 snippet
        haystack = next(
            (s for s in (r[1], r[2], r[3]) if s and q.lower() in s.lower()),
            r[1] or r[2] or r[3] or "",
        )
        out.append(
            {"experience_id": r[0], "snippet": _highlight(haystack, q), "score": 0.0}
        )
    return out
