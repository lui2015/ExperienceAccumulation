"""轻量 schema 升级（SQLite）：建 groups 表 + experiences.group_id 列。

幂等：可重复执行；启动时由 init_data 调用。
"""
from sqlalchemy import inspect, text

from app.db.session import Base, engine
from app.models import Group  # noqa: F401  注册到 metadata


def migrate() -> None:
    inspector = inspect(engine)

    # 1) 建 groups 表（已存在则跳过）
    if "groups" not in inspector.get_table_names():
        Group.__table__.create(bind=engine, checkfirst=True)
        print("[migrate] 已创建表 groups")

    # 2) experiences 加 group_id 列（SQLite 用 ALTER TABLE ADD COLUMN）
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
        # 索引
        existing_idx = {i["name"] for i in inspector.get_indexes("experiences")}
        if "ix_experiences_group_id" not in existing_idx:
            conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_experiences_group_id ON experiences(group_id)")
            )

    # 3) 兜底：确保所有 metadata 中的表都已建（含新模型）
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    migrate()
    print("[migrate] 完成。")
