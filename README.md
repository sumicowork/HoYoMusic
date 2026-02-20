# HoYoMusic MVP 🎵

高品质无损音乐收藏与播放平台 - MVP 版本

## 项目结构

```
HoYoMusic/
├── backend/          # Node.js + Express 后端
├── frontend/         # React + TypeScript 前端
└── PRD.md           # 产品需求文档
```

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- PostgreSQL
- JWT + Passport.js
- Multer (文件上传)
- music-metadata (元数据提取)

### 前端
- React + TypeScript
- Vite
- Ant Design
- Zustand (状态管理)
- Howler.js (音频播放)
- Axios

## 功能特性 (MVP)

- ✅ 用户登录认证
- ✅ FLAC 文件批量上传
- ✅ 自动提取元数据和封面
- ✅ 音乐列表浏览
- ✅ 无损音频播放（播放/暂停、进度控制、音量控制）
- ✅ 单曲下载
- ✅ 持久化底部播放器

## 开发环境要求

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm 或 yarn

## 快速开始

### 1. 数据库设置

首先，确保 PostgreSQL 已安装并运行。

创建数据库：

```bash
psql -U postgres
CREATE DATABASE hoyomusic;
\q
```

### 2. 后端设置

```bash
cd backend

# 安装依赖（已完成）
npm install

# 配置环境变量
# 编辑 .env 文件，设置数据库密码等配置

# 初始化数据库（创建表结构和管理员账户）
npm run setup

# 启动开发服务器
npm run dev
```

后端将运行在 http://localhost:3000

默认管理员账户：
- 用户名: `admin`
- 密码: `admin123`

### 3. 前端设置

打开新的终端：

```bash
cd frontend

# 安装依赖（已完成）
npm install

# 启动开发服务器
npm run dev
```

前端将运行在 http://localhost:5173

### 4. 开始使用

1. 访问 http://localhost:5173
2. 使用管理员账户登录（admin/admin123）
3. 点击 "Upload FLAC Files" 上传音乐
4. 在列表中点击 "Play" 按钮播放音乐
5. 使用底部播放器控制播放

## API 端点

### 认证
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 音乐
- `POST /api/tracks/upload` - 上传音乐（支持批量）
- `GET /api/tracks` - 获取音乐列表（支持分页）
- `GET /api/tracks/:id` - 获取单个音乐详情
- `GET /api/tracks/:id/stream` - 流式播放音乐
- `GET /api/tracks/:id/download` - 下载音乐

## 项目脚本

### 后端

```bash
npm run dev      # 开发模式运行
npm run build    # 编译 TypeScript
npm run start    # 生产模式运行
npm run setup    # 初始化数据库
```

### 前端

```bash
npm run dev      # 开发模式运行
npm run build    # 构建生产版本
npm run preview  # 预览生产版本
```

## 开发说明

### 文件上传
- 仅支持 FLAC 格式
- 默认最大文件大小: 500MB
- 支持批量上传（最多 20 个文件）

### 音频播放
- 使用 Howler.js 实现无损播放
- 支持 HTTP Range Requests（拖动播放）
- 自动提取 FLAC 内嵌元数据和封面

### 数据库
- 自动创建索引优化查询性能
- 支持艺术家、专辑、曲目的关联
- 使用事务保证数据一致性

## 下一步计划

根据 PRD 文档，接下来将实现：

**Phase 2: 完整功能**
- 歌词上传与同步显示
- Credits 信息管理
- 多维度分类系统
- 播放列表管理
- 专辑批量下载
- 搜索功能

**Phase 3: 优化与增强**
- UI/UX 优化
- 深色/浅色主题
- 快捷键支持
- 性能优化

## 注意事项

⚠️ **安全提示**：
- 默认密码仅用于开发环境
- 生产环境请修改 JWT_SECRET 和管理员密码
- 建议配置 HTTPS（使用 Nginx）

⚠️ **开发提示**：
- uploads 文件夹在 .gitignore 中，不会被提交
- 确保 PostgreSQL 服务正在运行
- 后端和前端需要同时运行

## 许可证

ISC

---

**HoYoMusic** - 为音乐发烧友打造的高品质音乐平台 🎵

