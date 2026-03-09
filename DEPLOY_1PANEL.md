# HoYoMusic 部署指南（1Panel）

> **最后更新：2026-03-07**  
> 本文档与当前代码库完全同步，涵盖访问统计、字体自托管等最新功能。

---

## 架构概览

```
公网 (80/443)
  └─ Nginx（1Panel 网站模块）
       ├─ /            → 前端静态文件（Vite 构建产物，含自托管字体）
       └─ /api/        → 反向代理 → Node.js :3000
                                        └─ PostgreSQL 容器 :5432
                                        └─ 阿里云 OSS（音频/封面存储）
```

---

## 前置要求

| 项目 | 最低要求 |
|------|---------|
| 操作系统 | Ubuntu 22.04 LTS 或 Debian 12 |
| 内存 | 2 GB（推荐 4 GB） |
| 磁盘 | 20 GB 可用（含 PostgreSQL 数据） |
| 面板 | 1Panel 最新版（含 OpenResty/Nginx） |
| Node.js | 20.x LTS |

---

## 第一步：服务器安装 Node.js 20

在 **1Panel → 终端** 中执行：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # 应显示 v20.x.x
npm -v    # 应显示 10.x.x
```

---

## 第二步：克隆代码

```bash
cd /opt
git clone https://github.com/sumicowork/HoYoMusic.git
# 私有仓库或需要 Token 时：
# git clone https://<your_token>@github.com/sumicowork/HoYoMusic.git
cd HoYoMusic
```

---

## 第三步：安装 PostgreSQL

**1Panel → 应用商店 → 搜索 PostgreSQL → 安装**

| 配置项 | 建议填写 |
|--------|---------|
| 用户名 | `hoyomusic_user` |
| 密码 | 随机强密码（**务必记录**） |
| 数据库名 | `hoyomusic` |
| 端口 | `5432` |
| 允许外部访问 | ❌ 不勾（仅内部使用） |

安装后记下容器名：

```bash
docker ps --format '{{.Names}}' | grep -i post
# 示例：1panel-postgresql-1
```

---

## 第四步：初始化数据库

```bash
# 替换 1panel-postgresql-1 为你的实际容器名
PGCONT=1panel-postgresql-1

docker exec -i $PGCONT psql -U hoyomusic_user -d hoyomusic \
  < /opt/HoYoMusic/backend/init_db.sql
```

> ⚠️ `visit_logs` 表（访问统计）无需手动建表，后端启动时**自动迁移**创建。

验证基础数据：

```bash
docker exec -it $PGCONT psql -U hoyomusic_user -d hoyomusic \
  -c "SELECT name FROM games;" -c "SELECT name FROM tag_groups;"
```

---

## 第五步：配置后端环境变量

```bash
cp /opt/HoYoMusic/backend/.env.example /opt/HoYoMusic/backend/.env
nano /opt/HoYoMusic/backend/.env
```

### 5-1 查询 PostgreSQL 容器 IP

```bash
docker inspect 1panel-postgresql-1 | grep '"IPAddress"'
# 示例输出："IPAddress": "172.18.0.3"
```

### 5-2 填写 .env

```ini
# ── 基础服务 ─────────────────────────────────────────────────
PORT=3000
NODE_ENV=production

# ── 数据库（使用容器内网 IP）────────────────────────────────────
DB_HOST=172.18.0.3        # ← 替换为上面查询到的 IP
DB_PORT=5432
DB_NAME=hoyomusic
DB_USER=hoyomusic_user
DB_PASSWORD=你的数据库密码

# ── JWT（必须修改！）────────────────────────────────────────────
# 生成方式：openssl rand -hex 32
JWT_SECRET=在这里粘贴64位以上的随机字符串
JWT_EXPIRES_IN=7d

# ── 文件上传限制 ──────────────────────────────────────────────
MAX_FILE_SIZE=524288000

