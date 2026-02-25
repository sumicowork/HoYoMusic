# HoYoMusic — 项目状态报告 & 未来开发方向

**生成日期**: 2026-02-21  
**报告版本**: v3.5  
**对应 PRD 版本**: v1.1

---

## 目录

1. [整体完成度](#整体完成度)
2. [Bug 追踪](#bug-追踪)
3. [版本变更历史](#版本变更历史)
4. [当前架构](#当前架构)
5. [导入向导完整流程](#导入向导完整流程)
6. [API 端点汇总](#api-端点汇总)

---

## 整体完成度

| 模块 | 状态 | 完成度 |
|------|------|--------|
| 后端 API | ✅ 已完成 | 100% |
| 数据库模型 | ✅ 已完成 | 100% |
| 用户认证 | ✅ 已完成 | 100% |
| 音频存储（本地/WebDAV） | ✅ 已完成 | 100% |
| 前端公共播放页 | ✅ 已完成 | 100% |
| 全屏播放器 + 歌词 | ✅ 已完成 | 100% |
| 管理后台 | ✅ 已完成 | 100% |
| 高级导入向导（5步骤） | ✅ 已完成 | 100% |
| Credits 预览与可编辑 | ✅ 已完成 | 100% |
| 主题系统（深/浅色） | ✅ 已完成 | 100% |
| 登录状态自动检测跳转 | ✅ 已完成 | 100% |

---

## Bug 追踪

| ID | 状态 | 描述 | 修复版本 |
|----|------|------|---------|
| B01–B10 | ✅ 已修复 | 早期各类基础 bug | v1.x–v2.x |
| B11 | ✅ 已修复 | 导入向导不完善、无 Credits 开关 | v3.0 |
| B12 | ✅ 已修复 | 全屏播放器未实现 | v3.0 |
| B13 | ✅ 已修复 | 导入向导步骤2编辑的元数据未传给后端（编辑无效） | v3.1 |
| B14 | ✅ 已修复 | auto_credits 开关不起作用（stale closure + 字段缺失） | v3.1 |
| B15 | ✅ 已修复 | Credits 决策位置不对，且不能预览 Credits 内容 | v3.2 |
| B16 | ✅ 已修复 | 已登录状态访问 /admin/login 仍显示登录表单 | v3.2 |
| B17 | ✅ 已修复 | Credits 预览显示空（music-metadata-browser 包不完整） | v3.3 |
| B18 | ✅ 已修复 | 忽略 Credits 时仍写入（multipart body 字段顺序问题） | v3.3 |
| B19 | ✅ 已修复 | /api/tracks/preview-credits 404（后端未重启） | v3.3 |
| B20 | ✅ 已修复 | Credits 预览页只读，不能修改/添加/删除键值对 | v3.4 |

---

## 版本变更历史

### v3.5（2026-02-21）— 下载功能关闭（服务器维护）

| 类别 | 说明 |
|------|------|
| **下载全局开关** | 前端 `trackService.ts` 顶部新增 `export const DOWNLOAD_ENABLED = false`；后端 `trackRoutes.ts` 和 `publicRoutes.ts` 各自新增 `DOWNLOAD_ENABLED` 常量和 `downloadDisabled` 中间件 |
| **前端 UI** | 所有 8 处下载按钮（AlbumDetail×2、ArtistDetail、Library、PublicLibrary、TagDetail、TrackDetail、Search）均改为 `disabled={!DOWNLOAD_ENABLED}`，并用 `Tooltip` 包裹显示「服务器维护中，暂时关闭下载」提示 |
| **后端 API** | `GET /api/tracks/:id/download` 和 `GET /api/public/tracks/:id/download` 在 `DOWNLOAD_ENABLED=false` 时直接返回 `HTTP 503 DOWNLOAD_DISABLED`，防止绕过前端直接访问 |
| **恢复方法** | 将 `frontend/src/services/trackService.ts` 中 `DOWNLOAD_ENABLED = false` 改为 `true`，同时将 `backend/src/routes/trackRoutes.ts` 和 `publicRoutes.ts` 中的 `DOWNLOAD_ENABLED = false` 改为 `true`，重启后端即可恢复 |
| **构建验证** | 前后端均 exit 0，Vite 生产构建成功 |

---

### v3.4（2026-02-21）

| 类别 | 说明 |
|------|------|
| **Credits 预览可编辑** | Step 2 由只读 Table 改为内联可编辑列表：每行直接修改 KEY/VALUE 输入框，支持删除任意行，右上角「添加行」可新增 credit |
| **编辑结果传入后端** | `trackService.uploadTracks` 新增 `creditsOverrides` 参数，将编辑后的 credits 序列化为 JSON（`credits_override_<idx>`）附带 FormData |
| **后端优先使用覆盖值** | `uploadTracks` 新增对 `credits_override_<idx>` 的读取：存在则直接写入，跳过自动解析；不存在则保持原有自动解析逻辑 |
| **代码清理** | 移除不再使用的 `creditColumns` 变量和 antd `Table` import |
| **构建验证** | Vite 生产构建成功（exit 0），0 TypeScript 错误 |

---

### v3.3（2026-02-21）

| 类别 | 说明 |
|------|------|
| **Bug Fix — Credits 预览显示空** | 卸载安装不完整的 `music-metadata-browser`，改为后端 `POST /api/tracks/preview-credits` API 方案，复用与 `uploadTracks` 完全相同的解析逻辑 |
| **Bug Fix — 忽略 Credits 时仍写入** | `auto_credits` 改为通过 URL query string 传递（`?auto_credits=false`），后端优先读 `req.query.auto_credits`，彻底绕开 multipart body 字段顺序问题 |
| **新 API** | `POST /api/tracks/preview-credits`：批量预解析 FLAC Credits，返回 `[{filename, credits:[{key,value}]}]`，不写数据库 |

---

### v3.2（2026-02-21）

| 类别 | 说明 |
|------|------|
| **导入向导重构为 5 步骤** | Step 1 底部新增 Credits 决策开关；开启 → Step 2（Credits 预览）；关闭 → 直接 Step 3（导入） |
| **Login 自动跳转** | 检测 `isAuthenticated`，已登录则 `navigate('/admin', {replace:true})`，未初始化时显示 Spin |

---

### v3.1（2026-02-21）

| 类别 | 说明 |
|------|------|
| **Bug Fix — 元数据编辑无效** | 后端支持 `title_override_<idx>` / `artist_override_<idx>` / `album_override_<idx>` 覆盖字段 |
| **Bug Fix — auto_credits 不生效** | 始终明确传字段；`handleStartUpload` 快照局部变量消除 stale closure |

---

### v3.0（2026-02-21）

| 类别 | 说明 |
|------|------|
| **高级导入向导** | 4 步骤向导，支持元数据编辑、Credits 开关、实时进度 |
| **全屏播放器 + 歌词** | 点击底部播放栏展开全屏，左封面右滚动歌词，Esc 收起 |
| **播放器主题** | 移除封面模糊背景，完全跟随深/浅色主题变色 |

---

## 当前架构

### 后端（Node.js + Express + TypeScript）

```
backend/src/
├── controllers/
│   ├── trackController.ts      ← 上传(支持元数据/credits覆盖)、预览Credits、CRUD
│   ├── albumController.ts
│   ├── creditsController.ts
│   ├── lyricsController.ts
│   └── ...
├── routes/
│   └── trackRoutes.ts          ← POST /upload, POST /preview-credits
├── middleware/
│   ├── upload.ts               ← multer memoryStorage（最大500MB）
│   └── auth.ts
└── services/
    └── storageService.ts       ← 本地 / WebDAV 双模式
```

### 前端（React + TypeScript + Vite + Ant Design）

```
frontend/src/
├── components/
│   ├── UploadModal.tsx         ← 5步骤导入向导（含Credits可编辑预览）
│   ├── Player.tsx              ← 播放器 + 全屏歌词
│   └── ...
├── services/
│   ├── trackService.ts         ← uploadTracks(creditsOverrides) + previewCredits
│   └── ...
├── store/
│   └── authStore.ts            ← 认证状态（initializeAuth / isAuthenticated）
└── pages/
    ├── Login.tsx               ← 已登录自动跳转到 /admin
    └── ...
```

---

## 导入向导完整流程（v3.4）

```
Step 0  选择文件
         └─ 拖拽/点击选择 .flac，支持批量，显示文件列表

Step 1  编辑元数据 + Credits 决策
         ├─ 修改标题 / 艺术家 / 专辑（覆盖 FLAC 内嵌标签）
         ├─ Switch：读取 / 忽略 Credits
         ├─ 忽略 → 跳至 Step 3
         └─ 读取 → Step 2

Step 2  Credits 预览 + 编辑  ★ v3.4
         ├─ 后端解析 FLAC native tags，返回全部 Credits
         ├─ 内联编辑 KEY / VALUE（直接修改输入框）
         ├─ 删除行（点击 🗑 图标）
         └─ 添加行（右上角「＋添加行」按钮）

Step 3  导入进度
         ├─ 摘要卡片（文件数/总大小/Credits状态）
         ├─ 点击「开始导入」逐文件上传
         └─ 实时进度条 + 每文件状态标记

Step 4  完成
         ├─ 成功/失败统计
         └─ 失败项可重试
```

---

## API 端点汇总

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/tracks/upload?auto_credits=true\|false` | 上传 FLAC（支持元数据覆盖 + credits 覆盖） | ✅ |
| POST | `/api/tracks/preview-credits` | 预解析 FLAC Credits，不写数据库 | ✅ |
| GET  | `/api/tracks` | 曲目列表（高级筛选/排序/分页） | ✅ |
| GET  | `/api/tracks/:id` | 单首曲目详情 | ✅ |
| PUT  | `/api/tracks/:id` | 更新曲目元数据 | ✅ |
| DELETE | `/api/tracks/:id` | 删除曲目 | ✅ |
| DELETE | `/api/tracks/bulk` | 批量删除 | ✅ |
| POST | `/api/tracks/bulk-move` | 批量移至专辑 | ✅ |
| GET  | `/api/tracks/:id/stream` | 音频流 | Token |
| GET  | `/api/tracks/:id/download` | 下载 | Token |
| GET  | `/api/public/tracks` | 公开曲目列表 | ❌ |
| GET  | `/api/public/albums` | 公开专辑列表 | ❌ |
| GET  | `/api/lyrics/:id/lyrics` | 获取歌词 | ❌ |
| POST | `/api/auth/login` | 登录 | ❌ |
| GET  | `/api/auth/me` | 获取当前用户 | ✅ |
