# HoYoMusic

HoYoverse 游戏音乐管理与在线播放平台（前后端分离，支持本地/OSS/WebDAV 三种存储模式）。

本 README 的目标是：把项目中每个模块做什么、模块之间怎么连接、请求如何流转，讲清楚且可落地排查。

---

## 1. 项目总览（先建立全局认知）

### 1.1 技术栈

- 前端：`React 19` + `TypeScript` + `Vite` + `Ant Design` + `Zustand` + `Axios`
- 后端：`Express` + `TypeScript` + `PostgreSQL` + `Passport(JWT)` + `Multer` + `Sharp`
- 存储层：`local` / `oss` / `webdav`（由 `backend/src/services/storageService.ts` 统一抽象）

### 1.2 运行入口

- 后端入口：`backend/src/index.ts`
  - 负责：安全中间件、限流、维护模式、路由挂载、Swagger、健康检查、启动迁移、存储初始化
- 前端入口：`frontend/src/App.tsx`
  - 负责：全局路由、公开页与管理页分流、鉴权守卫、维护模式页面切换、播放器挂载

### 1.3 统一 API 响应约定

- 后端接口遵循：`{ success, data?, error? }`
- 前端服务层按此约定解析，错误态统一走 `Axios` 拦截器和页面提示逻辑

---

## 2. 仓库结构与模块地图

```text
HoYoMusic/
  backend/
    src/
      index.ts                # 后端应用入口（中间件、路由、迁移、启动）
      setup.ts                # 初始化脚本（管理员等基础数据）
      config/                 # DB/OSS/WebDAV/Passport/Swagger
      controllers/            # 业务控制器（参数通过后，执行业务）
      routes/                 # 路由层（鉴权、校验、调用 controller）
      middleware/             # 认证、校验、上传、维护模式、日志、缓存头
      services/               # 外部能力与基础服务封装（存储、邮件、远程缓存）
      validators/             # Zod schema
      utils/                  # 缓存、元数据、缩略图、行为分析等工具
  frontend/
    src/
      App.tsx                 # 前端总路由与全局壳
      pages/                  # 页面级模块
      components/             # 复用组件与业务组件
      services/               # API 调用层
      store/                  # Zustand 状态
      config/                 # 导航配置（如后台菜单）
      theme/                  # 主题 token 与全局样式
      utils/                  # UI/格式化/音频上下文等工具
      types/                  # TS 类型定义
```

---

## 3. 后端模块详解（模块功能 + 连接关系）

## 3.1 `backend/src/index.ts`（后端总装配模块）

职责分层：

- 安全与传输：`helmet`、`cors`、`compression`、`etag`
- 限流：全局限流 + 登录限流 + 注册限流 + 验证码限流 + debug 限流
- 请求生命周期中间件：`requestLogger` -> `visitLogger` -> `maintenanceModeGuard`
- 路由挂载中心：将所有 `routes/*.ts` 挂到 `/api/*`
- 文档与健康：`/api/docs`、`/api/docs.json`、`/api/health`
- 启动迁移：运行大量 `CREATE TABLE IF NOT EXISTS / ALTER TABLE ... IF NOT EXISTS`
- 存储模式初始化：`local`（本地目录）、`oss`（连通性测试+目录初始化）、`webdav`（连通性测试+目录初始化）
- 优雅停机：刷新访问日志批处理 + 关闭 DB 连接池

连接关系（核心链路）：

`HTTP请求 -> Express app -> 全局中间件 -> 维护模式守卫 -> 路由 -> 控制器 -> service/DB -> 响应`

## 3.2 `backend/src/config/*`（配置模块）

- `database.ts`
  - 提供 PostgreSQL 连接池；业务层通过 `pool.query` 或事务访问 DB
  - 被 `index.ts`、多个 controller 使用
- `passport.ts`
  - 配置 JWT/本地策略；与 `middleware/auth.ts` 配合
- `swagger.ts`
  - 生成 OpenAPI 规范；由 `index.ts` 在 `/api/docs` 暴露
- `oss.ts`
  - OSS 客户端、连通测试、目录初始化；由 `index.ts` 在 `STORAGE_MODE=oss` 时调用
- `webdav.ts`
  - WebDAV 客户端、连通测试、目录初始化；由 `index.ts` 在 `STORAGE_MODE=webdav` 时调用

## 3.3 `backend/src/middleware/*`（中间件模块）

- `auth.ts`
  - 管理员鉴权（如 `authenticateAdmin`）
  - 用于所有需要登录/管理员权限的管理端 API
