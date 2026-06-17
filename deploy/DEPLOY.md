# 部署手册（腾讯云轻量应用服务器）

> 适用环境：Ubuntu 22.04 LTS  
> 主域：`www.luliming.xyz/experience`  
> 沙箱域：`view.luliming.xyz`

---

## 一、域名 & DNS

在域名服务商（腾讯云 / Cloudflare 等）添加：

| 主机记录 | 类型 | 值 |
| --- | --- | --- |
| `www`  | A    | 轻量服务器公网 IP |
| `view` | A    | 同上（**必须独立二级域名，否则 XSS 防护失效**） |
| `@`    | A    | 同上（可选，用于裸域跳转） |

> ⚠️ 域名必须**已备案**（中国大陆服务器要求）。

---

## 二、服务器初始化

```bash
# 1) 系统更新 + 基础工具
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip nginx git ufw fail2ban certbot python3-certbot-nginx libmagic1

# 2) 防火墙：仅放行 SSH/HTTP/HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 3) 创建部署用户（可选，也可用现有 www-data）
sudo mkdir -p /var/www/experience
sudo chown -R www-data:www-data /var/www/experience
```

---

## 三、拉取代码 & 后端部署

```bash
# 切换到部署目录
cd /var/www/experience
sudo -u www-data git clone <YOUR_REPO_URL> .   # 或 rsync 上传

# ===== Backend =====
cd backend
sudo -u www-data python3.11 -m venv .venv
sudo -u www-data .venv/bin/pip install -U pip
sudo -u www-data .venv/bin/pip install -r requirements.txt

# 配置环境变量
sudo cp .env.example .env
sudo chown www-data:www-data .env
sudo chmod 600 .env
sudo -u www-data nano .env
# 必改项：
#   SECRET_KEY=<python -c "import secrets; print(secrets.token_urlsafe(64))" 生成的值>
#   OWNER_USERNAME=<你的管理员用户名>
#   OWNER_PASSWORD=<强随机密码>
#   APP_ENV=prod
#   APP_BASE_URL=https://www.luliming.xyz
#   APP_ROOT_PATH=/experience
#   COOKIE_SECURE=true
#   COOKIE_SAMESITE=strict
#   HTML_VIEW_BASE_URL=https://view.luliming.xyz

# 首次启动会自动建表 + 创建 Owner 账号
sudo -u www-data .venv/bin/python -m app.scripts.init_data
```

---

## 四、前端构建

```bash
# 在本地（或服务器）构建前端，把 dist/ 部署到 /var/www/experience/frontend
cd /var/www/experience/frontend
sudo apt install -y nodejs npm    # 或用 nvm 装更新版本
sudo -u www-data npm ci
sudo -u www-data npm run build

# 把构建产物放到 nginx 目录（与 nginx alias 对应）
sudo rm -rf /var/www/experience/frontend_dist
sudo -u www-data mv dist /var/www/experience/frontend_dist
# 然后修改 nginx 配置中的 alias 为 /var/www/experience/frontend_dist/
```

> 可把构建步骤放到 CI/CD（如 GitHub Actions）中，把产物 rsync 到服务器。

---

## 五、systemd 服务

```bash
# 1) API 服务
sudo cp /var/www/experience/deploy/systemd/experience-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now experience-api
sudo systemctl status experience-api

# 2) 备份定时任务
sudo cp /var/www/experience/deploy/systemd/experience-backup.service /etc/systemd/system/
sudo cp /var/www/experience/deploy/systemd/experience-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now experience-backup.timer
sudo systemctl list-timers experience-backup.timer
```

---

## 六、Nginx & HTTPS

```bash
# 1) 复制配置
sudo cp /var/www/experience/deploy/nginx/app.conf /etc/nginx/conf.d/luliming-app.conf
sudo cp /var/www/experience/deploy/nginx/view.conf /etc/nginx/conf.d/luliming-view.conf

# 2) 校验
sudo nginx -t

# 3) 申请证书（首次）
sudo certbot --nginx -d www.luliming.xyz -d luliming.xyz
sudo certbot --nginx -d view.luliming.xyz

# 4) 自动续期检查
sudo systemctl status certbot.timer
sudo certbot renew --dry-run

# 5) 重启 Nginx
sudo systemctl reload nginx
```

---

## 七、验证

```bash
# 1) 后端健康
curl -i https://www.luliming.xyz/experience/healthz
# 期望：{"status":"ok"}

# 2) 登录
curl -i -X POST https://www.luliming.xyz/experience/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<OWNER_USERNAME>","password":"<OWNER_PASSWORD>"}' \
  -c cookies.txt

# 3) 列分类
curl -i https://www.luliming.xyz/experience/api/v1/categories -b cookies.txt

# 4) 浏览器访问
# https://www.luliming.xyz/experience
# 用 Owner 账号登录，新增一篇测试 HTML，点击卡片应跳转到 view.luliming.xyz
```

---

## 八、安全检查清单

- [ ] `.env` 权限 `chmod 600`，且 `SECRET_KEY` 已替换为强随机值
- [ ] `OWNER_PASSWORD` 已改为强密码（≥ 16 位随机串）
- [ ] `COOKIE_SECURE=true`、`COOKIE_SAMESITE=strict` 已生效
- [ ] `view.luliming.xyz` 与 `www.luliming.xyz` 是不同二级域名，且都已 HTTPS
- [ ] `ufw` 只放行 22/80/443
- [ ] `fail2ban` 已启用（`sudo systemctl status fail2ban`）
- [ ] SSH 关闭密码登录，仅允许密钥（`/etc/ssh/sshd_config`）
- [ ] 备份每天凌晨自动跑（`journalctl -u experience-backup.service`）
- [ ] 测试上传一个含 `<script>alert(1)</script>` 的 HTML，确认在 `view` 子域打开时无法读取主站 Cookie

---

## 九、运维常用命令

```bash
# 查看后端日志
sudo journalctl -u experience-api -f

# 重启后端
sudo systemctl restart experience-api

# 立即备份
sudo systemctl start experience-backup.service

# 数据库快速查看（SQLite）
sqlite3 /var/www/experience/backend/data/app.db ".tables"
sqlite3 /var/www/experience/backend/data/app.db "select id,username,role from users;"

# 查看磁盘占用
du -sh /var/www/experience/backend/storage/* /var/www/experience/backend/backups
```

---

## 十、常见问题

**Q：登录后立刻被踢？**  
A：检查 `COOKIE_SECURE`。如果服务器没启用 HTTPS 又设了 `true`，浏览器会拒收 Cookie。生产必须 HTTPS + Secure，开发本地用 HTTP 时设 `false`。

**Q：HTML 打开时浏览器地址跳到主域？**  
A：检查 `HTML_VIEW_BASE_URL` 是否填的是 `https://view.luliming.xyz`，并且 `view.luliming.xyz` 的 DNS 已解析到本机。

**Q：上传 HTML 报 413？**  
A：检查 Nginx 的 `client_max_body_size`，应至少 `25m`。
