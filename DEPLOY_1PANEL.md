# HoYoMusic × 1Panel 部署指南

> **架构概览**
> ```
> 公网
>  └─ Nginx（1Panel 网站模块，443/80）
>      ├─ /          → 前端静态文件（Vite 构建产物）
>      └─ /api/      → 反向代理 → Node.js 运行环境（:3000）
>                                      └─ PostgreSQL 容器（:5432）
> ```

---

## 准备工作

### 本机：确认代码已推送

```bash
# Windows 本机，项目目录
git push origin main
```

### 服务器：安装 Node.js 20

1Panel 的「Node.js 运行环境」需要宿主机有 Node.js。在 **1Panel 终端** 中执行：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v    # 应显示 v20.x.x
```

---

## 第一步：克隆代码

在 1Panel 终端执行：

```bash
cd /opt
git clone https://github.com/sumicowork/HoYoMusic.git
# 若提示需要认证，使用：
# git clone https://<your_token>@github.com/sumicowork/HoYoMusic.git
```

---

## 第二步：安装 PostgreSQL

**面板 → 应用商店 → 搜索 PostgreSQL → 安装**

| 配置项 | 填写值 |
|--------|-------|
| 用户名 | `hoyomusic_user` |
| 密码 | 自定义强密码（**记住，后面要用**） |
| 数据库名 | `hoyomusic` |
| 端口 | `5432`（默认） |
| 允许外部访问 | **不勾**（只内部使用） |

安装完成后，记下容器名：

```bash
docker ps | grep postgres
# 示例输出：1panel-postgresql
```

---

## 第三步：初始化数据库

```bash
# 用统一初始化脚本一次完成所有建表，替换 1panel-postgresql 为你的实际容器名
docker exec -i 1panel-postgresql psql -U hoyomusic_user -d hoyomusic \
  < /opt/HoYoMusic/backend/init_db.sql
```

正常结束时最后几行应显示：

```
      status
-------------------
 ✅ 数据库初始化完成

 id |      name      | ...   ← 7 行游戏数据
 id |   name   | icon  ...   ← 6 行标签分组
```

---

## 第四步：创建后端 .env 文件

```bash
cp /opt/HoYoMusic/backend/.env.example /opt/HoYoMusic/backend/.env
nano /opt/HoYoMusic/backend/.env
```

按以下内容填写，**注意 DB_HOST**：

```ini
# ── 数据库 ──────────────────────────────────────────────────
# 1Panel 的 PostgreSQL 是 Docker 容器，先查它的容器 IP：
#   docker inspect 1panel-postgresql | grep '"IPAddress"'
# 把输出的 IP（如 172.18.0.3）填到下面
DB_HOST=172.18.0.3
DB_PORT=5432
DB_NAME=hoyomusic
DB_USER=hoyomusic_user
DB_PASSWORD=第二步设置的密码

# ── JWT ─────────────────────────────────────────────────────
# 务必替换为随机长字符串，可用：openssl rand -hex 32
JWT_SECRET=在这里填一个64位以上的随机字符串
JWT_EXPIRES_IN=7d

# ── 存储：阿里云 OSS ─────────────────────────────────────────
STORAGE_MODE=oss
OSS_REGION=oss-cn-hangzhou          # 改为你的地域
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_BUCKET=你的Bucket名称
OSS_SECURE=true
OSS_BASE_PATH=hoyomusic
# 若 ECS 与 OSS 同地域，取消下行注释走内网（省流量费）
# OSS_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com

# ── 服务 ─────────────────────────────────────────────────────
PORT=3000
MAX_FILE_SIZE=524288000
```

查询 PostgreSQL 容器 IP 的命令：

```bash
docker inspect 1panel-postgresql | grep '"IPAddress"'
# 输出示例："IPAddress": "172.18.0.3"
```

---

## 第五步：创建 Node.js 运行环境（后端）

**面板 → 运行环境 → 新建运行环境**，按下表填写：

| 字段 | 填写内容 |
|------|---------|
| 名称 | `hoyomusic` |
| 应用 | `Node.js 20.x` |
| 源码目录 | `/opt/HoYoMusic/backend` |
| 启动命令 | 选「自定义」 |
| 自定义启动命令 | `npm install && npm run build && node dist/index.js` |
| 应用端口 | `3000` |
| 外部映射端口 | `3000` |
| 端口外部访问 | **不勾**（通过 Nginx 对外，不直接暴露） |
| 包管理器 | `npm` |
| 镜像源 | 国内服务器选「腾讯云」或「淘宝」 |
| 容器名称 | `hoyomusic-api` |

点击**确认**，等待容器启动（首次需要编译，约 1-2 分钟）。

### 验证后端

```bash
curl http://localhost:3000/api/health
# 期望返回：{"success":true,"message":"HoYoMusic API is running"}
```

若未返回，查看运行环境日志：**面板 → 运行环境 → hoyomusic → 日志**

---

## 第六步：构建前端

在 1Panel 终端执行：

```bash
cd /opt/HoYoMusic/frontend

