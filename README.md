<div align="center">

# 🎵 HoYoMusic

**高品质米哈游游戏音乐收藏平台**

*A premium lossless music library platform for HoYoverse game soundtracks*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite)](https://vitejs.dev/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-6.x-0170FE?logo=antdesign)](https://ant.design/)
[![License](https://img.shields.io/badge/License-Private-red)](#-许可证)

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [架构设计](#-架构设计) · [API 文档](#-api-文档) · [部署指南](#-部署指南) · [路线图](#-路线图)

</div>

---

## 📖 项目简介

HoYoMusic 是一个专为**米哈游（miHoYo / HoYoverse）**游戏玩家打造的私有化音乐收藏与播放平台，支持收藏、管理和欣赏《原神》《崩坏：星穹铁道》《崩坏3》《绝区零》《未定事件簿》等游戏的无损音乐（FLAC 格式）。

平台提供完整的**音乐馆管理**功能（专辑/曲目/艺术家/标签体系），并内置高品质**流媒体播放器**（支持全屏歌词展示）。所有音频文件以 FLAC 无损格式存储，保证最高音质体验。

### 设计理念

- 🎮 **以游戏为单位组织音乐**：按游戏 → 专辑 → 曲目的层级结构，符合玩家的思维习惯
- 🎵 **无损品质优先**：仅支持 FLAC 格式，保存原始采样率（常见 44.1kHz/48kHz/96kHz）和位深（16/24bit）
- 🔒 **私有化部署**：所有数据存储在自己的服务器，支持本地磁盘、WebDAV、阿里云 OSS 三种存储后端
- 🎨 **深浅色主题**：完整的深色/浅色主题系统，自动跟随系统偏好
- 🛡️ **安全优先**：Helmet 安全头、请求频率限制、JWT 认证、文件大小/类型双重校验

---

## ✨ 功能特性

### 🎮 游戏音乐库

- 按游戏分类浏览（原神、崩坏：星穹铁道、崩坏3、绝区零、未定事件簿等）
- 游戏专属背景图，沉浸式视觉体验
- 专辑卡片展示：封面、曲目数、时长、发行年份
- 游戏维护/未发行状态标识

### 🎵 播放器

- **底部常驻播放栏**：封面缩略图、曲目信息、进度条、音量控制
- **全屏播放模式**：点击播放栏空白区域展开，左侧大封面 + 右侧同步滚动歌词
- **播放队列管理**：添加到队列、移除、清空、随机播放
- **键盘快捷键**：空格键播放/暂停
- **Range 请求支持**：支持播放进度任意拖拽（HTTP 206 断点续播）
- **LRC 歌词同步**：精确到毫秒的歌词滚动高亮

### 📚 音乐库浏览

- 公开访问无需登录，所有游客均可浏览播放
- 专辑详情页：专辑信息、曲目列表、一键播放全部
- 曲目详情页：音频参数、歌词、制作人员（Credits）、标签
- 艺术家详情页：旗下曲目与专辑
- 标签系统：层级标签（父子关系），支持多标签筛选（AND/OR）

### 🔍 高级搜索

- 全文搜索（标题 / 艺术家 / 专辑）
- 多维度筛选：采样率、位深、发行年份、时长范围
- 多标签组合筛选（AND/OR 模式切换）
- 灵活排序：创建时间、标题、时长、采样率、发行日期

### 📥 高级导入向导（5步骤）

```
Step 0  选择文件       拖拽/点击选择 .flac，支持批量
Step 1  编辑元数据     修改标题/艺术家/专辑 + Credits 开关决策
Step 2  Credits 预览   后端解析全部 Credits，支持内联编辑/删除/添加
Step 3  导入进度       实时进度条 + 逐文件状态
Step 4  完成           统计结果，失败项可重试
```

- 自动从 FLAC 元数据提取 Credits（作曲、编曲、制作人、混音等）
- 前端可预览并修改全部 Credits 键值对后再提交
- 自动提取内嵌封面并存储
- 支持元数据覆盖（前端编辑值优先于 FLAC 内嵌标签）

### 🏷️ Credits / 制作人员

- 完整的制作人员信息系统（`track_credits` 表）
- 支持作曲、编曲、制作人、混音、母带、演唱等各类角色
- 曲目详情页分类展示

### 🎼 歌词系统

- LRC 格式歌词上传与管理
- 全屏播放器实时滚动高亮
- 曲目详情页独立歌词展示组件（含进度跳转）

### 🛡️ 管理后台

- JWT 认证，已登录状态访问登录页自动跳转
- 曲目管理：增删改、批量删除、批量移动到专辑
- 专辑管理：创建、编辑、封面上传
- 标签管理：树形层级结构管理
- 歌词上传：LRC 文件上传与预览
- Credits 管理：单条添加/编辑/删除

### 🎨 主题系统

- 深色 / 浅色完整双主题
- CSS 变量驱动，统一 token 管理
- 平滑过渡动画
- 持久化到 localStorage

### 🌐 存储模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| 本地存储（默认）| 文件存储在 `backend/uploads/` 目录 | 开发、小规模部署 |
| WebDAV 模式 | 文件存储在 WebDAV 服务器（Nginx/Nextcloud 等）| NAS、家庭服务器 |
| 阿里云 OSS 模式 | 文件存储在阿里云对象存储（支持 CDN 加速）| 生产、大容量部署 |

---

## 🖥️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 5.9 | 类型安全 |
| Vite | 7.x | 构建工具，HMR 开发服务器 |
| Ant Design | 6.x | UI 组件库 |
| React Router | 7.x | 客户端路由 |
| Zustand | 5.x | 轻量级状态管理（播放器/认证/主题） |
| Howler.js | 2.x | 音频引擎（Web Audio API 封装） |
| Axios | 1.x | HTTP 客户端 |
| Recharts | 3.x | 数据可视化图表 |
| Fuse.js | 7.x | 模糊搜索 |
| CSS Variables | — | 主题系统 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 运行时 |
| Express | 5.x | HTTP 框架 |
| TypeScript | 5.9 | 类型安全 |
| PostgreSQL | 14+ | 主数据库 |
| `pg` (node-postgres) | 8.x | 数据库驱动 |
| `music-metadata` | 11.x | FLAC 元数据解析（Node.js） |
| Multer | 2.x | 文件上传处理（memoryStorage） |
| Passport.js | 0.7.x | 认证中间件 |
| `passport-jwt` | 4.x | JWT 策略 |
| `bcrypt` | 6.x | 密码哈希 |
| `jsonwebtoken` | 9.x | JWT 生成与验证 |
| `sharp` | 0.34 | 图像处理（缩略图生成） |
| `ali-oss` | 6.x | 阿里云 OSS 客户端（可选存储后端） |
| `webdav` | 5.x | WebDAV 客户端（可选存储后端） |
| `helmet` | 8.x | HTTP 安全头 |
| `compression` | 1.x | 响应 gzip 压缩 |
| `express-rate-limit` | 7.x | 请求频率限制 |
| `geoip-lite` | 1.x | IP 地理位置 |
| `ua-parser-js` | 2.x | User-Agent 解析 |
| `archiver` | 7.x | ZIP 打包 |
| `dotenv` | — | 环境变量管理 |
| `ts-node` | — | TypeScript 直接执行 |
| `nodemon` | — | 开发热重载 |

---

## 🗂️ 数据库结构

### 完整 ER 关系

```
users
  ├── id, username, password_hash, created_at, updated_at

artists
  ├── id, name, created_at, updated_at

albums
  ├── id, title, cover_path, release_date, game_id (FK→games)
  └── created_at, updated_at

tracks
  ├── id, title, album_id (FK→albums), file_path, cover_path
  ├── duration, track_number, sample_rate, bit_depth, file_size
  └── release_date, created_at, updated_at

track_artists  [M:N 关联表]
  ├── track_id (FK→tracks)
  └── artist_id (FK→artists)

track_credits
  ├── id, track_id (FK→tracks)
  ├── credit_key (string: 'composer', 'arranger', etc.)
  ├── credit_value (string: 人名)
  └── display_order

track_lyrics
  ├── id, track_id (FK→tracks)
  ├── lyrics_path (文件路径)
  └── created_at

tags
  ├── id, name, slug, parent_id (FK→tags, 自引用)
  ├── color, description
  └── created_at, updated_at

track_tags  [M:N 关联表]
  ├── track_id (FK→tracks)
  └── tag_id (FK→tags)

games
  ├── id, name, name_en, description
  ├── cover_path, background_path
  └── display_order, created_at

game_albums  [M:N 关联表]
  ├── game_id (FK→games)
  └── album_id (FK→albums)
```

### 关键索引

```sql
-- 查询性能优化
CREATE INDEX idx_tracks_album_id    ON tracks(album_id);
CREATE INDEX idx_tracks_title       ON tracks(title);
CREATE INDEX idx_artists_name       ON artists(name);
CREATE INDEX idx_albums_title       ON albums(title);
CREATE INDEX idx_tags_parent_id     ON tags(parent_id);
CREATE INDEX idx_track_tags_tag_id  ON track_tags(tag_id);
```

---

## 📁 项目结构

```
HoYoMusic/
├── README.md                    # 本文档
├── PROJECT_STATUS.md            # 开发状态追踪
├── PRD.md                       # 产品需求文档
├── THEME_SYSTEM.md              # 主题系统说明
├── start-dev.ps1                # Windows 一键启动脚本
├── start-dev.bat                # Windows 批处理启动
├── stop-dev.ps1                 # 停止服务脚本
│
├── backend/                     # 后端（Node.js + Express + TypeScript）
│   ├── package.json
│   ├── tsconfig.json
│   ├── schema.sql               # 基础数据库 Schema
│   ├── schema_phase2_*.sql      # Phase 2 扩展 Schema（歌词/Credits）
│   ├── schema_tags*.sql         # 标签系统 Schema
│   ├── schema_game_categories.sql
│   ├── add_new_games.sql
│   └── src/
│       ├── index.ts             # 应用入口，路由挂载，服务器启动
│       ├── setup.ts             # 数据库初始化工具
│       ├── config/
│       │   ├── database.ts      # PostgreSQL 连接池配置
│       │   ├── passport.ts      # Passport JWT 策略配置
│       │   └── webdav.ts        # WebDAV 客户端配置
│       ├── controllers/
│       │   ├── trackController.ts    # 曲目 CRUD + 上传 + Credits 预览
│       │   ├── albumController.ts    # 专辑管理
│       │   ├── artistController.ts   # 艺术家管理
│       │   ├── authController.ts     # 登录/注册/me
│       │   ├── creditsController.ts  # Credits 增删改查
│       │   ├── gameController.ts     # 游戏管理
│       │   ├── lyricsController.ts   # 歌词上传与查询
│       │   └── tagController.ts      # 标签树管理
│       ├── middleware/
│       │   ├── auth.ts               # JWT 认证中间件
│       │   ├── authenticateStream.ts # 流媒体/下载 token 验证
│       │   ├── errorHandler.ts       # 全局错误处理
│       │   └── upload.ts             # Multer 配置（memoryStorage, 500MB）
│       ├── routes/
│       │   ├── trackRoutes.ts        # /api/tracks/*
│       │   ├── albumRoutes.ts        # /api/albums/*
│       │   ├── artistRoutes.ts       # /api/artists/*
│       │   ├── authRoutes.ts         # /api/auth/*
│       │   ├── creditsRoutes.ts      # /api/credits/*
│       │   ├── gameRoutes.ts         # /api/games/*
│       │   ├── lyricsRoutes.ts       # /api/lyrics/*
│       │   ├── publicRoutes.ts       # /api/public/* (无需认证)
│       │   └── tagRoutes.ts          # /api/tags/*
│       ├── services/
│       │   ├── storageService.ts     # 存储抽象层（本地/WebDAV）
│       │   └── webdavService.ts      # WebDAV 具体操作
│       ├── types/
│       │   └── index.ts             # 公共类型定义
│       └── utils/
│           └── cache.ts             # 简单内存缓存
│
├── frontend/                    # 前端（React + TypeScript + Vite）
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx             # 应用入口
│       ├── App.tsx              # 路由配置，主题 Provider
│       ├── App.css
│       ├── index.css            # 全局样式，CSS 变量
│       ├── components/
│       │   ├── Player.tsx           # 底部播放器 + 全屏歌词模式
│       │   ├── UploadModal.tsx      # 5步骤导入向导（含 Credits 编辑）
│       │   ├── LyricsDisplay.tsx    # 歌词展示（带跳转）
│       │   ├── CreditsDisplay.tsx   # Credits 展示组件
│       │   ├── ThemeToggle.tsx      # 深/浅色主题切换按钮
│       │   ├── UploadModal.css
│       │   └── Player.css
│       ├── pages/
│       │   ├── Home.tsx             # 首页：游戏选择卡片墙
│       │   ├── GameDetail.tsx       # 游戏详情：专辑列表（背景图沉浸）
│       │   ├── AlbumDetail.tsx      # 专辑详情：曲目列表
│       │   ├── TrackDetail.tsx      # 曲目详情：歌词/Credits/标签
│       │   ├── ArtistDetail.tsx     # 艺术家详情
│       │   ├── Albums.tsx           # 全部专辑列表
│       │   ├── Artists.tsx          # 全部艺术家列表
│       │   ├── Search.tsx           # 高级搜索（多维筛选）
│       │   ├── Tags.tsx             # 标签浏览
│       │   ├── TagDetail.tsx        # 标签详情：相关曲目
│       │   ├── PublicLibrary.tsx    # 公开曲目库（无需登录）
│       │   ├── Library.tsx          # 管理端音乐库
│       │   ├── Login.tsx            # 登录页（已登录自动跳转）
│       │   ├── Admin.tsx            # 管理后台主页
│       │   ├── AlbumManagement.tsx  # 专辑管理
│       │   └── TagManagement.tsx    # 标签管理
│       ├── services/
│       │   ├── api.ts               # Axios 实例 + JWT 拦截器
│       │   ├── trackService.ts      # 曲目 API + DOWNLOAD_ENABLED 开关
│       │   ├── albumService.ts      # 专辑 API
│       │   ├── authService.ts       # 认证 API
│       │   └── tagService.ts        # 标签 API
│       ├── store/
│       │   ├── playerStore.ts       # 播放器全局状态（Zustand）
│       │   └── authStore.ts         # 认证状态（Zustand，持久化）
│       ├── theme/
│       │   └── themeConfig.ts       # Ant Design 主题 token 配置
│       ├── types/
│       │   └── index.ts             # 前端公共类型
│       └── utils/
│           ├── imageUtils.ts        # 封面 URL 处理、fallback
│           └── toast.ts             # 轻量 toast 通知
│
└── scripts/
    ├── check-environment.ps1    # 环境检查脚本
    └── update-game-covers.ps1   # 游戏封面更新工具
```

---

## 🚀 快速开始

### 环境要求

| 软件 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18.0 | 运行时 |
| npm | ≥ 9.0 | 包管理器 |
| PostgreSQL | ≥ 14 | 数据库 |

### 第一步：克隆项目

```bash
git clone <repository-url> HoYoMusic
cd HoYoMusic
```

### 第二步：配置数据库

```sql
-- 以 postgres 超级用户登录
psql -U postgres

-- 创建数据库和用户
CREATE DATABASE hoyomusic;
CREATE USER hoyomusic_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE hoyomusic TO hoyomusic_user;

-- 退出并导入 Schema
\q
```

```bash
# 导入基础 Schema
psql -U hoyomusic_user -d hoyomusic -f backend/schema.sql

# 导入 Phase 2 扩展（歌词、Credits）
psql -U hoyomusic_user -d hoyomusic -f backend/schema_phase2_lyrics.sql
psql -U hoyomusic_user -d hoyomusic -f backend/schema_phase2_credits.sql

# 导入标签系统
psql -U hoyomusic_user -d hoyomusic -f backend/schema_tags_enhanced.sql

# 导入游戏分类
psql -U hoyomusic_user -d hoyomusic -f backend/schema_game_categories.sql
psql -U hoyomusic_user -d hoyomusic -f backend/add_new_games.sql
```

### 第三步：配置后端环境变量

```bash
cd backend
cp .env.example .env  # 如无示例文件则手动创建
```

编辑 `backend/.env`：

```ini
# ── 服务器 ──────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── 数据库 ──────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hoyomusic
DB_USER=hoyomusic_user
DB_PASSWORD=your_password
DB_POOL_MAX=20

# ── JWT 认证 ─────────────────────────────────────────
JWT_SECRET=your_very_long_and_random_secret_key_here
JWT_EXPIRES_IN=7d

# ── 存储模式 ─────────────────────────────────────────
# 选项: local（默认）、webdav 或 oss
STORAGE_MODE=local
UPLOAD_DIR=uploads

# ── 下载功能 ─────────────────────────────────────────
DOWNLOAD_ENABLED=false

# ── WebDAV 配置（仅 STORAGE_MODE=webdav 时需要）───────
WEBDAV_URL=http://your-webdav-server/webdav
WEBDAV_USERNAME=admin
WEBDAV_PASSWORD=your_webdav_password
WEBDAV_BASE_PATH=/hoyomusic
WEBDAV_PUBLIC_URL=http://your-webdav-server/webdav/hoyomusic

# ── 阿里云 OSS 配置（仅 STORAGE_MODE=oss 时需要）─────
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_BASE_PATH=hoyomusic
OSS_CDN_DOMAIN=
OSS_SECURE=true
```

### 第四步：创建管理员账户

```bash
cd backend
npm install
npx ts-node src/setup.ts
```

按提示输入管理员用户名和密码。

### 第五步：安装依赖并启动

```bash
# 后端
cd backend
npm install
npm run dev
# 后端运行于 http://localhost:3000

# 新开终端，前端
cd frontend
npm install
npm run dev
# 前端运行于 http://localhost:5173
```

### 一键启动（Windows）

```powershell
# 在项目根目录执行
.\start-dev.ps1
```

脚本会自动检测 Node.js 和 PostgreSQL，在独立窗口分别启动前后端，并在 5 秒后自动打开浏览器。

---

## 🌐 API 文档

### 认证说明

所有标记 `🔒` 的接口需要在请求头携带 JWT Token：

```http
Authorization: Bearer <your_jwt_token>
```

Token 通过 `POST /api/auth/login` 获取，有效期 7 天（可在 `.env` 中配置）。

流媒体接口支持 URL Query Token：`?token=<jwt_token>`

---

### 认证接口

#### `POST /api/auth/login`
用户登录，获取 JWT Token。

**请求体：**
```json
{
  "username": "admin",
  "password": "your_password"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin"
    }
  }
}
```

#### `GET /api/auth/me` 🔒
获取当前登录用户信息。

---

### 曲目接口

#### `GET /api/tracks` 🔒
获取曲目列表，支持分页、搜索、高级筛选。

**Query 参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `limit` | number | 20 | 每页数量 |
| `search` | string | — | 全文搜索（标题/艺术家/专辑） |
| `sample_rate_min` | number | — | 最低采样率（Hz），如 `96000` |
| `bit_depth` | number | — | 位深（16 或 24） |
| `year_from` | number | — | 发行年份起 |
| `year_to` | number | — | 发行年份止 |
| `duration_min` | number | — | 最短时长（秒） |
| `duration_max` | number | — | 最长时长（秒） |
| `tag_ids` | string | — | 逗号分隔的标签 ID，如 `1,3,5` |
| `tag_logic` | `AND`\|`OR` | `AND` | 多标签逻辑 |
| `sort_by` | string | `created_at` | 排序字段 |
| `sort_dir` | `ASC`\|`DESC` | `DESC` | 排序方向 |

**响应：**
```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "id": 1,
        "title": "Mortem Taboo",
        "album_id": 3,
        "album_title": "Honkai Star Rail OST Vol.2",
        "file_path": "/uploads/tracks/xxx.flac",
        "cover_path": "/uploads/covers/xxx.jpg",
        "duration": 243,
        "track_number": 5,
        "sample_rate": 48000,
        "bit_depth": 24,
        "file_size": 52428800,
        "release_date": "2023-11-15",
        "artists": [
          { "id": 12, "name": "HOYO-MiX" }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1243,
      "totalPages": 63
    }
  }
}
```

#### `POST /api/tracks/upload?auto_credits=true` 🔒
上传一个或多个 FLAC 文件。使用 `multipart/form-data`。

**Query 参数：**
| 参数 | 值 | 说明 |
|------|-----|------|
| `auto_credits` | `true`\|`false` | 是否自动提取 Credits |

**Form 字段：**
| 字段 | 说明 |
|------|------|
| `tracks` | FLAC 文件（可多个，最多 20 个） |
| `title_override_<N>` | 第 N 个文件的标题覆盖 |
| `artist_override_<N>` | 第 N 个文件的艺术家覆盖 |
| `album_override_<N>` | 第 N 个文件的专辑覆盖 |
| `credits_override_<N>` | 第 N 个文件的 Credits JSON（`[{key,value}]`） |

#### `POST /api/tracks/preview-credits` 🔒
预解析 FLAC 文件的 Credits，**不写入数据库**。

**响应：**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "filename": "Mortem Taboo.flac",
        "credits": [
          { "key": "COMPOSER", "value": "Yan Jian" },
          { "key": "ARRANGER", "value": "Yan Jian" },
          { "key": "LYRICIST", "value": "Penka Kouneva" }
        ]
      }
    ]
  }
}
```

#### `GET /api/tracks/:id` 🔒
获取单首曲目详情。

#### `PUT /api/tracks/:id` 🔒
更新曲目元数据（标题、艺术家、专辑、发行日期、曲序）。

#### `DELETE /api/tracks/:id` 🔒
删除曲目（同时删除存储文件）。

#### `DELETE /api/tracks/bulk` 🔒
批量删除曲目。请求体：`{ "ids": [1, 2, 3] }`

#### `POST /api/tracks/bulk-move` 🔒
批量移动到指定专辑。请求体：`{ "trackIds": [1,2], "albumId": 5 }`

#### `GET /api/tracks/:id/stream`
流式传输音频文件，支持 HTTP Range 请求（进度拖拽）。Token 可通过 Query 参数传入。

#### `GET /api/tracks/:id/download`
下载音频文件。**目前已关闭（服务器维护）**，返回 HTTP 503。

---

### 公开接口（无需认证）

#### `GET /api/public/tracks`
同 `/api/tracks`，无需认证，可供游客访问。

#### `GET /api/public/tracks/:id`
获取单首曲目详情（公开）。

#### `GET /api/public/tracks/:id/stream`
公开流媒体（无需 Token）。

---

### 专辑接口

#### `GET /api/albums` 🔒
获取所有专辑列表。

#### `GET /api/albums/:id`
获取专辑详情及曲目列表（含统计信息）。

#### `POST /api/albums` 🔒
创建专辑。

#### `PUT /api/albums/:id` 🔒
更新专辑信息。

#### `DELETE /api/albums/:id` 🔒
删除专辑。

#### `POST /api/albums/:id/cover` 🔒
上传专辑封面（`multipart/form-data`，字段名 `cover`）。

---

### 游戏接口

#### `GET /api/games`
获取所有游戏列表（含专辑数量统计）。

#### `GET /api/games/:id`
获取游戏详情及所属专辑列表。

---

### Credits 接口

#### `GET /api/credits/:trackId/credits`
获取曲目的制作人员列表。

**响应：**
```json
{
  "success": true,
  "data": {
    "credits": [
      {
        "id": 1,
        "credit_key": "COMPOSER",
        "credit_value": "Yan Jian",
        "display_order": 0
      }
    ]
  }
}
```

#### `POST /api/credits/:trackId/credits` 🔒
添加一条 Credit。请求体：`{ "credit_key": "COMPOSER", "credit_value": "Yan Jian" }`

#### `PUT /api/credits/:trackId/credits/:creditId` 🔒
更新一条 Credit。

#### `DELETE /api/credits/:trackId/credits/:creditId` 🔒
删除一条 Credit。

---

### 歌词接口

#### `GET /api/lyrics/:trackId/lyrics`
获取歌词内容（LRC 格式文本）。

#### `POST /api/lyrics/:trackId/lyrics` 🔒
上传 LRC 歌词文件（`multipart/form-data`）。

---

### 标签接口

#### `GET /api/tags`
获取标签树（带层级关系）。

#### `POST /api/tags` 🔒
创建标签。

#### `GET /api/tags/:id`
获取标签详情及关联曲目。

#### `POST /api/tags/:tagId/tracks/:trackId` 🔒
为曲目添加标签。

#### `DELETE /api/tags/:tagId/tracks/:trackId` 🔒
移除曲目标签。

---

### 错误响应格式

所有接口的错误均遵循以下格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
  }
}
```

