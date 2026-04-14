# Phase 1 Contract Matrix (Web -> Windows)

> 目标：将 Windows 客户端行为与 `backend/`、`frontend/`、线上一致化。
> 状态字段：`TODO | IN_PROGRESS | DONE | BLOCKED`

## A. 认证与会话

| Domain | API/Source | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 登录 | `POST /api/auth/login` | `frontend/src/services/api.ts` | `AuthService` / `MainViewModel` | 失败提示、token 保存、用户信息同步一致 | TODO |
| 鉴权失效 | 401 响应 | `frontend/src/services/api.ts` | 全部服务层 | 统一恢复/提示流程一致 | TODO |
| 角色显示 | `is_admin` | Web 管理入口逻辑 | `ShowAdminEntry` | 非管理员不显示管理入口 | DONE |

## B. 发现与浏览

| Domain | API/Source | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 游戏列表 | `/api/games` | 首页游戏导航 | `GameService` + 左侧列表 | 封面 URL、展示顺序、选中行为一致 | IN_PROGRESS |
| 专辑列表 | `/api/public/albums` 或按游戏聚合 | Discover/游戏详情 | `DiscoverService` / `MainViewModel` | 仅使用现有字段，不推断扩展字段 | TODO |
| 专辑详情 | `/api/albums/{id}` | Album Detail | `AlbumService` + `AlbumDetailSectionPanel` | 曲目列表来源与展示逻辑一致 | IN_PROGRESS |

## C. 播放与队列

| Domain | API/Source | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 播放模式 | 前端状态机 | `frontend/src/store/playerStore.ts` | `MainViewModel` | `sequence/loop/shuffle/single` 语义一致 | IN_PROGRESS |
| 队列替换 | 点击曲目行为 | Player + Queue | `Play*Command` 系列 | 点击曲目替换当前队列 | IN_PROGRESS |
| 下一首逻辑 | 队列推进 | `playerStore` | `HandleTrackEndedCommand` | next/prev 边界一致 | TODO |
| 播放上报 | `POST /api/public/tracks/:id/play` | Web 上报逻辑 | `TrackService`/`MainViewModel` | 上报参数与阈值规则一致 | TODO |

## D. 收藏与歌单

| Domain | API/Source | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 收藏切换 | Favorite API | 收藏交互 | `FavoriteService` | 登录态、错误处理一致 | TODO |
| 歌单管理 | Playlist API | 歌单页 | `PlaylistService` | 创建/删除/增删曲目一致 | TODO |

## E. 错误与可用性

| Domain | API/Source | Web 参考 | Windows 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|---|
| 统一错误映射 | `{ success, error }` | Web 错误提示风格 | 服务层 + ViewModel | 同类错误提示一致、不中断主流程 | TODO |
| 页面状态模板 | 页面状态管理 | 各页面状态反馈 | `MainWindow.xaml` | 加载/空态/错误态一致 | TODO |

## 本周执行顺序
1. 完成 A/B/C 的 `TODO -> IN_PROGRESS` 拆解到具体文件与任务。
2. 优先落地“统一错误映射层”。
3. 为播放模式与队列边界补回归测试。

---
更新日期：2026-04-08