- `authenticateStream.ts`
  - 流媒体下载/播放鉴权（与后台 JWT 鉴权语义分离）
- `upload.ts`
  - 上传解析（曲目、封面）
  - 与 `trackRoutes.ts` 上传端点直接连接
- `validate.ts`
  - 把 `validators/schemas.ts` 的 Zod schema 接入请求校验
- `cacheHeaders.ts`
  - 提供统一缓存响应头策略（含 no-store）
- `maintenanceMode.ts`
  - 对 `/api` 统一维护模式拦截，管理员可按规则豁免
- `visitLogger.ts`
  - 请求级访问日志采集，批量写入 `visit_logs`
- `requestLogger.ts`
  - 请求日志打印
- `debugAuth.ts`
  - debug 路由访问控制辅助
- `errorHandler.ts`
  - 全局错误收敛与统一响应格式

## 3.4 `backend/src/validators/schemas.ts`（输入契约模块）

- 维护业务 schema（例如 `trackRoutes.ts` 里的更新曲目、批量删除、元数据导入预览/提交/回滚）
- 路由层通过 `validateBody(schema)` 使用
- 价值：将参数错误提前在路由层阻断，避免脏数据进入 controller

## 3.5 `backend/src/services/*`（服务抽象模块）

- `storageService.ts`
  - 存储统一抽象门面，屏蔽本地/OSS/WebDAV差异
  - 上传、读取、URL 解析、删除等操作统一经由此层
- `ossService.ts`
  - OSS 具体实现（签名 URL、对象操作）
- `webdavService.ts`
  - WebDAV 具体实现（远程文件目录操作）
- `remoteResourceCache.ts`
  - 远程资源（尤其封面代理）缓存，用于降低重复拉取
- `analyticsEsaService.ts`
  - 分析相关服务（与统计域连接）
- `emailService.ts`
  - 邮件能力（如验证码/通知）

连接关系：

`controller -> storageService -> (local|ossService|webdavService)`

## 3.6 `backend/src/utils/*`（工具模块）

- `cache.ts`：通用缓存结构与统计（`/api/health` 输出）
- `metadata.ts`：音频元数据提取/处理辅助
- `thumbnails.ts`：缩略图处理辅助
- `behaviorAnalysis.ts`：行为分析辅助

这些工具不直接暴露路由，主要被 controller/service 组合调用。

## 3.7 `backend/src/routes/*` 与 `backend/src/controllers/*` 对照

下表是最核心的“接口入口 -> 业务执行”映射。

| 路由模块 | 控制器模块 | 主要职责 | 连接到的核心资源 |
|---|---|---|---|
| `authRoutes.ts` | `authController.ts` | 登录、密码、验证码、注册等认证流程 | `users`、`auth_verification_codes`、JWT |
| `trackRoutes.ts` | `trackController.ts` | 管理端曲目上传/更新/删除、流/下载、元数据导入导出、批处理 | `tracks`、`albums`、`artists`、存储服务 |
| `publicRoutes.ts` | `trackController.ts` + 路由内SQL | 公开曲目检索、播放、下载、随机推荐、热门榜单、播放上报、封面代理 | `tracks`、`track_play_events`、`favorites`、`remoteResourceCache` |
| `lyricsRoutes.ts` | `lyricsController.ts` | 歌词上传/查询/更新 | `tracks.lyrics_*` 与歌词文件存储 |
| `creditsRoutes.ts` | `creditsController.ts` | 制作人员信息解析与维护 | credits 相关表结构 |
| `albumRoutes.ts` | `albumController.ts` | 专辑 CRUD、封面相关操作 | `albums`、封面存储 |
| `artistRoutes.ts` | `artistController.ts` | 艺术家 CRUD、关联关系 | `artists`、`track_artists`、`artist_aliases` |
| `gameRoutes.ts` | `gameController.ts` | 游戏维度管理 | `games` |
| `tagRoutes.ts` | `tagController.ts` | 标签/分组/层级维护 | `tags`、轨道标签关联 |
| `playlistRoutes.ts` | `playlistController.ts` | 用户播放列表管理 | `playlists`、`playlist_tracks` |
| `favoriteRoutes.ts` | `favoriteController.ts` | 收藏切换与列表 | `favorites` |
| `discRoutes.ts` | `discController.ts` | 专辑分盘（disc）能力 | `album_discs`、`tracks.disc_id` |
| `analyticsRoutes.ts` | 统计相关控制器逻辑 | 访问/存储/热度分析接口 | `visit_logs`、`track_play_events` |
| `settingsRoutes.ts` | 站点配置逻辑 | 首访弹窗、备案信息、维护模式配置 | `app_settings` |
| `userRoutes.ts` | `userController.ts` | 用户管理（管理员） | `users` |
| `messageRoutes.ts` | `messageController.ts` | 站内消息 | `site_messages`、`site_message_deliveries` |
| `musicSourceRoutes.ts` | `musicSourceController.ts` | 音乐来源分类树与曲目来源绑定 | `music_source_categories`、`music_source_nodes`、`track_music_sources` |
| `debugRoutes.ts` | debug控制逻辑 | 仅调试用途（默认关闭） | 受环境变量硬开关控制 |

