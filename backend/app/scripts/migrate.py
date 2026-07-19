"""轻量 schema 升级（SQLite）：
- 建 groups 表 + experiences.group_id
- 建 experiences_fts (FTS5) 与 experiences_fts_map（id ↔ rowid 映射）
- 回填已有经验到 FTS 索引（首次启用时）

幂等：可重复执行；启动时由 init_data 调用。
"""
from sqlalchemy import inspect, select, text

from app.db.session import Base, SessionLocal, engine
from app.models import Group  # noqa: F401  注册到 metadata
from app.models.experience import Experience
from app.services.search import (
    delete_index,
    extract_text_from_file,
    init_fts,
    upsert_index,
)


def _ensure_groups_and_group_id() -> None:
    inspector = inspect(engine)
    if "groups" not in inspector.get_table_names():
        Group.__table__.create(bind=engine, checkfirst=True)
        print("[migrate] 已创建表 groups")

    cols = {c["name"] for c in inspector.get_columns("experiences")}
    with engine.begin() as conn:
        if "group_id" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE experiences ADD COLUMN group_id VARCHAR(32) "
                    "REFERENCES groups(id)"
                )
            )
            print("[migrate] 已为 experiences 添加列 group_id")
        existing_idx = {i["name"] for i in inspector.get_indexes("experiences")}
        if "ix_experiences_group_id" not in existing_idx:
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_experiences_group_id ON experiences(group_id)")
            )


def _ensure_fts() -> None:
    """建 FTS5 表 + 映射表；分词器变更时自动重建索引。"""
    inspector = inspect(engine)
    fts_existed = "experiences_fts" in inspector.get_table_names()
    map_existed = "experiences_fts_map" in inspector.get_table_names()

    # 0) 检查现有 FTS 表的分词器是否仍是当前期望（trigram）；不一致则重建
    needs_rebuild = False
    if fts_existed:
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name='experiences_fts'"
                )
            ).first()
            create_sql = row[0] if row else ""
            if "trigram" not in (create_sql or ""):
                print("[migrate] 检测到 FTS 分词器变更（→ trigram），重建 experiences_fts")
                conn.execute(text("DROP TABLE experiences_fts"))
                fts_existed = False
                needs_rebuild = True

    # 1) 映射表
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS experiences_fts_map (
                    fts_rowid    INTEGER PRIMARY KEY AUTOINCREMENT,
                    experience_id VARCHAR(32) UNIQUE NOT NULL
                )
                """
            )
        )

    # 2) FTS 表
    init_fts(engine)

    if not (fts_existed and map_existed) or needs_rebuild:
        # 首次建立 / 分词器变更 → 回填
        # 重建时先清空映射表（rowid 与新表对不上）
        if needs_rebuild:
            with engine.begin() as conn:
                conn.execute(text("DELETE FROM experiences_fts_map"))
        print("[migrate] FTS 索引首次建立或重建，开始回填…")
        with SessionLocal() as db:
            count = 0
            for exp in db.execute(
                select(Experience).where(Experience.deleted_at.is_(None))
            ).scalars():
                html_text = extract_text_from_file(exp.html_path) if exp.html_path else ""
                upsert_index(
                    db,
                    experience_id=exp.id,
                    title=exp.title,
                    summary=exp.summary,
                    group_id=exp.group_id,
                    html_text=html_text,
                )
                count += 1
            db.commit()
            print(f"[migrate] FTS 回填完成，共 {count} 条")


def _ensure_api_token_hash() -> None:
    """为 users 表补加 api_token_hash 列（开放接口令牌）。"""
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("users")}
    if "api_token_hash" not in cols:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN api_token_hash VARCHAR(128)")
            )
            print("[migrate] 已为 users 添加列 api_token_hash")


def migrate() -> None:
    _ensure_groups_and_group_id()
    _ensure_fts()
    _ensure_api_token_hash()
    Base.metadata.create_all(bind=engine)


# 暴露给 search/experiences 接口使用
__all__ = ["migrate", "delete_index", "upsert_index", "extract_text_from_file"]


if __name__ == "__main__":
    migrate()
    print("[migrate] 完成。")
