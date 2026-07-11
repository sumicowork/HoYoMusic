# 前端 / 桌面端 信息架构与操作逻辑混乱分析（2026-07-11）

> 背景：用户指出"前端和客户端的操作逻辑、页面分布、菜单层级、菜单内容混乱，需要整体性统一"。
> 本报告的结论均来自对 `frontend/` 与 `Desktop/` 源码的实地排查（file:line 为证），非文档。
> 本文只做分析 + 统一方案，**未改动任何代码**。

---

## 0. 一句话结论

混乱集中在四方面：**① 同一概念多套中文名**（曲库/乐库、艺术家/创作者）；**② 两端路由命名不一致**（前端复数 `/albums`，桌面单数 `/album`）；**③ 前端自己就有三套互相打架的导航组件**；**④ 操作逻辑断裂**（桌面端无登录→歌单全死、点击即替换队列、下载已实现却无入口、维护模式静默空列表）。

---

## 1. 前端（web）现状

### 1.1 路由（`frontend/src/App.tsx`）
- 公开：`/` Home · `/games/:id` · `/library` 曲库 · `/track/:id` · `/albums` · `/albums/:id` · `/artists` · `/artists/:id` · `/tags` · `/tags/:id` · `/search`
- 用户（需登录）：`/playlists/:id` · `/me`
- 管理（需 admin）：`/admin` · `/admin/albums` · `/admin/tags` · `/admin/games` · `/admin/artists` · `/admin/users` · `/admin/analytics` · `/admin/settings` · `/admin/music-sources/library`
- 其它：`/maintenance` · `*`→`/`