| 常见错误码 | HTTP 状态 | 含义 |
|-----------|----------|------|
| `UNAUTHORIZED` | 401 | 未提供或无效的 JWT Token |
| `FORBIDDEN` | 403 | 无访问权限 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `VALIDATION_ERROR` | 400 | 请求参数错误 |
| `UPLOAD_ERROR` | 500 | 文件上传失败 |
| `DOWNLOAD_DISABLED` | 503 | 下载功能已关闭 |

---

## 🏗️ 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    浏览器（Client）                   │
│  React + Vite + TypeScript + Ant Design              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │  页面路由 │ │ 状态管理  │ │   组件（Player等）    │ │
│  │ (Router) │ │(Zustand) │ │                      │ │
│  └──────────┘ └──────────┘ └──────────────────────┘ │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP/REST API (axios)
                        │ JWT Bearer Token
┌───────────────────────▼─────────────────────────────┐
│                  后端（Server :3000）                 │
│  Express + TypeScript + Node.js                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │  Router  │ │Middleware│ │    Controllers        │ │
│  │          │ │(JWT/     │ │  (业务逻辑)           │ │
│  │          │ │ Multer)  │ │                      │ │
│  └──────────┘ └──────────┘ └──────────┬───────────┘ │
│                                       │             │
│  ┌────────────────────────────────────▼───────────┐ │
│  │              Storage Service                   │ │
│  │  ┌──────────────────┐  ┌────────────────────┐  │ │
│  │  │  本地文件系统      │  │   WebDAV 服务器    │  │ │
│  │  │ (uploads/)       │  │ (Nginx/Nextcloud)  │  │ │
│  │  └──────────────────┘  └────────────────────┘  │ │
│  └────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────┘
                        │ pg Pool (TCP :5432)