# ── 存储模式（三选一）────────────────────────────────────────────
# 推荐生产环境使用 oss
STORAGE_MODE=oss

# ── 阿里云 OSS（STORAGE_MODE=oss 时必填）──────────────────────
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_BUCKET=你的Bucket名称
OSS_SECURE=true
OSS_BASE_PATH=hoyomusic
# ECS 与 OSS 同地域时取消注释，走内网（节省流量费）：
# OSS_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com
# 绑定 CDN 加速域名（可选）：
# OSS_CDN_DOMAIN=cdn.yourdomain.com
```

生成安全随机 JWT 密钥：

```bash
openssl rand -hex 32
```

---

## 第六步：创建后端 Node.js 运行环境

**1Panel → 运行环境 → 新建运行环境**

| 字段 | 填写 |
|------|------|
| 名称 | `hoyomusic-api` |
| 应用 | Node.js 20.x |
| 源码目录 | `/opt/HoYoMusic/backend` |
| 启动方式 | 自定义命令 |
| 启动命令 | `npm install && npm run build && node dist/index.js` |
| 应用端口 | `3000` |
| 端口外部访问 | ❌ 不勾 |
| 包管理器 | npm |
| 镜像源 | 国内服务器选「腾讯云」或「淘宝」 |
| 容器名 | `hoyomusic-api` |

点击**确认**，首次构建约 1-3 分钟。

### 验证后端

```bash
curl http://localhost:3000/api/health
# 期望：{"success":true,"message":"HoYoMusic API is running"}
```

若失败，查看日志：

```bash
docker logs hoyomusic-api --tail 50
```

### 验证自动迁移

后端启动日志中应包含：

```
✅ DB migrations up to date (artist_aliases)
✅ DB migrations up to date (visit_logs)
```

`visit_logs` 若出现则访问统计功能已就绪。

---

## 第七步：构建前端

```bash
cd /opt/HoYoMusic/frontend

# 设置 API 地址（通过 Nginx 反代，相对路径即可）
echo 'VITE_API_URL=/api' > .env.production

# 安装依赖（含自托管字体、recharts 等）
npm install

# 构建生产版本
npm run build
# 产物在 /opt/HoYoMusic/frontend/dist/
# dist/fonts/ 目录包含自托管的 Plus Jakarta Sans 和 Noto Serif SC 字体
```

验证构建产物：

```bash
ls /opt/HoYoMusic/frontend/dist/
# 应包含：index.html  assets/  fonts/  games/  favicon.png

ls /opt/HoYoMusic/frontend/dist/fonts/ | head -5
# 应包含 .woff2 字体文件
```

---

## 第八步：创建网站（Nginx）

### 8-1 新建静态网站

**1Panel → 网站 → 新建网站**

| 选项 | 填写 |
|------|------|
| 类型 | 静态网站 |
| 主域名 | 你的域名 或 服务器公网 IP |
| 网站目录 | `/opt/HoYoMusic/frontend/dist` |

### 8-2 申请 HTTPS 证书（有域名时）

**网站 → 该网站 → HTTPS → 申请 Let's Encrypt 证书 → 勾选自动续签**

### 8-3 添加反向代理

**网站 → 该网站 → 反向代理 → 新增**

| 选项 | 填写 |
|------|------|
| 代理名称 | `api` |
| 代理路径 | `/api/` |
| 代理地址 | `http://127.0.0.1:3000` |

### 8-4 修改 Nginx 配置（必须手动追加）

**网站 → 该网站 → 配置文件**，按以下说明修改：

**① 找到 `location /` 块，确保有 `try_files`（支持 React Router 刷新）：**

```nginx
location / {
    root   /opt/HoYoMusic/frontend/dist;
    index  index.html;
    try_files $uri $uri/ /index.html;   # ← 必须有这行
}
```

**② 找到或新增 `location /api/` 块，添加超时和上传限制：**

