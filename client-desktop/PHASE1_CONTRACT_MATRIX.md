# Phase 1 契约对齐矩阵（Web -> Windows）

> 目标：将 Windows 客户端行为与 `backend/`、`frontend/`、线上一致化。
> 状态字段：`TODO | IN_PROGRESS | DONE | BLOCKED`

## A. 认证与会话

| 领域 | API/来源 | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 登录 | `POST /api/auth/login` | `frontend/src/services/api.ts` | `AuthService` / `MainViewModel` | 失败提示、token 保存、用户信息同步一致 | DONE |
| 鉴权失效 | 401 响应 | `frontend/src/services/api.ts` | 全部服务层 | 统一恢复/提示流程一致 | IN_PROGRESS |
| 角色显示 | `is_admin` | Web 管理入口逻辑 | `ShowAdminEntry` | 非管理员不显示管理入口 | DONE |

## B. 发现与浏览

| 领域 | API/来源 | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 游戏列表 | `/api/games` | 首页游戏导航 | `GameService` + 左侧列表 | 封面 URL、展示顺序、选中行为一致 | DONE |
| 专辑列表 | `/api/public/albums` 或按游戏聚合 | Discover/游戏详情 | `DiscoverService` / `MainViewModel` | 仅使用现有字段，不推断扩展字段 | IN_PROGRESS |
| 专辑详情 | `/api/albums/{id}` | Album Detail | `AlbumService` + `AlbumDetailSectionPanel` | 曲目列表来源与展示逻辑一致 | IN_PROGRESS |

## C. 播放与队列

| 领域 | API/来源 | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 播放模式 | 前端状态机 | `frontend/src/store/playerStore.ts` | `MainViewModel` | `sequence/loop/shuffle/single` 语义一致 | DONE |
| 队列替换 | 点击曲目行为 | Player + Queue | `Play*Command` 系列 | 点击曲目替换当前队列 | DONE |
| 下一首逻辑 | 队列推进 | `playerStore` | `HandleTrackEndedCommand` | next/prev 边界一致 | DONE |
| 播放上报 | `POST /api/public/tracks/:id/play` | Web 上报逻辑 | `TrackService`/`MainViewModel` | 上报参数与阈值规则一致 | DONE |

## D. 收藏与歌单

| 领域 | API/来源 | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 收藏切换 | Favorite API | 收藏交互 | `FavoriteService` | 登录态、错误处理一致 | DONE |
| 歌单管理 | Playlist API | 歌单页 | `PlaylistService` | 创建/删除/增删曲目一致 | DONE |

## E. 错误与可用性

| 领域 | API/来源 | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 统一错误映射 | `{ success, error }` | Web 错误提示风格 | 服务层 + ViewModel | 同类错误提示一致、不中断主流程 | DONE |
| 页面状态模板 | 页面状态管理 | 各页面状态反馈 | `MainWindow.xaml` | 加载/空态/错误态一致 | IN_PROGRESS |

## F. 前端信息架构（IA）对齐

| 领域 | API/来源 | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 游戏入口页 | `/games/:id` | `pages/GameDetail.tsx` | `GamesSectionPanel` | 具备独立入口与切换路径 | IN_PROGRESS |
| 专辑入口页 | `/albums` | `pages/Albums.tsx` | `AlbumsSectionPanel` | 专辑浏览入口独立可见 | IN_PROGRESS |
| 艺人入口页 | `/artists` | `pages/Artists.tsx` | `ArtistsSectionPanel` | 可从入口触发艺人筛选 | IN_PROGRESS |
| 标签入口页 | `/tags` | `pages/Tags.tsx` | `TagsSectionPanel` | 可从入口触发标签筛选 | IN_PROGRESS |
| 搜索入口页 | `/search` | `pages/Search.tsx` | `SearchSectionPanel` | 具备独立搜索入口与结果操作 | IN_PROGRESS |
| 设置入口页 | `pages/Settings.tsx` | 管理/设置 | `SettingsSectionPanel` | 用户可见的主题与播放设置入口 | TODO |

## 本周执行顺序
1. 深化 F 区域 IA 对齐（artist/tag/search/detail 语义）。
2. 继续推进 E 区域（统一状态模板覆盖所有主要页面）。
3. 推进 C 区域播放上报闭环并补回归测试。

---
更新日期：2026-04-15