┌───────────────────────▼─────────────────────────────┐
│                 PostgreSQL 数据库                     │
│  tracks, albums, artists, games, tags, credits...    │
└─────────────────────────────────────────────────────┘
```

### 前端状态管理

```
Zustand Store
├── playerStore
│   ├── currentTrack: Track | null
│   ├── playlist: Track[]
│   ├── isPlaying: boolean
│   ├── progress: number (0-1)
│   ├── volume: number (0-1)
│   ├── isFullscreen: boolean      ← 全屏播放器模式
│   ├── play(track) / pause()
│   ├── next() / prev()
│   ├── seek(position)
│   ├── addToPlaylist(track)
│   ├── setPlaylist(tracks)
│   └── playTrackOnly(track)       ← 只播放不替换队列
│
└── authStore
    ├── user: User | null
    ├── token: string | null
    ├── isAuthenticated: boolean
    ├── isInitialized: boolean     ← 防止未初始化时渲染登录页
    ├── setUser / setToken
    ├── logout()
    └── initializeAuth()          ← 从 localStorage 恢复状态
```

### 文件上传处理流程

```
前端选择 FLAC 文件
    ↓
Step 1: 编辑元数据（可选覆盖标题/艺术家/专辑）
    ↓
Step 2: POST /api/tracks/preview-credits（后端解析 Credits 预览）
    ↓