---

## 4. 前端模块详解（模块功能 + 连接关系）

## 4.1 `frontend/src/App.tsx`（前端总路由与应用壳）

核心职责：

- 懒加载页面：首页、详情页、搜索页、后台页、维护页等
- 路由分层：公开路由、用户路由、管理员路由
- 鉴权拦截：通过 `ProtectedRoute` + `authStore`
- 维护模式联动：通过 `siteConfigService.getPublicMaintenanceMode()` 决定是否强制跳转 `/maintenance`
- 全局组件挂载：`PageHeader`、`MobileTabBar`、`Player`、`AuthModal`、`FeedbackModal`、`FirstVisitModal`

连接关系：

`Router -> Route -> 页面 -> service(api) -> 后端接口`

## 4.2 `frontend/src/services/api.ts`（HTTP 基础设施模块）

这是前端所有业务 service 的底座：

- `baseURL`：`VITE_API_URL`，默认回退 `${window.location.origin}/api`
- 请求拦截：
  - 自动注入 `x-visitor-id`
  - 有 token 时注入 `Authorization: Bearer ...`
  - 对已认证 GET 自动加 `Cache-Control: no-cache`（避免后台读到旧缓存）
- 响应拦截：`401` 时清理 token，拉起登录弹窗并保存回跳路径

业务 service 连接方式：

`trackService`、`albumService`、`tagService`、`analytics` 等均基于该客户端构建。

## 4.3 `frontend/src/services/*`（业务服务模块）

- `trackService.ts`：曲目上传、查询、详情、流地址相关请求
- `albumService.ts`：专辑相关请求
- `artistService`（对应 `artist` 能力）：艺术家相关请求
- `tagService.ts`：标签查询与管理
- `gameService.ts`：游戏列表与管理
- `lyricsService.ts` / `lyricsImportService.ts`：歌词查询与批量导入
- `creditsService.ts`：制作人员信息维护
- `playlistService.ts`：播放列表
- `favoriteService.ts`：收藏
- `authService.ts`：登录与账户能力
- `userService.ts`：后台用户管理
- `messageService.ts`：站内消息
- `siteConfigService.ts`：维护模式/站点配置
- `musicSourceService.ts`：音乐来源树结构与绑定
- `discService.ts`：专辑分盘
- `feedbackService.ts`：反馈提交

## 4.4 `frontend/src/store/*`（前端状态模块）

- `playerStore.ts`：播放器核心状态（当前曲目、播放队列、播放模式、进度等）
- `authStore.ts`：登录态、用户信息、初始化逻辑
- `authModalStore.ts`：登录弹窗状态管理
- `searchStore.ts`：搜索条件/结果相关状态
- `themeStore.ts`：主题模式
- `equalizerStore.ts`：均衡器参数

连接关系：

`页面组件 <-> store <-> service(api) <-> backend`

## 4.5 `frontend/src/pages/*`（页面模块）

公开页面：

- `Home.tsx`：首页聚合（随机专辑、随机曲目、热门曲目）
- `PublicLibrary.tsx`：公开曲库浏览
- `Search.tsx`：搜索页
- `TrackDetail.tsx`：曲目详情与播放入口
- `Albums.tsx` / `AlbumDetail.tsx`：专辑列表与详情
- `Artists.tsx` / `ArtistDetail.tsx`：艺术家列表与详情
- `Tags.tsx` / `TagDetail.tsx`：标签列表与详情
- `GameDetail.tsx`：游戏维度详情

用户页面：

- `PlaylistDetail.tsx`：用户播放列表详情（受保护）
- `Profile.tsx`：个人中心（受保护）

后台页面：

- `Admin.tsx`：后台入口聚合
- `AlbumManagement.tsx`、`TagManagement.tsx`、`GameManagement.tsx`、`ArtistManagement.tsx`
- `UserManagement.tsx`、`Analytics.tsx`、`Settings.tsx`
- `MusicSourceLibraryManagement.tsx`：音乐来源库管理

