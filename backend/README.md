# Experience Accumulation - Backend

FastAPI + SQLite + 本地文件系统。

## 启动

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 修改 SECRET_KEY 与 OWNER_PASSWORD
uvicorn app.main:app --reload --port 8000
```

首次启动会自动：
1. 创建 `data/`、`storage/{html,covers}`、`backups/` 目录
2. 建表（`users` / `categories` / `experiences` / `audit_logs`）
3. 初始化站主账号（`OWNER_USERNAME` / `OWNER_PASSWORD`）
4. 种子三个分类：互联网项目管理 / 金融投资 / 思维认知

API 文档：<http://localhost:8000/docs>。

## 测试登录

```bash
# 登录（生成 Cookie）
curl -i -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"please_change_me"}' \
  -c cookies.txt

# 查看当前用户
curl http://localhost:8000/api/v1/auth/me -b cookies.txt

# 列分类
curl http://localhost:8000/api/v1/categories -b cookies.txt
```

## 备份

```bash
python -m app.scripts.backup
```

## 安全要点

- 上传 HTML 三重校验：扩展名 + bs4 解析 + < 开头
- 文件名重写为 `{uuid}.html`，杜绝路径穿越
- HTML 仅通过 5 分钟有效的 Token 在沙箱子域返回
- 主站 Cookie：HttpOnly + SameSite + (生产) Secure
- 写接口全部 `require_owner`