用户可编辑/添加/删除 Credit 键值对
    ↓
Step 3: POST /api/tracks/upload?auto_credits=true（正式上传）
    │  multipart/form-data:
    │    - tracks: File（FLAC 二进制）
    │    - title_override_0: "..."
    │    - credits_override_0: JSON([{key,value},...])
    ↓
后端 Multer 接收（memoryStorage，最大 500MB）
    ↓
music-metadata parseBuffer() 解析 FLAC 元数据
    ↓
提取: 标题、艺术家、专辑、封面图片、时长、采样率、位深
    ↓
Storage Service:
    ├── 本地: 写入 uploads/tracks/<uuid>.flac
    └── WebDAV: PUT /hoyomusic/tracks/<uuid>.flac
    ↓
PostgreSQL 事务:
    ├── 查找/创建 Album
    ├── INSERT tracks
    ├── 查找/创建 Artists
    ├── INSERT track_artists
    └── INSERT track_credits（使用 credits_override 或自动解析）
    ↓
返回 { id, title, artists, album }
```

### JWT 认证流程

```
登录:
  POST /api/auth/login { username, password }
  → bcrypt.compare(password, hash)
  → jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' })
  → 返回 token

请求认证:
  axios 拦截器自动附加 Authorization: Bearer <token>
  → passport-jwt 中间件提取并验证 token
  → req.user = { id, username }

