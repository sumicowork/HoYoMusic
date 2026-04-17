# 07 - Web 到 Android 行为对齐矩阵

## 目标

确保 Android 客户端在核心行为上与现有 Web 保持一致，避免“同一接口多端语义不一致”。

## A. 认证与会话

| Domain | Web 参考 | Android 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|
| 登录 | `frontend/src/services/api.ts` + auth pages | `AuthRepository` + `AuthViewModel` | token 生命周期和错误提示一致 | IN_PROGRESS |
| 401 恢复 | `api.ts` 响应拦截器 | `AuthInterceptor` + SessionManager | 401 后清 token 并引导重新登录 | DONE |
| 访客 ID | `getOrCreateVisitorId()` | VisitorIdProvider | 所有请求带 `x-visitor-id` | DONE |

## B. 列表与搜索

| Domain | Web 参考 | Android 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|
| 公共曲目列表 | `trackService.getTracksPublic` | `TrackRepository.getPublicTracks` | 默认排序与分页一致 | DONE |
| 公共搜索 | `trackService.searchTracksPublic` | `TrackSearchViewModel` | 参数命名一致，不私自扩展 | DONE |
| 热门曲目 | `trackService.getTopTracks` | HomeFeature | 仅展示后端返回字段 | DONE |

## C. 播放与队列

| Domain | Web 参考 | Android 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|
| 播放模式 | `frontend/src/store/playerStore.ts` | PlayerController | `sequence/loop/shuffle/single` 语义一致 | DONE |
| 下一首/上一首 | `playerStore.ts` | `PlayerQueueManager` | 边界行为一致 | DONE |
| 上报行为 | `trackService.recordPlay` | PlaybackReporter | 请求体字段与触发时机可对齐 | DONE |

## D. 封面与资源

| Domain | Web 参考 | Android 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|
| cover URL 处理 | `trackService.getCoverUrl` | `CoverUrlResolver` | 远程 URL 与本地路径都支持 | DONE |
| 缩略图策略 | `/public/covers/proxy?size=thumb` | 列表图片加载器 | 列表优先 thumb、详情可原图 | DONE |

## E. 错误与可用性

| Domain | Web 参考 | Android 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|
| Envelope 错误展示 | Web 服务层 throw message | Result/ErrorMapper | 同类错误文案一致 | DONE |
| 限流/维护处理 | 后端 429/503 | 全局错误组件 | 友好提示 + 可重试 | DONE |

## F. 认证用户能力（新增）

| Domain | Web 参考 | Android 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|
| 收藏列表 | `favoriteService.getFavorites` | `FavoriteRepository` + `feature/favorite` | 分页字段与 Web 一致 | IN_PROGRESS |
| 收藏切换 | `favoriteService.toggle` | `TrackDetailViewModel.toggleFavorite` | 返回 `favorited` 语义一致 | IN_PROGRESS |
| 收藏批量检查 | `favoriteService.checkFavorites` | `FavoriteRepository.checkFavorites` | 映射 `Record<number, boolean>` 一致 | DONE |
| 歌单列表 | `playlistService.getPlaylists` | `PlaylistRepository.getPlaylists` + `feature/playlist` | 返回数组和聚合字段一致 | IN_PROGRESS |
| 歌单详情 | `playlistService.getPlaylistById` | `PlaylistRepository.getPlaylistDetail` | `playlist + tracks` 包结构一致 | IN_PROGRESS |
| 歌单创建/更新/删除 | `playlistService.create/update/delete` | `PlaylistListViewModel` + `PlaylistDetailViewModel` | Envelope 与错误分支一致 | IN_PROGRESS |
| 歌单加曲/移曲/重排 | `playlistService.add/remove/reorder` | `PlaylistDetailViewModel` | 顺序与回包语义一致 | IN_PROGRESS |
| 登录门禁（收藏/歌单） | Web 路由守卫 + 401 处理 | `SessionGate` + 各 Feature `requestLogin` | 匿名触发写操作时引导登录 | IN_PROGRESS |
| 歌单选择器 | Web 歌单操作流程 | `PlaylistPickerDialog` | 选择/新建并添加曲目闭环一致 | IN_PROGRESS |

## G. 下载闭环（新增）

| Domain | Web 参考 | Android 实现点 | 一致性要求 | 状态 |
|---|---|---|---|---|
| 公共下载 URL | `trackService.getDownloadUrlPublic` | `StreamUrlResolver.publicDownloadUrl` + `DownloadRepository` | 走 `/api/public/tracks/:id/download` | DONE |
| 下载队列 | Web 无同名模块（能力补齐） | `DownloadQueueManager` | 状态持久化，重启可恢复 | IN_PROGRESS |
| 下载执行 | Web 由浏览器下载 | `TrackDownloadWorker` + `DownloadWorkScheduler` | 不阻塞 UI，支持重试/取消 | IN_PROGRESS |
| 下载中心 UI | Web 无同名模块（移动端增强） | `feature/download` | 可查看状态、清理、重试、移除 | IN_PROGRESS |
| 下载筛选与排序 | Web 浏览器下载无队列视图 | `DownloadCenterViewModel` | 筛选/排序不影响下载任务真实状态 | DONE |
| 重复下载去重 | Web 浏览器由浏览器层处理 | `DownloadRepository.enqueue` | 进行中/已完成任务避免重复入队 | DONE |

## H. Android 特有增强（不影响契约）

| Domain | Android 增强点 | 约束 |
|---|---|---|
| 后台播放通知 | MediaStyle Notification | 不改变后端接口，仅前端体验增强 |
| Audio Focus | 系统焦点管理 | 与 ExoPlayer 事件统一 |
| 断网恢复 | 网络监听 + 重试 | 不疯狂重试，保护服务端 |

## 执行建议

1. 每完成一项矩阵条目，更新状态为 `IN_PROGRESS` 或 `DONE`。
2. 每周回顾一次“Web 与 Android 语义差异”。
3. 差异若涉及契约，应优先调整 Android，不轻易改后端。

更新日期：2026-04-10（晚）
