# 部署手册（腾讯云轻量应用服务器）

> 适用环境：**OpenCloudOS 9.4**（RHEL 系，使用 `dnf` / `yum`）  
> 部署目录：**`/opt/experience`**  
> 后端端口：**`127.0.0.1:8094`**（仅监听本地，经 Nginx 反代）  
> 主域：**`https://www.luliming.xyz/experience`**

---

## 一、域名 & DNS

在域名服务商（腾讯云 / Cloudflare 等）添加：

| 主机记录 | 类型 | 值 |
| --- | --- | --- |
| `www`  | A    | 轻量服务器公网 IP |
| `@`    | A    | 同上（裸域跳转用） |

> ⚠️ 域名必须**已备案**（中国大陆服务器要求）。  
> 当前部署未启用独立的 `view.luliming.xyz` 沙箱子域，HTML 通过同域 `/experience/files/html/` 直出（见下文 Nginx 配置）。如需子域沙箱隔离，可参考 `deploy/nginx/view.conf`。

---

## 二、服务器初始化（OpenCloudOS / RHEL 系）

```bash
# 1) 系统更新 + 基础工具
sudo dnf update -y
sudo dnf install -y python3 python3-pip nginx git tar gzip

# 2) Node（前端构建，建议 20.x；如未预装）
#    可用 dnf 或 nvm 安装，当前线上为 v20.18.0 / npm 10.8.2
node --version && npm --version

# 3) 部署目录（当前线上以 root 运行；推荐生产改用专用低权用户）
sudo mkdir -p /opt/experience
sudo chown -R root:root /opt/experience
```

> 说明：本手册的端口、路径、运行用户均取自**线上实际生效**的 systemd / Nginx 配置。
> 若改为非 root 用户部署，请将下文所有 `root:root`、`User=root` 替换为部署用户，
> 并相应调整目录属主与 `ReadWritePaths`。

---

## 三、首次部署（拉取代码 & 后端）

```bash
cd /opt/experience

# 1) 拉取代码
sudo git clone <YOUR_REPO_URL> .        # 或 rsync 上传

# 2) Python 虚拟环境
cd /opt/experience/backend
python3 -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install -r requirements.txt

# 3) 配置环境变量（务必修改）
cp .env.example .env
chmod 600 .env
nano .env
# 关键项：
#   SECRET_KEY=<python3 -c "import secrets; print(secrets.token_urlsafe(64))">
#   OWNER_USERNAME=<管理员用户名>
#   OWNER_PASSWORD=<强随机密码>
#   APP_ENV=prod
#   APP_BASE_URL=https://www.luliming.xyz
#   APP_ROOT_PATH=/experience
#   COOKIE_SECURE=true
#   COOKIE_SAMESITE=strict
#   HTML_VIEW_BASE_URL=https://www.luliming.xyz   # 同域直出，无需独立子域

# 4) 首次启动：自动建表 + 创建 Owner 账号 + 迁移字段
.venv/bin/python -m app.scripts.init_data
.venv/bin/python -m app.scripts.migrate
```

---

## 四、前端构建

```bash
cd /opt/experience/frontend
npm ci
npm run build

# 构建产物直接落到 Nginx 的 alias 目录
# （deploy/nginx/app.conf 中 alias /opt/experience/frontend/）
# 若 build 输出到 dist/，确保最终目录为 /opt/experience/frontend/
```

> 构建步骤可放到 CI/CD（GitHub Actions），把 `dist/` rsync 到服务器 `/opt/experience/frontend/`。

---

## 五、systemd 服务

实际生效的服务文件为 `/etc/systemd/system/experience-api.service`
（监听 `127.0.0.1:8094`，与仓库 `deploy/systemd/experience-api.service` 一致）：

```bash
sudo cp /opt/experience/deploy/systemd/experience-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now experience-api
sudo systemctl status experience-api

# 备份定时任务（每日凌晨 3:00）
sudo cp /opt/experience/deploy/systemd/experience-backup.service /etc/systemd/system/
sudo cp /opt/experience/deploy/systemd/experience-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now experience-backup.timer
sudo systemctl list-timers experience-backup.timer
```

---

## 六、Nginx & HTTPS

线上 Nginx 配置为**单文件** `/etc/nginx/conf.d/luliming.conf`：
内含 `www.luliming.xyz` 的一个 `server` 块（由 Certbot 管理 SSL），
`/experience` 相关 location 见 `deploy/nginx/app.conf`，需**合并进该 server 块**。