Token 刷新:
  前端 axios 响应拦截器检测 401
  → 清除本地 token
  → 重定向到 /login
```

---

## 🎨 主题系统

HoYoMusic 使用基于 CSS 自定义属性的双主题系统，通过 `data-theme` 属性切换。

### CSS 变量一览

```css
/* 浅色主题（data-theme="light"） */
--bg-primary:        #ffffff
--bg-secondary:      #f5f5f5
--bg-tertiary:       #fafafa
--text-primary:      #1a1a2e
--text-secondary:    #666666
--text-muted:        #999999
--border-primary:    #e0e0e0
--border-secondary:  #f0f0f0
--shadow-sm:         0 1px 3px rgba(0,0,0,0.08)
--shadow-md:         0 4px 12px rgba(0,0,0,0.10)
--shadow-lg:         0 8px 32px rgba(0,0,0,0.12)
--accent-primary:    #667eea
--accent-secondary:  #764ba2

/* 深色主题（data-theme="dark"） */
--bg-primary:        #0a0818
--bg-secondary:      #130f2a
--bg-tertiary:       #1c1735
--text-primary:      #e8e6f0
--text-secondary:    #a09db8
--text-muted:        #6b6884
--border-primary:    #2e2855
--border-secondary:  #241f45
...
```

### 主题切换实现

```typescript
// themeStore 中切换
const toggleTheme = () => {
  const next = theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  setTheme(next);
};