```nginx
location /api/ {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    client_max_body_size 600m;    # ← FLAC 上传必须
    proxy_read_timeout   600s;
    proxy_send_timeout   600s;
}
```

**③ 新增字体文件缓存规则（可选但推荐）：**

```nginx
# 字体长期缓存
location ~* \.(woff2?|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin *;
}

# 静态资源中期缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp)$ {
    expires 30d;
    add_header Cache-Control "public";
}
```

> ⚠️ **重要**：`X-Real-IP` 和 `X-Forwarded-For` 请求头是访问统计准确记录真实访客 IP 的关键，必须配置。

点击**保存**，1Panel 会自动 reload Nginx。

---

## 第九步：验证完整运行

```bash
# 1. 后端健康检查
curl https://你的域名/api/health

# 2. 前端是否正常加载（返回 HTML）
curl -s https://你的域名 | head -5

# 3. 字体文件是否可访问
curl -I https://你的域名/fonts/$(ls /opt/HoYoMusic/frontend/dist/fonts/ | grep 'latin-wght' | head -1)

# 4. 检查 visit_logs 表是否在记录（等待几秒后）
docker exec 1panel-postgresql-1 psql -U hoyomusic_user -d hoyomusic \
  -c "SELECT COUNT(*), MAX(ts) FROM visit_logs;"
```

浏览器验证清单：

| 检查项 | 方法 |
|--------|------|
| 前端首页 | 访问 `https://你的域名` |
| API 健康 | 访问 `https://你的域名/api/health` |
| 管理后台 | 访问 `https://你的域名/admin/login` |
| 访问统计 | 登录后台 → 左侧「访问统计」菜单 |
| 字体显示 | 检查页面标题是否为衬线字体（宋体风格） |
| favicon | 浏览器标签页应显示 HoYoMusic 图标 |

---

## 第十步：创建管理员账号

首次部署需要初始化管理员账号：

```bash
cd /opt/HoYoMusic/backend
# 通过后端的 setup 脚本创建管理员
docker exec -it hoyomusic-api node dist/setup.js
# 或者直接运行（若运行环境支持）：
# npm run setup
```

若 setup 脚本不存在，也可直接向数据库插入：

```bash
# 先生成 bcrypt hash（Node.js 一行命令）
HASH=$(node -e "const b=require('bcrypt');b.hash('你的密码',10).then(h=>console.log(h))")

docker exec 1panel-postgresql-1 psql -U hoyomusic_user -d hoyomusic \
  -c "INSERT INTO users (username, password_hash) VALUES ('admin', '$HASH') ON CONFLICT DO NOTHING;"
```

---

## 一键更新脚本

将以下脚本保存到服务器，之后每次代码更新只需运行一个命令：

```bash
cat > /opt/deploy.sh << 'DEPLOY_EOF'
#!/bin/bash
set -e

echo "🚀 HoYoMusic 部署开始 — $(date '+%Y-%m-%d %H:%M:%S')"

# 配置
APP_DIR=/opt/HoYoMusic
BACKEND_CONTAINER=hoyomusic-api
BRANCH=main

cd "$APP_DIR"

# 1. 拉取最新代码
echo "📥 拉取代码..."
git pull origin $BRANCH

# 2. 构建前端
echo "🔨 构建前端..."
cd frontend
npm install --prefer-offline
npm run build
cd ..

# 3. 重启后端（运行环境容器会自动重新 npm install + build）
echo "🔄 重启后端..."
docker restart $BACKEND_CONTAINER

# 4. 等待后端就绪
echo "⏳ 等待后端启动..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 后端已就绪"
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo "❌ 后端启动超时，请检查日志：docker logs $BACKEND_CONTAINER --tail 50"
    exit 1
  fi
done

echo "🎉 部署完成 — $(date '+%Y-%m-%d %H:%M:%S')"
DEPLOY_EOF

chmod +x /opt/deploy.sh
echo "✅ 部署脚本已创建：/opt/deploy.sh"
```