# 前端通过相对路径 /api/ 访问后端，无跨域问题
echo 'VITE_API_URL=/api' > .env.production

npm install
npm run build
# 产物在 /opt/HoYoMusic/frontend/dist/
```

---

## 第七步：创建网站（前端 + Nginx）

### 7-1 新建静态网站

**面板 → 网站 → 新建网站**：

| 选项 | 填写 |
|------|------|
| 类型 | 静态网站 |
| 主域名 | 你的域名（或服务器公网 IP） |
| 网站目录 | `/opt/HoYoMusic/frontend/dist` |
| PHP 版本 | 无 |

### 7-2 申请 HTTPS 证书（有域名时）

**网站列表 → 点击该网站 → HTTPS → 申请 Let's Encrypt 证书 → 勾选自动续签**

### 7-3 添加反向代理

**网站列表 → 点击该网站 → 反向代理 → 新增**：

| 选项 | 填写 |
|------|------|
| 代理名称 | `api` |
| 代理路径 | `/api/` |
| 代理地址 | `http://127.0.0.1:3000` |

点击保存。

### 7-4 修改 Nginx 配置（必须手动追加）

**网站列表 → 点击该网站 → 配置文件**

找到 `location /` 块，追加 `try_files` 一行（支持 React Router 刷新不 404）：

```nginx
location / {
    try_files $uri $uri/ /index.html;   # ← 追加这一行
}
```

找到 `location /api/` 块，追加超时和上传大小限制：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    # ↓ 追加以下三行
    client_max_body_size 600m;
    proxy_read_timeout   600s;
    proxy_send_timeout   600s;
}
```

点击**保存**，面板会自动 reload Nginx。

---

## 第八步：验证整体运行

| 检查项 | 方法 |
|--------|------|
| 后端健康 | 浏览器访问 `https://你的域名/api/health` |
| 前端首页 | 浏览器访问 `https://你的域名` |
| 后端日志 | 面板 → 运行环境 → hoyomusic → 日志 |
| Nginx 日志 | 面板 → 网站 → 点击网站 → 日志 |

---

## 后续代码更新

每次本机 `git push` 后，在服务器终端执行：

```bash
cd /opt/HoYoMusic

# 1. 拉取最新代码
git pull origin main

# 2. 重新构建前端
cd frontend && npm install && npm run build && cd ..

# 3. 重启后端（运行环境会自动重新 build）
#    面板 → 运行环境 → hoyomusic → 重启
#    或在终端：
docker restart hoyomusic-api
```

也可以保存为一键脚本：

```bash
cat > /opt/deploy.sh << 'EOF'
#!/bin/bash
set -e
cd /opt/HoYoMusic
git pull origin main
cd frontend && npm install && npm run build && cd ..
docker restart hoyomusic-api
echo "✅ 部署完成"
EOF
chmod +x /opt/deploy.sh
```

以后只需运行：`bash /opt/deploy.sh`

---

## 常见问题排查

| 现象 | 排查步骤 |
|------|---------|
| `/api/health` 返回 502 | 面板 → 运行环境 → 日志，确认后端是否正在运行 |
| 数据库连接失败 | `docker inspect 1panel-postgresql \| grep IPAddress` 重新确认 IP，更新 `.env` 后重启容器 |
| 上传 FLAC 返回 413 | 检查 Nginx 配置中 `client_max_body_size 600m` 是否已保存 |
| 前端页面刷新后 404 | 检查 `location /` 内是否有 `try_files $uri $uri/ /index.html` |
| OSS 上传报 AccessDenied | 检查 `.env` 中 AK/SK 是否正确；确认 RAM 用户有 `AliyunOSSFullAccess` 权限 |
| git pull 需要密码 | 使用 Personal Access Token：`git remote set-url origin https://<token>@github.com/sumicowork/HoYoMusic.git` |