// Ant Design Token 同步
const antdTheme = theme === 'dark' ? { algorithm: darkAlgorithm } : {};
<ConfigProvider theme={antdTheme}>...</ConfigProvider>
```

---

## 📦 部署指南

### 生产环境（PM2 + Nginx）

#### 1. 编译前端

```bash
cd frontend
npm run build
# 产物在 frontend/dist/
```

#### 2. 编译后端

```bash
cd backend
npm run build
# 产物在 backend/dist/
```

#### 3. Nginx 配置

```nginx
server {
    listen 80;
    server_name music.yourdomain.com;

    # 前端静态文件
    root /var/www/hoyomusic/frontend/dist;
    index index.html;

    # 前端 SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # 大文件上传超时
        proxy_read_timeout 600s;
        client_max_body_size 500m;
    }

    # 本地存储模式：静态文件服务
    location /uploads/ {
        alias /var/www/hoyomusic/backend/uploads/;
        # 音频文件缓存
        location ~* \.(flac)$ {
            add_header Cache-Control "public, max-age=86400";
            add_header Accept-Ranges bytes;
        }
    }
}
```

#### 4. PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动后端
cd /var/www/hoyomusic/backend
pm2 start dist/index.js --name hoyomusic-backend

# 保存并设置开机自启
pm2 save
pm2 startup
```