```bash
# 1) 将 deploy/nginx/app.conf 中的 location 片段合并进现有 server 块
sudo nano /etc/nginx/conf.d/luliming.conf

# 2) 校验并重载
sudo nginx -t
sudo systemctl reload nginx

# 3) 证书（Certbot 已托管，无需重复申请）
sudo certbot renew --dry-run
```

> 当前线上未使用独立 `view.luliming.xyz`；如需子域沙箱隔离，启用 `deploy/nginx/view.conf`
> 并相应设置 `HTML_VIEW_BASE_URL`。

---

## 七、灰度更新流程（线上实际用法）

代码更新时**不重建整个目录**，仅覆盖应用代码并保留 `.env` / `data` / `storage` / `.venv`：

```bash
# 本地：提交并推送
git push origin main

# 服务器：
ssh root@<服务器IP>

# 1) 备份（DB / 代码 / 前端）
cd /opt/experience/backend
cp data/app.db data/app.db.bak.$(date +%Y%m%d%H%M)
tar czf /tmp/app.bak.$(date +%Y%m%d%H%M).tgz app
tar czf /tmp/frontend.bak.$(date +%Y%m%d%H%M).tgz frontend

# 2) 拉取最新代码到临时目录
rm -rf /tmp/ea-deploy && git clone --depth 1 <YOUR_REPO_URL> /tmp/ea-deploy

# 3) 仅同步应用代码 + 依赖清单（保留 .env/data/storage/.venv）
rsync -a --exclude='.env' --exclude='data' --exclude='storage' --exclude='.venv' \
      /tmp/ea-deploy/backend/app/ /opt/experience/backend/app/
rsync -a /tmp/ea-deploy/backend/requirements.txt /opt/experience/backend/

# 4) 安装依赖 + 跑迁移（自动建表/加字段，幂等）
cd /opt/experience/backend
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.scripts.migrate

# 5) 构建并同步前端
cd /opt/experience/frontend
npm ci && npm run build
rsync -a dist/ /opt/experience/frontend/

# 6) 重启后端
sudo systemctl restart experience-api
```

---

## 八、验证

```bash
# 1) 后端健康（期望 {"status":"ok"}）
curl -i https://www.luliming.xyz/experience/healthz

# 2) 公网根路径可访问
curl -i https://www.luliming.xyz/experience/

# 3) 开放接口未携带令牌应返回 401
curl -i https://www.luliming.xyz/experience/api/v1/experiences

# 4) 登录
curl -i -X POST https://www.luliming.xyz/experience/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<OWNER_USERNAME>","password":"<OWNER_PASSWORD>"}' \
  -c cookies.txt

# 5) 浏览器访问 https://www.luliming.xyz/experience 用 Owner 登录实测
```

---

## 九、安全检查清单

- [ ] `.env` 权限 `chmod 600`，`SECRET_KEY` 已替换为强随机值
- [ ] `OWNER_PASSWORD` 已改为强密码（≥ 16 位随机串）
- [ ] `COOKIE_SECURE=true`、`COOKIE_SAMESITE=strict` 已生效
- [ ] Nginx 仅放行 80/443（云防火墙同理）
- [ ] 备份每天凌晨自动跑（`journalctl -u experience-backup.service`）
- [ ] 后端仅监听 `127.0.0.1:8094`，不直接暴露公网
- [ ] 建议后续将运行用户从 `root` 改为专用低权用户并收紧目录权限

---

## 十、运维常用命令

```bash
# 查看后端日志
sudo journalctl -u experience-api -f

# 重启后端
sudo systemctl restart experience-api

# 立即备份
sudo systemctl start experience-backup.service

# 数据库快速查看（SQLite）
sqlite3 /opt/experience/backend/data/app.db ".tables"
sqlite3 /opt/experience/backend/data/app.db "select id,username,role from users;"

# 磁盘占用
du -sh /opt/experience/backend/storage/* /opt/experience/backend/backups
```

---

## 十一、常见问题

**Q：登录后立刻被踢？**  
A：检查 `COOKIE_SECURE`。生产必须 HTTPS + Secure（`true`），本地 HTTP 开发时设 `false`。

**Q：上传 HTML 报 413？**  
A：检查 Nginx 的 `client_max_body_size`，应至少 `25m`（见 `deploy/nginx/app.conf`）。

**Q：更新后接口 500？**  
A：多为迁移/依赖未执行。确认已跑 `.venv/bin/python -m app.scripts.migrate` 且 `pip install -r requirements.txt` 成功，再 `systemctl restart experience-api`。

**Q：HTML 打开地址？**  
A：当前同域直出，路径形如 `https://www.luliming.xyz/experience/files/html/<id>`。
区别于早期方案（独立 `view.luliming.xyz` 子域沙箱）。
