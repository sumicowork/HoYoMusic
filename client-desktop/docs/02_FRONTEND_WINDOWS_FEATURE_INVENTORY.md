# 前端 vs Windows 功能盘点（全量基线）

> 更新日期：2026-04-15

## 盘点范围
- Web 基线（全量遍历）：
  - `frontend/src/App.tsx`
  - `frontend/src/pages/*.tsx`（24 个页面模块）
  - `frontend/src/services/*.ts`（17 个服务模块）
  - `frontend/src/components/*.tsx`（含 admin 子目录，重点统计带 service/store 依赖的组件）
  - `frontend/src/store/*.ts`（6 个状态仓库）
- Windows 基线：
  - `client-desktop/src/HoYoMusic.Desktop.App/MainWindow.xaml`
  - `client-desktop/src/HoYoMusic.Desktop.App/MainWindow.xaml.cs`
  - `client-desktop/src/HoYoMusic.Desktop.App/ViewModels/MainViewModel.cs`
  - `client-desktop/src/HoYoMusic.Desktop.Core/Abstractions/*.cs`
  - `client-desktop/src/HoYoMusic.Desktop.Infrastructure/Services/*.cs`

## Web 全量能力基线

### 路由与页面（`frontend/src/App.tsx` + `frontend/src/pages/*`）
- Public 路由：`/`、`/games/:id`、`/library`、`/track/:id`、`/albums`、`/albums/:id`、`/artists`、`/artists/:id`、`/tags`、`/tags/:id`、`/search`、`/maintenance`。
- Protected 路由：`/playlists/:id`、`/me`。
- Admin 路由（9 条）：`/admin`、`/admin/albums`、`/admin/music-sources/library`、`/admin/artists`、`/admin/tags`、`/admin/games`、`/admin/users`、`/admin/analytics`、`/admin/settings`。
- 维护模式逻辑：前端壳层支持维护模式拦截与管理员绕过。

### 服务层（`frontend/src/services/*`）
- 已实现 service：`api`、`authService`、`trackService`、`albumService`、`gameService`、`favoriteService`、`playlistService`、`lyricsService`、`lyricsImportService`、`creditsService`、`musicSourceService`、`tagService`、`userService`、`messageService`、`siteConfigService`、`feedbackService`、`discService`。
- Web 侧存在但桌面尚无对应抽象的高差距模块：`tagService`、`userService`、`feedbackService`、`discService`、`lyricsImportService`。

### 跨页组件与状态仓库
- 关键组件：`Player`、`PlayQueue`、`EqualizerControl`、`CrossfadeControl`、`SpectrumVisualizer`、`AuthModal`、`FeedbackModal`、`FirstVisitModal`、`SiteComplianceFooter`、`PlaylistPickerModal`、`TrackTagsManager`、`TagGroupManager`、`MusicSourceImportModal`、`UploadModal`、`LyricsBatchImportModal`。
- 关键 store：`playerStore`、`equalizerStore`、`searchStore`、`themeStore`、`authStore`、`authModalStore`。

## Windows 当前能力快照

### 已覆盖能力（存在可用实现）
- 基础浏览与播放：发现、曲库、收藏、歌单、播放控制、队列、下载中心、曲目详情。
- 认证与会话：登录/注册/改密、鉴权失效处理、管理入口权限控制。
- 维护与合规：维护覆盖层、首次访问弹窗、备案信息展示（public 配置读取）。
- 核心服务抽象：`IAuthService`、`ITrackService`、`IGameService`、`IAlbumService`、`IFavoriteService`、`IPlaylistService`、`ILyricsService`、`ICreditsService`、`IMusicSourceService`、`IMessageService`、`IDownloadService`、`ISiteConfigService`。

### 缺口集中区（与 Web 全量基线对比）
- Admin 多路由能力未落地（桌面仍是单管理面板，不含 Users/Analytics/Tag/Game/Artist/Album 独立管理流）。
- 服务契约缺口：缺少 `Tag/User/Feedback/Disc/LyricsImport` 等抽象与实现。
- `siteConfig` 仅覆盖 public 读取，缺少 admin 读写配置与测试邮件。
- `musicSource` 仅覆盖曲目来源读取，缺少分类/节点管理、导入预览/提交、导出等库级能力。
- 播放器增强能力缺口：均衡器、跨曲淡入淡出、频谱可视化（Web 有对应组件与状态管理）。

## 服务覆盖对照（Web -> Windows）

| Web Service | Windows 对应 | 当前状态 | 说明 |
|---|---|---|---|
| `authService` | `IAuthService` | DONE | 登录/注册/改密/当前用户已覆盖 |
| `trackService` | `ITrackService` | IN_PROGRESS | 公共查询与播放上报已覆盖；管理端批量/导入类能力缺失 |
| `albumService` | `IAlbumService` | IN_PROGRESS | 仅专辑详情读取；列表、更新、封面、BPM相关缺失 |
| `gameService` | `IGameService` | IN_PROGRESS | 缺少 `getGameById` 与管理写操作 |
| `favoriteService` | `IFavoriteService` | DONE | 收藏主链路已覆盖 |
| `playlistService` | `IPlaylistService` | DONE | 歌单 CRUD/重排主链路已覆盖 |
| `lyricsService` | `ILyricsService` | IN_PROGRESS | 仅读取，编辑/导入能力缺失 |
| `creditsService` | `ICreditsService` | IN_PROGRESS | 仅读取，编辑/导出能力缺失 |
| `musicSourceService` | `IMusicSourceService` | IN_PROGRESS | 仅曲目来源读取，库管理缺失 |
| `messageService` | `IMessageService` | IN_PROGRESS | 收件箱链路有；管理员发信缺失 |
| `siteConfigService` | `ISiteConfigService` | IN_PROGRESS | 仅 public 配置；admin 配置缺失 |
| `tagService` | - | TODO | 桌面端无 Tag 服务抽象 |
| `userService` | - | TODO | 桌面端无 User 管理服务 |
| `feedbackService` | - | TODO | 桌面端无反馈提交/管理服务 |
| `discService` | - | TODO | 桌面端无 Disc 管理服务 |
| `lyricsImportService` | - | TODO | 桌面端无歌词导入流程服务 |

## 结论
- 本轮盘点确认：此前“100% 对齐”结论不符合 `frontend/src/` 全量实现事实。
- 桌面端已具备“可启动 + 可播放 + 可基础管理”的主骨架，但距离 Web 全量能力仍有系统性缺口。
- 后续开发应以 `docs/05_WEB_FULL_PARITY_TODO.md` 作为主清单，逐项收敛差距。

## 文件级证据
- 逐文件全量盘点见：`client-desktop/docs/06_WEB_FILE_BY_FILE_PARITY_FULL.md`。
- 当前文件级状态分布（141 文件）：`DONE 6`、`IN_PROGRESS 45`、`TODO 90`。
- 所有新增/变更文件均需在 `06` 文档中更新对应状态与开发需求。