### 1.2 导航组件（**三套，彼此不一致**）
| 组件 | 位置 | 菜单项（label → route） | 问题 |
|---|---|---|---|
| `SideNav.tsx:36-62` | 左侧栏 | 主页/搜索/曲库/专辑/**艺术家**/标签/我的/管理/主题 | **"管理"对全体用户可见**（44-55），非 admin 点了被 `ProtectedRoute` 踢回 `/` |
| `PageHeader.tsx:83-91` | 顶部 | 主页/搜索/曲库/专辑/**创作者**/标签/反馈 + 右侧消息/登录·我的/管理(仅 admin 162-170) | 与 SideNav 的"艺术家"不一致；无独立"我的"项 |
| `MobileTabBar.tsx:31-38` | 移动端 | 主页/搜索/曲库/专辑/反馈/**创作者** | 又一套"创作者" |

### 1.3 孤儿页 / 可达性
- `/games/:id`（GameDetail）：无菜单项，仅 Home 游戏卡片点击进入（`Home.tsx:314`）→ 半孤儿
- `/playlists/:id`（PlaylistDetail）：**无菜单入口**，仅从 `/me` 歌单列表点击（`Profile.tsx:207`）→ 孤儿
- `/tags`/`/tags/:id`：有"标签"菜单项，可达
- `/admin/*`：仅在 AdminLayout 侧栏内可达（合理）

### 1.4 关键操作流
- **浏览→专辑→播放**：Home 随机专辑→`/albums/:id`（`AlbumDetail.tsx:341`）；曲目 Play→`playTrackOnly`（`68,148`）→`playerStore` 设 `currentTrack`+`isPlaying`（`playerStore.ts:77`）→`App.tsx:254` 渲染 `<Player>`
- **艺术家**：列表点按→`/artists/${encodeURIComponent(name)}`（`Artists.tsx:52`）；`ArtistDetail` 按**名称**取详情（`43,61`）。⚠️ 与 track/album 用数字 `:id` 不一致；admin `ArtistManagement` 却用数字 id
- **收藏/歌单**：按钮仅 `canUseDebugFeatures`（实际只校验 `isAuthenticated`，`debugFeature.ts:7-11`）时显示；`favoriteService.toggle` 带 JWT POST `/favorites/toggle`
- **Admin 入口**：`/admin` 实为"曲目管理"表格（`adminNavigation.ts:22` 标签"曲目管理"、`Admin.tsx:619` 标题"曲目管理"），**不是概览仪表盘**，无统计首页

### 1.5 前端具体混乱点
1. **艺术家 vs 创作者**：SideNav"艺术家"(`41`) vs PageHeader/MobileTabBar"创作者"(`88,37`)；页面内还混用（`Artists.tsx:82`"搜索创作者"、`ArtistDetail.tsx:69`"加载创作者详情失败"）
2. **英文混中文 UI**：`Music Source 库`（`adminNavigation.ts:24`、`Settings.tsx:633`、`MusicSourceLibraryManagement.tsx:449`）；`Album/Track/Disc/FLAC`（`AlbumDetail.tsx:99,266,131`、`TrackDetail.tsx:299`）
3. **Admin 退出死链**：`AdminLayout.handleLogout`→`navigate('/admin/login')`（`AdminLayout.tsx:37`），该路由不存在→被 catch-all 重定向 `/`→管理员登出静默回首页，无登录页
4. **Home/曲库/Search 职责重叠**：Home 含随机专辑+推荐+热门（`Home.tsx:330-463`）；曲库(PublicLibrary)是扁平曲目表+搜索（`PublicLibrary.tsx:34`）；Search 又是带标签/游戏筛选的高级版。三者浏览职责高度重叠，"主页"与"曲库"边界不清
5. **死交互**：`AlbumDetail` 曲目行 `MoreOutlined` 无 `onClick`（`179-184`）——占位死控件
6. **"我的"入口不统一**：SideNav"我的"→`/me`(`43`)；PageHeader 无独立"我的"，而是登录按钮文案"我的"(`160`)

---

## 2. 桌面端（Tauri）现状

### 2.1 路由（`Desktop/src/router.tsx`）——**单数命名**
`/` Home · `/library` · `/search` · `/album` · `/album/:id` · `/artist` · `/artist/:id` · `/playlist` · `/playlist/:id`
无 `/me` `/tags` `/games` `/admin` `/maintenance`。

### 2.2 导航（`Desktop/src/components/layout/Sidebar.tsx`）——扁平、无可见性逻辑
`/` 首页 · `/library` **乐库** · `/search` 搜索 · `/playlist` 歌单
- **孤儿**：`/album`、`/artist` **不在侧栏**（仅经 Home/Library 链接进入）；`AppShell.tsx:80-87` 给"专辑/艺术家"定义了标题却无导航入口
- **Bug**：`/artist`（无 id）、`/playlist`（无 id）无限转圈（`Artist.tsx:22,37`、`Playlist.tsx:19,33`）

### 2.3 页面清单（`src/pages`）
Home（推荐+专辑网格+空歌单区）· Library（单曲/专辑/艺术家/歌单 Tab）· Search（`?q=`）· Album（浏览+详情）· Artist（仅详情，无 id 转圈）· Playlist（仅详情，无 id 转圈）· shared（TrackList 复用）
**死组件**：`MiniPlayer.tsx`/`NowPlaying.tsx`/`WaveformVisualizer.tsx` 仅在 `player/index.ts` 导出，无任何页面引用（`grep` 确认）。

### 2.4 关键操作流
- **播放**：点击→`setQueue`+`playIndex`（`Home.tsx:65`、`shared.tsx:55`）→`useAudioPlayer.ts` 驱动单个 `HTMLAudioElement`；音频 URL=`/public/tracks/:id/stream`（`api.ts:73`）
- **艺术家**：route `/artist/:id` 的 `id` 是**名字**（`api.ts:104,114` 强制 `id: name`，注释 `api.ts:100` "keyed by name and have no id"）
- **收藏/歌单（断裂）**：桌面端**无登录、无 JWT**→`fetchPlaylists()→[]`、`fetchPlaylist()→undefined`（`api.ts:285-293`）→歌单菜单常显"歌单加载失败"（`Playlist.tsx:42`），Home"推荐歌单"恒空（`Home.tsx:80,203`）
- **下载（已实现却无入口）**：`tauri.startDownload` + Rust `start_download`（`commands.rs:145`）真实流式下载已实现，但**无任何 UI 调用**（grep 仅 `tauri.test.ts`）
- **快捷键/托盘/媒体元数据：真实**（`commands.rs:122/94/45/71`）；**媒体动作（耳机/SMTC 的下一首/上一首）：桩**（`commands.rs:85-90` 只 log，不发事件）

### 2.5 桌面端具体混乱点
1. **点击即替换队列**：每次点击曲目 `setQueue` 整体替换；`setCurrent`（append）在 store 中存在（`playerStore.ts:152`）却**从未被调用**（死代码）→无"下一首播放/加入队列"
2. **歌单功能整体死亡**：菜单项+Home 区+`/playlist/:id` 全失败（无鉴权）
3. **维护模式静默空列表**：后端 503 时 `api.ts:146-148` catch 返回 `undefined`→静默空列表，**永不显示维护页**
4. **无账号/后台/维护 UI**：与前端完全不对等

---

## 3. 两端不一致对照表

| 维度 | 前端（web） | 桌面端（Desktop） |
|---|---|---|
| 资源路由 | 复数 `/albums` `/artists` `/playlists` | 单数 `/album` `/artist` `/playlist` |
| "曲库"叫法 | **曲库**（`SideNav.tsx:39`） | **乐库**（`Sidebar.tsx:20`） |
| "艺术家"叫法 | SideNav"艺术家" / PageHeader·Mobile"创作者" | "艺术家"（但无侧栏入口） |
| 账号体系 | 有（`/me`、登录、JWT） | 无 |
| 后台 | 有（`/admin/*`） | 无 |
| 维护模式 | 有（`/maintenance`） | 无（503 静默空） |
| 标签/游戏页 | 有 `/tags` `/games` | 无 |
| 队列操作 | 播放即设当前 | 点击即替换队列，无"下一首/加入" |
| 下载 | — | 桥已通，UI 未接 |

---

## 4. 统一方案（建议落地的目标态）

### 4.1 统一术语表（单一规范名，两端 + 三导航共用）
| 概念 | 规范中文 | 规范路由 | 备注 |
|---|---|---|---|
| 首页 | 首页 | `/` | |
| 搜索 | 搜索 | `/search` | |
| 曲库 | **曲库**（废除"乐库"） | `/library` | |
| 专辑 | 专辑 | `/albums` `/albums/:id` | 桌面改复数 |
| 艺术家 | **艺术家**（废除"创作者"） | `/artists` `/artists/:id` | 桌面改复数；详见 4.4 |
| 标签 | 标签 | `/tags` `/tags/:id` | 桌面补入口 |
| 游戏 | 游戏 | `/games` `/games/:id` | 桌面补入口 |
| 歌单 | 歌单 | `/playlists` `/playlists/:id` | 桌面改复数 |
| 我的 | 我的 | `/me` | 收藏/歌单归入 |
| 管理后台 | 管理后台 | `/admin`（**概览仪表盘**） | 子项：曲库管理/标签管理/游戏管理/艺术家管理/用户管理/统计/设置/曲源库 |

### 4.2 统一路由约定
- 集合资源一律**复数**（`/albums` 非 `/album`），两端对齐
- `:id` 对 track/album 用数字；艺术家**长期应改用 id**（见 4.4），过渡期保持 name 但统一走 `/artists/:name`
- 抽 `routes.ts`（前端）与 `Desktop/src/lib/routes.ts` 各自导出常量，避免硬编码字符串漂移

### 4.3 统一导航结构（两端共用此骨架）
- **主导航**：首页 / 搜索 / 曲库 / 专辑 / 艺术家 / 标签 / 游戏 / 歌单 / 我的
- **管理后台入口**：仅 admin 可见，label"管理后台"，→`/admin` 真实仪表盘
- 前端**三套导航合并为一套主导航**（sidebar 为主，header/mobile 同步 label 与层级）；删除 PageHeader/MobileTabBar 与 SideNav 的 label 分歧
- 桌面端补 `/albums`·`/artists`·`/tags`·`/games` 侧栏项（或至少在 Home/Library 内可达），消除 `/album`·`/artist` 孤儿

### 4.4 统一操作逻辑
- **播放模型**：点击曲目统一行为——默认"播放并替换队列"可保留，但必须补"下一首播放 / 加入队列"入口（桌面端启用已有的 `setCurrent` append）
- **艺术家标识**：根因是**无 artists 表**（`track_credits.credit_value` 自由字符串）。统一方案应随 DB 重构补 `artists` 实体 + `artist_id`，届时两端 artist 路由统一为 `/artists/:id`（数字）
- **需登录的功能**（收藏/歌单）：两端统一**优雅降级**——显示"登录后可用"占位，而非静默空 / "加载失败"
- **维护模式**：两端统一——API 503 时显示维护页，而非空列表
- **下载**：桌面端把已实现的 Rust 下载桥接进 UI（曲目行"下载"按钮）

---

## 5. 修复优先级（待你授权后落地）

**P0（低风险、纯前端/文案）**
1. 统一 label：乐库→曲库、创作者→艺术家（两端 + 前端三导航）
2. 前端 `SideNav` 的"管理"对非 admin 隐藏/禁用
3. 修 `/admin/login` 死链→`/` 或登录 Modal；`/admin` 改为真实概览或准确改名
4. 桌面端 `/artist`·`/playlist` 无 id 无限转圈→重定向到浏览页或空态
5. 删/接 `AlbumDetail` 死按钮 `MoreOutlined`

**P1（结构性）**
6. 前端三导航合并为一套，统一层级与 label
7. 厘清 Home/曲库/Search 分工（首页=发现/个性化，曲库=完整浏览，搜索=检索）
8. 桌面端补队列操作（play next / add to queue，复用 `setCurrent`）
9. 桌面端接下载 UI（调已有 Rust 桥）
10. 桌面端实现媒体动作发射（next/prev）
11. 桌面端维护模式处理（503→维护页）

**P2（需 DB 重构联动）**
12. 新增 `artists` 实体 + `artist_id` 外键 → 艺术家路由统一数字 id
13. 桌面端补齐账号/登录/收藏/歌单对等能力

---

## 6. 下一步
本报告为分析 + 方案。可执行的最小安全起点：**P0 的 1–5（统一术语 + 修死链/死按钮/无限转圈）**，纯文案与低风险，不影响数据结构。
是否要我从 P0 开始落地？或先只统一术语表（建议作为两端共享的 `terminology.ts`/`routes.ts` 常量）？
