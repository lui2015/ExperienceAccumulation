"""预设封面图：白名单管理。

预设 SVG 文件位于 ``backend/app/assets/cover_presets/{key}.svg``。
为防止 SSRF / 路径穿越，所有访问只通过 ``PRESETS`` 字典中的白名单 key。
"""
from __future__ import annotations

import shutil
from pathlib import Path

from app.core.config import get_settings

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets" / "cover_presets"


# (key, label, theme_color) — key 必须与 SVG 文件名（不含扩展名）一致
PRESETS: dict[str, dict[str, str]] = {
    "neon-grid": {"label": "霓虹网格", "color": "#ff2ec3"},
    "circuit": {"label": "电路矩阵", "color": "#00e5ff"},
    "wave": {"label": "光波流转", "color": "#7c5cff"},
    "matrix": {"label": "数据洪流", "color": "#c5ff00"},
    "glitch": {"label": "故障信号", "color": "#ff2ec3"},
    "skyline": {"label": "赛博都市", "color": "#fde047"},
}


def list_presets() -> list[dict[str, str]]:
    """列出可用预设，包含相对的预览 URL。"""
    settings = get_settings()
    items: list[dict[str, str]] = []
    for key, meta in PRESETS.items():
        if not (ASSETS_DIR / f"{key}.svg").is_file():
            continue
        items.append(
            {
                "key": key,
                "label": meta["label"],
                "color": meta["color"],
                "url": f"{settings.app_root_path}/api/v1/cover-presets/{key}",
            }
        )
    return items


def preset_path(key: str) -> Path | None:
    """获取预设文件的绝对路径；key 不在白名单返回 None。"""
    if key not in PRESETS:
        return None
    p = ASSETS_DIR / f"{key}.svg"
    if not p.is_file():
        return None
    # 二次校验：解析后必须仍位于 ASSETS_DIR 下，防止符号链接逃逸
    try:
        p.resolve().relative_to(ASSETS_DIR.resolve())
    except ValueError:
        return None
    return p


def apply_preset_to_experience(key: str, experience_id: str) -> str:
    """将预设 SVG 复制为该经验的封面，返回相对路径。

    复制而非软链：保证后续删除/备份逻辑统一。
    """
    src = preset_path(key)
    if src is None:
        raise ValueError(f"未知封面预设：{key}")

    settings = get_settings()
    rel_path = f"covers/{experience_id}.svg"
    dst = settings.storage_dir / rel_path
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return rel_path