#### 5. 生产环境变量

```ini
NODE_ENV=production
PORT=3000
JWT_SECRET=<use a 64-character random string>
# 推荐使用 WebDAV 存储（如 Nextcloud）
STORAGE_MODE=webdav
WEBDAV_URL=https://your-nextcloud.com/remote.php/dav/files/user/
```

### Docker 部署（可选）

```dockerfile
# backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: hoyomusic
      POSTGRES_USER: hoyomusic_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DB_HOST: db
      DB_NAME: hoyomusic
      DB_USER: hoyomusic_user
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      STORAGE_MODE: local
    volumes:
      - uploads:/app/uploads
    depends_on:
      - db

volumes:
  pgdata:
  uploads:
```

---

## 🔧 开发指南

### 环境配置

```bash
# 前端环境变量（frontend/.env.development）
VITE_API_URL=http://localhost:3000/api

# 前端生产环境（frontend/.env.production）
VITE_API_URL=https://music.yourdomain.com/api
```

### 开发脚本

```bash
# 后端
npm run dev      # nodemon + ts-node，热重载
npm run build    # tsc 编译为 dist/
npm run start    # node dist/index.js（生产）
npm run setup    # 初始化数据库、创建管理员

# 前端
npm run dev      # Vite 开发服务器（:5173，HMR）
npm run build    # Vite 生产构建
npm run preview  # 预览生产构建
```

### 添加新游戏

1. 在数据库 `games` 表插入记录：

```sql
INSERT INTO games (name, name_en, description, cover_path, display_order)
VALUES ('新游戏名', 'New Game Name', '描述', '/games/newgame.png', 10);
```

2. 将游戏封面图片放到 `frontend/public/games/` 目录

3. 在 `GameDetail.tsx` 的 `getGameClass()` 函数中添加背景类映射

4. 在 `GameDetail.css` 中添加对应背景样式

5. 将背景图片放到 `frontend/public/` 目录（如 `newgame-bg.jpg`）

### 添加新 API 接口

1. 在 `backend/src/controllers/` 创建或修改 Controller
2. 在 `backend/src/routes/` 注册路由
3. 在 `frontend/src/services/` 添加对应的 Service 方法
4. TypeScript 类型定义更新 `frontend/src/types/index.ts`

### 调试技巧

```bash
# 后端请求日志（开发模式自动输出）
# 查看 PostgreSQL 查询：在 database.ts 中临时添加 console.log

# 前端网络请求
# 浏览器 DevTools → Network → XHR

# 数据库直接查询
psql -U hoyomusic_user -d hoyomusic
\dt              # 列出所有表
SELECT COUNT(*) FROM tracks;
SELECT * FROM tracks ORDER BY created_at DESC LIMIT 5;
```

---

## 🎮 游戏支持列表