系统页面：

- `Maintenance.tsx`：维护模式提示页

## 4.6 `frontend/src/components/*`（组件模块）

按职能分组理解最清晰：

- 布局导航：`PageHeader.tsx`、`SideNav.tsx`、`MobileTabBar.tsx`、`admin/AdminLayout.tsx`
- 鉴权与全局弹层：`AuthModal.tsx`、`ProtectedRoute.tsx`、`FeedbackModal.tsx`、`FirstVisitModal.tsx`
- 播放器核心：`Player.tsx`、`PlayQueue.tsx`、`CrossfadeControl.tsx`、`SleepTimer.tsx`、`SpectrumVisualizer.tsx`
- 内容展示：`LyricsDisplay.tsx`、`CreditsDisplay.tsx`、`MarkdownContent.tsx`、`LazyImage.tsx`
- 编辑导入：`UploadModal.tsx`、`CreditsImportModal.tsx`、`LyricsBatchImportModal.tsx`、`MusicSourceImportModal.tsx`、`TrackNotesImportModal.tsx`
- 管理工具：`TrackTagsManager.tsx`、`TagGroupManager.tsx`、`BulkTagModal.tsx`、`BulkMoveAlbumModal.tsx`
- 交互增强：`KeyboardShortcutsModal.tsx`、`ThemeToggle.tsx`、`HeartButton.tsx`

## 4.7 `frontend/src/config|theme|utils|types`（支撑模块）

- `config/adminNavigation.ts`
  - 后台导航单一事实源；`App.tsx` 通过它动态生成后台 `Route`
- `theme/themeConfig.ts` + `theme/*.css`
  - 明暗主题 token 与全局样式
- `utils/*`
  - `audioContext.ts`：音频上下文
  - `format.ts`：格式化工具
  - `imageUtils.ts`：图片处理辅助
  - `tagPath.ts`：标签路径处理
  - `toast.ts`：消息提示封装
  - `useDebounce.ts`、`useDominantColor.ts`：通用 Hook
- `types/index.ts`
  - 前端核心类型定义

---

## 5. 关键业务链路（逐步连接说明）

## 5.1 曲目上传链路（管理端）

`frontend/src/services/trackService.ts`
-> `POST /api/tracks/upload`（`backend/src/routes/trackRoutes.ts`）
-> `authenticateAdmin` + `upload.array(...)`
-> `trackController.uploadTracks`
-> 元数据提取/校验（含 FLAC magic-byte 等）
-> `storageService` 写入（local/oss/webdav）
-> 事务写入数据库（tracks + 关联关系）
-> 返回 `{ success, data }`

## 5.2 公共播放链路

`TrackDetail/Home/列表页`
-> 请求 `GET /api/public/tracks/:id/stream`（`publicRoutes.ts`）
-> `trackController.streamTrack`
-> `storageService` 提供文件流
-> 前端播放器消费音频流

同时上报：

`POST /api/public/tracks/:id/play`
-> `publicRoutes.ts` 计算有效播放阈值
-> `track_play_events` upsert（按 `track_id + session_key` 去重）
-> 热门榜单依赖有效播放数统计

## 5.3 封面访问链路

- 公开页面使用 `/api/public/covers/proxy?path=...`
- `publicRoutes.ts` 内处理：
  - 参数安全校验（含 SSRF 风险规避）
  - 远程内容类型检查
  - 可选缩略图生成（`sharp`）
  - `remoteResourceCache` 二级缓存

## 5.4 维护模式链路（前后端联动）

- 后端：`maintenanceModeGuard` 挂在 `/api`
- 前端：`App.tsx` 启动时请求 `siteConfigService.getPublicMaintenanceMode()`
- 若启用维护模式且当前用户无管理员豁免：强制路由到 `/maintenance`

## 5.5 音乐来源模块链路

- 后端迁移在 `index.ts` 创建：
  - `music_source_categories`
  - `music_source_nodes`
  - `track_music_sources`
- 管理端页面 `MusicSourceLibraryManagement.tsx`
  - 通过 `musicSourceService.ts`
  - 调 `musicSourceRoutes.ts` + `musicSourceController.ts`
  - 实现来源树维护和曲目来源绑定

---

## 6. 启动时数据库迁移模块（`backend/src/index.ts`）

后端启动时会尝试补齐/升级以下数据结构（节选主域）：

