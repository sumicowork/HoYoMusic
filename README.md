# 🎵 HoYoMusic

> HoYoverse 游戏音乐管理与在线播放平台

[![CI](https://github.com/your-repo/hoyomusic/actions/workflows/ci.yml/badge.svg)](https://github.com/your-repo/hoyomusic/actions)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-20-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)

---

## 📖 项目简介

HoYoMusic 是一个专为 HoYoverse (米哈游) 游戏音乐爱好者打造的自托管音乐管理平台。支持 FLAC 无损音频的上传、管理、在线播放与歌词同步展示。涵盖《原神》《崩坏：星穹铁道》《绝区零》《崩坏3》《未定事件簿》等全系列游戏的原声音乐。

### 核心特色

- 🎧 **FLAC 无损播放** — 支持 Hi-Res 无损音频在线流式播放
- 📝 **同步歌词** — LRC 歌词逐行高亮，点击歌词跳转播放
- 🏷️ **多维标签** — 层级标签分组、多标签筛选 (AND/OR 逻辑)
- 🎮 **游戏分类** — 按游戏 → 专辑 → 曲目三级架构管理
- 👥 **制作人员 (Credits)** — 自动解析 FLAC 元数据中的制作信息
- 📊 **访问分析** — 完整的访问统计仪表盘（地理、设备、性能）
- 🌙 **三色主题** — 浅色 / 深色 / OLED纯黑 主题切换
- 📱 **响应式布局** — 移动端完整适配，PWA 支持
- 🔒 **安全加固** — Helmet/CORS/Rate Limit/Zod验证/文件类型校验

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  React 19 + TypeScript + Ant Design + Vite  │
│  Zustand (状态管理) + Howler.js (音频)      │
│  Recharts (图表) + React Router             │
├─────────────────────────────────────────────┤
│                  Backend                     │
│  Express.js + TypeScript + PostgreSQL        │
│  Passport JWT + Sharp (图片处理)             │
│  Swagger UI (API文档) + Pino (日志)         │
├─────────────────────────────────────────────┤
│               Storage                        │
│  Local / Aliyun OSS / WebDAV                │
└─────────────────────────────────────────────┘
```

---

## ✅ 已完成功能

### 前端 (React 19 + Vite)

| 模块 | 功能 |
|------|------|
| **首页** | 游戏卡片、随机专辑轮播、随机推荐、热门曲目排行 |
| **搜索** | 全文搜索、高级筛选（游戏/艺术家/年份/时长/标签）、搜索历史 |
| **播放器** | FLAC流式播放、进度条、音量控制、播放模式（顺序/循环/随机/单曲） |
| **播放器增强** | 播放速度(0.5x~2x)、A-B循环、睡眠定时器、淡入淡出、全屏歌词 |
| **歌词** | LRC解析、逐行高亮、自动滚动、点击跳转 |
| **收藏** | 单曲收藏（红心按钮）、收藏页面 |
| **播放列表** | 创建/编辑/删除、添加/移除曲目 |
| **管理后台** | 曲目/专辑/标签/游戏/艺术家管理 |
| **标签系统** | 层级标签、标签分组、批量打标 |
| **Credits** | FLAC元数据自动解析、在线编辑、批量导入 |
| **访问统计** | 趋势图、地理分布、设备统计、性能监控、存储分析 |
| **主题** | 浅色/深色/OLED纯黑 三模式切换 |
| **PWA** | Web App Manifest、Media Session API (锁屏控件) |
| **键盘快捷键** | 空格播放、方向键控制、M静音、L切换模式 |
| **设置** | 修改密码、数据导出 (JSON/CSV)、API文档入口 |

### 后端 (Express + TypeScript)

| 模块 | 功能 |
|------|------|
| **认证** | JWT Token、Passport Local策略、密码修改 |
| **曲目管理** | FLAC上传/流式播放/下载、元数据解析 (music-metadata) |
| **专辑管理** | CRUD、封面上传、缩略图自动生成 (Sharp) |
| **游戏管理** | CRUD、排序、状态管理 |
| **标签管理** | 层级标签、分组、批量操作 |
| **艺术家** | 自动提取、合并去重、搜索 |
| **Credits** | FLAC Vorbis Comment 解析、自定义编辑 |
| **歌词** | LRC上传/查询 |
| **收藏** | 收藏/取消收藏/列表查询 |
| **播放列表** | CRUD、曲目排序管理 |
| **分析** | 访问统计、存储分析、数据导出、重复检测 |
| **播放统计** | 播放次数记录、热门排行 |
| **存储** | 本地 / 阿里云OSS / WebDAV 三模式 |
| **API文档** | Swagger UI (`/api/docs`) |

### 安全

| 措施 | 说明 |
|------|------|
| Helmet | XSS/CSP/HSTS 安全响应头 |
| CORS | 域名白名单 (`CORS_ORIGINS`) |
| Rate Limit | 全局 300req/min + 登录 10req/15min |
| Zod | 请求体参数校验 |
| Multer | 文件大小限制 + 磁盘临时存储 |
| file-type | 魔术字节深度校验 |
| 错误脱敏 | 生产模式隐藏堆栈信息 |
| SHA-256 | 文件完整性哈希 |

### DevOps

| 项目 | 说明 |
|------|------|
| Docker | 后端/前端 Dockerfile + docker-compose.prod.yml |
| CI/CD | GitHub Actions 自动构建检查 |
| 测试 | Jest 单元测试 (22 tests, 3 suites) |
| 日志 | Pino 结构化日志 |

---

## 🚀 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 16+
- npm 或 pnpm

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/hoyomusic.git
cd hoyomusic
```

### 2. 后端配置

```bash
cd backend
cp .env.example .env   # 编辑环境变量
npm install
npm run setup          # 初始化数据库和管理员账户
npm run dev            # 启动开发服务器 (localhost:3000)
```

`.env` 关键配置：
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hoyomusic
DB_USER=hoyomusic
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
STORAGE_MODE=local
DOWNLOAD_ENABLED=true
```

### 3. 前端配置

```bash
cd frontend
npm install
npm run dev            # 启动开发服务器 (localhost:5173)
```

### 4. Docker 部署

```bash
# 设置环境变量
export JWT_SECRET=your_secret_key
export DB_PASSWORD=your_db_password

# 启动
docker compose -f docker-compose.prod.yml up -d
```

---

## 📁 项目结构

```
HoYoMusic/
├── backend/
│   ├── src/
│   │   ├── index.ts              # 入口 + Express 应用 + 数据库迁移
│   │   ├── setup.ts              # 初始化脚本（创建管理员）
│   │   ├── config/               # 数据库/OSS/Passport/WebDAV/Swagger配置
│   │   ├── controllers/          # 业务逻辑控制器
│   │   ├── middleware/           # 认证/上传/错误处理/日志中间件
│   │   ├── routes/               # API路由定义
│   │   ├── services/             # 存储抽象层（Local/OSS/WebDAV）
│   │   ├── utils/                # 工具函数（缓存/日志/缩略图/元数据）
│   │   └── validators/           # Zod 请求体校验
│   ├── tests/                    # Jest 单元测试
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # 路由 + 主题配置
│   │   ├── components/           # 可复用组件（Player/SideNav/Modal等）
│   │   ├── pages/                # 页面组件
│   │   ├── services/             # API 调用层
│   │   ├── store/                # Zustand 状态管理
│   │   ├── theme/                # 主题配置 + CSS变量
│   │   ├── types/                # TypeScript 类型定义
│   │   └── utils/                # 工具函数
│   ├── public/                   # 静态资源
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.prod.yml
├── .github/workflows/ci.yml
├── ROADMAP.md
└── README.md
```

---

## 🔌 API 文档

启动后端后访问 `/api/docs` 查看 Swagger UI 文档。

主要端点：

| 端点 | 说明 |
|------|------|
| `POST /api/auth/login` | 用户登录 |
| `POST /api/auth/change-password` | 修改密码 |
| `GET /api/public/tracks` | 公开曲目搜索 |
| `GET /api/public/tracks/:id/stream` | 流式播放 |
| `GET /api/public/top-tracks` | 热门曲目 |
| `GET /api/games` | 游戏列表 |
| `GET /api/albums` | 专辑列表 |
| `GET /api/tags` | 标签列表 |
| `POST /api/tracks/upload` | 上传曲目 (需认证) |
| `GET /api/analytics/overview` | 访问概览 (需认证) |
| `GET /api/analytics/storage` | 存储分析 (需认证) |
| `GET /api/analytics/export` | 数据导出 (需认证) |
| `GET /api/playlists` | 播放列表 (需认证) |
| `POST /api/favorites/toggle` | 切换收藏 (需认证) |
| `GET /api/health` | 健康检查 |

---

## ⌨️ 键盘快捷键

| 按键 | 功能 |
|------|------|
| `Space` | 播放 / 暂停 |
| `← / →` | 快退 / 快进 5 秒 |
| `↑ / ↓` | 音量增 / 减 |
| `M` | 静音 / 恢复 |
| `L` | 循环模式切换 |
| `Escape` | 收起播放器 |

---

## 🗺️ 路线图

详见 [ROADMAP.md](ROADMAP.md)

---

## 📜 License

MIT

---

<div align="center">
  <sub>Built with ❤️ for HoYoverse music lovers</sub>
</div>