| 游戏 | 状态 | 背景图 | 说明 |
|------|------|--------|------|
| 原神 (Genshin Impact) | ⚙️ 维护中 | `genshin-bg.png` | 数据整理中 |
| 崩坏：星穹铁道 (Honkai: Star Rail) | ⚙️ 维护中 | `starrail-bg.png` | 数据整理中 |
| 崩坏3 (Honkai Impact 3rd) | ⚙️ 维护中 | `games/honkai3.png` | 数据整理中 |
| 绝区零 (Zenless Zone Zero) | ✅ 活跃 | `zzz-bg.jpg` | 正常访问 |
| 未定事件簿 (Tears of Themis) | ⚙️ 维护中 | `games/tears.jpg` | 数据整理中 |
| 崩坏因缘精灵 | 🔜 未发行 | — | 敬请期待 |
| 星布谷地 | 🔜 未发行 | — | 敬请期待 |

游戏状态由 `Home.tsx` 中的 `MAINTENANCE_GAMES` / `UNRELEASED_GAMES` 数组控制，无需修改数据库。

---

## 🔒 安全说明

### 当前实现

- 密码使用 `bcryptjs`（默认 10 轮 salt）哈希存储，明文密码不落库
- JWT Token 服务端无状态，有效期 7 天
- 所有管理端 API 均需 JWT 认证
- 流媒体接口支持 Token 鉴权
- 文件上传类型仅限 FLAC（通过扩展名和 MIME 类型双重校验）
- 文件大小上限 500MB（Multer + Nginx 均配置）

### 生产建议

- 使用至少 64 字符随机字符串作为 `JWT_SECRET`
- 启用 HTTPS（Let's Encrypt 免费证书）
- 数据库不要使用默认端口或开放公网访问
- 定期备份 PostgreSQL 数据（`pg_dump`）和 uploads 目录
- 考虑添加请求频率限制（`express-rate-limit`）

---

## 🗺️ 路线图

> 详细路线图请查看 **[ROADMAP.md](ROADMAP.md)**（含 5 个阶段、50+ 项功能规划）
> 
> 优化报告请查看 **[OPTIMIZATION_REPORT.md](OPTIMIZATION_REPORT.md)**

### 已完成 ✅

- [x] 基础音乐库（曲目/专辑/艺术家）
- [x] JWT 认证管理后台
- [x] FLAC 流媒体播放器
- [x] LRC 歌词同步
- [x] Credits / 制作人员系统
- [x] 层级标签系统
- [x] 高级搜索与筛选
- [x] 深/浅色主题
- [x] 游戏分类导航
- [x] 全屏播放器 + 歌词
- [x] 高级 5 步骤导入向导
- [x] Credits 预览与可视化编辑
- [x] 本地/WebDAV 双存储模式
- [x] 批量导入、批量删除、批量移动
- [x] 下载功能全局开关（维护期关闭）

### 计划中 🔜

- [ ] 更多音频格式支持（APE、WAV、DSD）
- [ ] 播放列表保存与分享
- [ ] 音乐可视化（频谱图）
- [ ] 移动端 PWA
- [ ] 批量编辑元数据
- [ ] 歌词在线搜索与自动匹配
- [ ] 专辑批量导入（ZIP 压缩包）
- [ ] 多用户权限系统

---

## 🤝 常见问题（FAQ）

**Q: 为什么只支持 FLAC 格式？**
A: HoYoMusic 定位为「无损收藏平台��，FLAC 是目前最广泛支持的无损压缩音频格式，能在最小文件体积下保留 100% 音频质量。后续计划支持 APE、WAV 等其他无损格式。

**Q: WebDAV 模式有什么优势？**
A: 本地模式适合小规模部署，文件存在服务器本地。WebDAV 模式适合大容量场景（如家用 NAS、Nextcloud），文件实际存储在 WebDAV 服务器，API 服务器只存储元数据，不需要大磁盘。

**Q: 如何批量导入大量 FLAC 文件？**
A: 进入管理后台，点击「导入」按钮，在弹出的导入向导中可一次性拖拽数十个文件进行批量导入。系统会逐文件处理，实时显示进度。

**Q: Credits 信息从哪里来？**
A: 系统从 FLAC 文件内嵌的 Vorbis Comment（或 ID3v2 标签）自动提取 Credits 信息。常见的 Credits 字段包括 COMPOSER（作曲）、ARRANGER（编曲）、LYRICIST（作词）、PERFORMER（演唱）等。如果文件没有嵌入 Credits，可在导入向导的第 2 步手动添加。

**Q: 为什么下载功能不可用？**
A: 目前由于服务器压力，已临时关闭下载功能。恢复方法：将 `frontend/src/services/trackService.ts` 和后端路由文件中的 `DOWNLOAD_ENABLED = false` 改为 `true`，重启后端即可。

**Q: 如何修改管理员密码？**
A: 目前需要直接更新数据库：
```sql
UPDATE users
SET password_hash = '<bcrypt_hash>'
WHERE username = 'admin';
```
可用 [bcrypt 在线工具](https://bcrypt-generator.com/) 生成新哈希（10 轮）。

---

## 📄 许可证

本项目仅供个人学习和私有化部署使用。

游戏音乐版权归米哈游（miHoYo Co., Ltd. / HoYoverse）所有。本平台仅为个人收藏目的，请勿将音乐用于商业用途或公开分发。

---

<div align="center">

Made with ❤️ for HoYoverse music fans

*「身边的音符，永恒的旋律」*

</div>