- 艺术家别名：`artist_aliases`
- 访问日志：`visit_logs`
- 播放列表：`playlists`、`playlist_tracks`
- 收藏：`favorites`
- 站内信：`site_messages`、`site_message_deliveries`
- 曲目补充字段：`sha256_hash`、`play_count`、`lyrics_status`、`disc_id`
- 播放事件：`track_play_events`
- 目录元数据导入审计：`catalog_metadata_import_batches`、`catalog_metadata_import_changes`
- 音乐来源：`music_source_categories`、`music_source_nodes`、`track_music_sources`
- 系统配置：`app_settings`
- 用户认证增强：`users` 扩展列、`auth_verification_codes`
- 反馈：`feedback_messages`

这意味着项目采用“应用启动即迁移”风格，部署时不依赖独立迁移框架。

---

## 7. 安全与稳定性模块

- 传输与头部安全：`helmet`（含 HSTS、ReferrerPolicy）
- 限流：全局 + 登录 + 注册 + 验证码 + debug 多层限制
- 鉴权分离：
  - 管理接口：`authenticateJWT/authenticateAdmin`
  - 流媒体接口：`authenticateStream`
- 参数校验：`validators/schemas.ts` + `validateBody(...)`
- 上传安全：`multer` + 文件类型/内容校验（上传链路中）
- 维护模式守卫：统一在 `/api` 前置拦截
- 访问日志批量化：`visitLogger` 降低频繁 IO 压力

---

## 8. 开发与验证流程

说明：当前仓库可确认存在 `dev/build/setup` 脚本；`backend` 的 `test` 仍是占位脚本（会直接报错退出）。

### 8.1 本地开发（PowerShell）

```powershell
Set-Location "C:\Users\sumi\WebstormProjects\HoYoMusic\backend"
npm install
npm run setup
npm run dev
```

新开一个终端：

```powershell
Set-Location "C:\Users\sumi\WebstormProjects\HoYoMusic\frontend"
npm install
npm run dev
```

也可以使用仓库根目录脚本：`start-dev.ps1` / `stop-dev.ps1`。

### 8.2 构建验证

```powershell
Set-Location "C:\Users\sumi\WebstormProjects\HoYoMusic\backend"
npm run build
Set-Location "C:\Users\sumi\WebstormProjects\HoYoMusic\frontend"
npm run build
```

### 8.3 接口文档与健康检查

- Swagger：`/api/docs`
- OpenAPI JSON：`/api/docs.json`
- 健康检查：`/api/health`

---

## 9. 模块连接速查（排障时最有用）

## 9.1 前端页面 -> 服务 -> 后端路由

- `Home/PublicLibrary/Search/TrackDetail` -> `trackService` -> `publicRoutes.ts` / `trackRoutes.ts`
- `Albums/AlbumDetail` -> `albumService` -> `albumRoutes.ts`
- `Artists/ArtistDetail` -> `artist相关service` -> `artistRoutes.ts`
- `Tags/TagDetail` -> `tagService` -> `tagRoutes.ts`
- `PlaylistDetail` -> `playlistService` -> `playlistRoutes.ts`
- `Profile` -> `authService`/`userService` -> `authRoutes.ts`/`userRoutes.ts`
- `Analytics` -> analytics service -> `analyticsRoutes.ts`
- `Settings` -> `siteConfigService` -> `settingsRoutes.ts`
- `MusicSourceLibraryManagement` -> `musicSourceService` -> `musicSourceRoutes.ts`

## 9.2 后端路由 -> 控制器 -> 基础能力

- `routes/*.ts` 负责鉴权/校验/缓存头
- `controllers/*.ts` 负责业务逻辑和响应组装
- `services/*.ts` 负责存储、远程资源、邮件等可复用基础能力
- `config/database.ts` 提供统一 DB 连接池

---

## 10. 你在改动模块时应同步检查什么

- 改上传/播放：同时检查 `trackRoutes.ts` 与 `publicRoutes.ts`
- 改曲目字段：同步检查 `trackController.ts`、`publicRoutes.ts`、`frontend/src/services/trackService.ts`
- 新增 DB 功能：优先在 `backend/src/index.ts` 增加兼容式启动迁移
- 改鉴权：区分后台 JWT 与流媒体 token 两条链路
- 改管理端 GET：尽量走 `frontend/src/services/api.ts`，保留 no-cache 策略

---

## 11. 参考文档

- 总体说明：`AGENTS.md`
- 需求文档：`PRD.md`
- 规划路线：`ROADMAP.md`
- 项目状态：`PROJECT_STATUS.md`

---

## 12. License

MIT