之后每次更新只需：

```bash
bash /opt/deploy.sh
```

---

## 常见问题排查

### 502 Bad Gateway

```bash
# 检查后端是否在运行
docker ps | grep hoyomusic-api

# 查看后端日志
docker logs hoyomusic-api --tail 100

# 确认端口监听
curl http://localhost:3000/api/health
```

### 数据库连接失败

```bash
# 重新确认 PostgreSQL 容器 IP
docker inspect 1panel-postgresql-1 | grep '"IPAddress"'

# 更新 .env 后重启后端
docker restart hoyomusic-api
```

### 前端刷新后 404

Nginx `location /` 缺少 `try_files $uri $uri/ /index.html;`，参见第八步 ①。

### 上传 FLAC 返回 413

Nginx 缺少 `client_max_body_size 600m;`，参见第八步 ②。

### 访问统计不记录数据

1. 确认 Nginx 配置了 `X-Forwarded-For` 请求头（第八步 ②）
2. 确认后端日志包含 `✅ DB migrations up to date (visit_logs)`
3. 检查 `visit_logs` 表是否存在：
   ```bash
   docker exec 1panel-postgresql-1 psql -U hoyomusic_user -d hoyomusic \
     -c "\dt visit_logs"
   ```

### 字体加载失败（显示默认字体）

```bash
# 确认构建时字体文件已生成
ls /opt/HoYoMusic/frontend/dist/fonts/ | wc -l
# 应有若干 .woff2 文件

# 检查 Nginx 是否返回字体文件（注意 CORS 头）
curl -I https://你的域名/fonts/plus-jakarta-sans-latin-400-normal-xxxxx.woff2
# 应包含：Access-Control-Allow-Origin: *
```

### OSS 上传报 AccessDenied

- 确认 RAM 子账号有 `AliyunOSSFullAccess` 权限
- 确认 `.env` 中 AK/SK 无多余空格
- 确认 `OSS_BUCKET` 与实际 Bucket 名称完全一致

### Git pull 需要密码

```bash
git remote set-url origin https://<your_token>@github.com/sumicowork/HoYoMusic.git
```

---

## 日志位置

| 类型 | 查看方式 |
|------|---------|
| 后端应用日志 | `docker logs hoyomusic-api -f` |
| Nginx 访问日志 | 1Panel → 网站 → 该网站 → 访问日志 |
| Nginx 错误日志 | 1Panel → 网站 → 该网站 → 错误日志 |
| PostgreSQL 日志 | `docker logs 1panel-postgresql-1 --tail 50` |
| 访问统计数据 | 登录后台 → 访问统计 |

---

## 端口与防火墙

生产环境**只需开放**以下端口：

| 端口 | 用途 | 说明 |
|------|------|------|
| `80` | HTTP | 由 Nginx 管理，自动跳转 HTTPS |
| `443` | HTTPS | 主要访问端口 |
| `22` | SSH | 服务器管理（建议改为非标准端口） |

**不需要对外开放** `3000`（后端）和 `5432`（数据库）。

1Panel 防火墙配置：**面板 → 安全 → 防火墙**，确保 80 和 443 已放行。

---

## 备份建议

```bash
# 数据库每日备份（加入 crontab）
cat > /opt/backup_db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/backups
mkdir -p $BACKUP_DIR
docker exec 1panel-postgresql-1 pg_dump -U hoyomusic_user hoyomusic \
  | gzip > "$BACKUP_DIR/hoyomusic_$DATE.sql.gz"
# 保留最近 30 天
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
echo "✅ 备份完成：$BACKUP_DIR/hoyomusic_$DATE.sql.gz"
EOF
chmod +x /opt/backup_db.sh

# 添加到 crontab（每天凌晨 3 点执行）
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/backup_db.sh >> /var/log/hoyomusic-backup.log 2>&1") | crontab -
```
