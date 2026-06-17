# Experience Accumulation 经验沉淀网站

个人经验沉淀网站，按主题领域分类管理 HTML 经验文档。

> 部署地址：<https://www.luliming.xyz/experience>  
> HTML 沙箱域：<https://view.luliming.xyz>（必须独立二级域名）

## 功能概览

- 顶部 Tab 导航（互联网项目管理 / 金融投资 / 思维认知，可扩展）
- HTML 经验文档卡片列表（新增、编辑、删除、拖拽排序）
- 上传 HTML 文档（≤ 20MB），云端存储
- 站主 + 受邀访客双角色（访客只读）
- 分类管理（新增/编辑/删除/排序）
- 访客管理（创建/禁用/重置密码）
- 自动每日备份

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 + Vite + TypeScript + Ant Design 5 + dnd-kit + TanStack Query + Zustand |
| 后端 | Python 3.11 + FastAPI + SQLAlchemy 2.0 + Alembic |
| 数据库 | SQLite |
| 认证 | JWT + HttpOnly Cookie |
| Web 服务器 | Nginx |
| 部署 | 腾讯云轻量应用服务器 (Ubuntu 22.04) |

## 仓库结构

```
Experience_Accumulation/
├── PRD.md                    # 产品需求文档
├── README.md                 # 本文件
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── api/              # 路由
│   │   ├── core/             # 配置、安全、依赖
│   │   ├── db/               # 数据库会话
│   │   ├── models/           # SQLAlchemy 模型
│   │   ├── schemas/          # Pydantic 校验
│   │   ├── services/         # 业务逻辑
│   │   └── main.py           # 入口
│   ├── alembic/              # 数据库迁移
│   ├── scripts/              # 备份/初始化脚本
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── api/              # 接口封装
│   │   ├── components/       # 通用组件
│   │   ├── pages/            # 页面
│   │   ├── store/            # Zustand
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── deploy/                   # 部署相关
    ├── nginx/
    │   ├── app.conf          # 主站 Nginx 配置
    │   └── view.conf         # HTML 沙箱域配置
    ├── systemd/
    │   └── experience-api.service
    └── DEPLOY.md             # 部署手册
```

## 开发快速开始

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 修改 .env 中的 SECRET_KEY 与 OWNER_USERNAME / OWNER_PASSWORD
alembic upgrade head
python -m app.scripts.init_data    # 初始化分类种子数据 + Owner 账号
uvicorn app.main:app --reload --port 8000
```

后端默认运行在 <http://localhost:8000>，OpenAPI 文档 <http://localhost:8000/docs>。

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 <http://localhost:5173>，会代理 `/experience/api` 到后端 8000 端口。

## 部署

见 [`deploy/DEPLOY.md`](deploy/DEPLOY.md)。

## 安全要点

- HTML 文档**只在 `view.luliming.xyz` 子域内通过 iframe sandbox 渲染**，与主站 Cookie 严格隔离
- 文件下载经 Token 鉴权，不开放静态目录
- 写接口 Owner-only，访客 403
- 登录 JWT + bcrypt + 限流
- 详情参见 PRD 第 4.4 节

## License

私有项目，仅供个人使用。
