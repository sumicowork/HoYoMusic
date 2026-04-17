# Web 全量对齐待开发清单（Desktop）

> 更新日期：2026-04-16  
> 目标：基于 `frontend/src/` 全量实现，给出 Desktop 端完整待开发清单。  
> 状态：`TODO | IN_PROGRESS | DONE | BLOCKED`

## 基线与统计（本清单来源）
- 路由与页面：`frontend/src/App.tsx` + `frontend/src/pages/*.tsx`（24 个页面）
- 服务层：`frontend/src/services/*.ts`（17 个 service）
- 组件层：`frontend/src/components/**/*.tsx`（重点覆盖带 service/store 依赖组件）
- 状态层：`frontend/src/store/*.ts`（6 个 store）
- Desktop 对照：`MainWindow.xaml`、`MainWindow.xaml.cs`、`MainViewModel.cs`、`Core/Abstractions/*`、`Infrastructure/Services/*`
- 文件级证据：`client-desktop/docs/06_WEB_FILE_BY_FILE_PARITY_FULL.md`（141 文件逐项状态）

## P0（先做，阻断全量对齐）

| ID | 待开发项 | Web 参考 | Desktop 现状 | 状态 | 验收标准 |
|---|---|---|---|---|---|
| P0-01 | Tag 服务抽象与实现 | `frontend/src/services/tagService.ts` | 已有 `ITagService` + `TagService` | DONE | 支持标签/分组 CRUD + 曲目标注 |
| P0-02 | User 管理服务抽象与实现 | `frontend/src/services/userService.ts` | 已有 `IUserService` + `UserService` | DONE | 支持用户列表、状态、角色、重置密码 |
| P0-03 | Feedback 服务抽象与实现 | `frontend/src/services/feedbackService.ts` | 已有 `IFeedbackService` + `FeedbackService`，已接入用户侧提交 | IN_PROGRESS | 支持反馈提交与管理端列表 |
| P0-04 | Disc 服务抽象与实现 | `frontend/src/services/discService.ts` | 已有 `IDiscService` + `DiscService` | IN_PROGRESS | 支持 Disc CRUD 与曲目绑定 |
| P0-05 | LyricsImport 服务抽象与实现 | `frontend/src/services/lyricsImportService.ts` | 已有 `ILyricsImportService` + `LyricsImportService` | IN_PROGRESS | 支持预览 + 提交导入 |
| P0-06 | SiteConfig admin 配置读写 | `frontend/src/services/siteConfigService.ts` | 已支持 maintenance/first-visit/compliance + test-email | DONE | 支持 maintenance/first-visit/compliance admin 配置 |
| P0-07 | 管理后台路由架构 | `frontend/src/App.tsx` + `frontend/src/config/adminNavigation.ts` | 已扩展 Users/Tags/Games/Artists/Albums/MusicSources/Analytics/Settings 子分区 | IN_PROGRESS | 桌面具备 9 条 admin 子能力入口 |
| P0-08 | 用户管理 UI | `frontend/src/pages/UserManagement.tsx` | Admin Users 子分区已接入分页/筛选/角色/状态/重置密码 | IN_PROGRESS | 可完成用户状态/角色/密码等管理 |
| P0-09 | 标签管理 UI | `frontend/src/pages/TagManagement.tsx` | Admin Tags 子分区已接入标签/分组 CRUD | DONE | 可完成标签与分组管理 |
| P0-10 | 数据分析 UI | `frontend/src/pages/Analytics.tsx` | 已有总览/小时/最近访问，新增 Top Pages + 状态码分布 | IN_PROGRESS | 可查看核心统计与趋势 |
| P0-11 | 系统设置管理 UI | `frontend/src/pages/Settings.tsx`（admin 部分） | Admin Settings 子分区已接入站点设置、测试邮件、管理员发信 | DONE | 可配置站点参数并测试邮件 |
| P0-12 | Music Source 库管理 UI | `frontend/src/pages/MusicSourceLibraryManagement.tsx` | Admin MusicSources 子分区已接入歌词导入预览/提交工具 | IN_PROGRESS | 支持分类/节点管理、导入预览与提交 |

## P1（高优先，用户可感知差距）

| ID | 待开发项 | Web 参考 | Desktop 现状 | 状态 | 验收标准 |
|---|---|---|---|---|---|
| P1-01 | 游戏详情页深语义 | `frontend/src/pages/GameDetail.tsx` | 仅 games 分区入口 | IN_PROGRESS | 支持详情级信息与行为闭环 |
| P1-02 | 艺人详情页深语义 | `frontend/src/pages/ArtistDetail.tsx` | 仅艺人分面筛选 | IN_PROGRESS | 支持详情内容、关联曲目、动作链路 |
| P1-03 | 标签详情页深语义 | `frontend/src/pages/TagDetail.tsx` | 仅标签分面筛选 | IN_PROGRESS | 支持详情内容、关联曲目、动作链路 |
| P1-04 | 搜索页复合筛选 | `frontend/src/pages/Search.tsx` | 基础搜索 + 最近关键词 | IN_PROGRESS | 支持 tag/game/高级筛选组合 |
| P1-05 | PlaylistDetail 详情对齐 | `frontend/src/pages/PlaylistDetail.tsx` | 歌单分区可用 | IN_PROGRESS | 对齐路由级详情密度与操作 |
| P1-06 | Profile 页面能力对齐 | `frontend/src/pages/Profile.tsx` | 个人中心摘要可用 | IN_PROGRESS | 对齐收藏/歌单快捷入口与统计信息 |
| P1-07 | PublicLibrary 交互细节对齐 | `frontend/src/pages/PublicLibrary.tsx` | 主链路可用 | IN_PROGRESS | 对齐筛选器组合与批量操作细节 |
| P1-08 | TrackDetail 结构化信息对齐 | `frontend/src/pages/TrackDetail.tsx` | 浮层详情可用 | IN_PROGRESS | 对齐详情页信息分区与操作体验 |
| P1-09 | 认证弹窗跳转恢复 | `frontend/src/components/AuthModal.tsx` + `store/authModalStore.ts` | 桌面仅账号浮层 | IN_PROGRESS | 登录后恢复目标页面/上下文 |
| P1-10 | 401 会话恢复语义 | `frontend/src/services/api.ts` | 有错误映射 | IN_PROGRESS | 会话过期提示 + 恢复流程一致 |
| P1-11 | 播放器均衡器 | `frontend/src/components/EqualizerControl.tsx` + `store/equalizerStore.ts` | 缺失 | TODO | 支持预设与频段调节、持久化 |
| P1-12 | 播放器跨曲渐变 | `frontend/src/components/CrossfadeControl.tsx` + `store/playerStore.ts` | 缺失 | TODO | 支持秒数配置与播放衔接 |
| P1-13 | 频谱可视化 | `frontend/src/components/SpectrumVisualizer.tsx` | 缺失 | TODO | 播放时可视化可切换 |
| P1-14 | 反馈弹窗与提交流程 | `frontend/src/components/FeedbackModal.tsx` | 设置分区已支持反馈提交表单 | IN_PROGRESS | 支持提交反馈与成功/失败反馈 |
| P1-15 | 管理端发信能力 | `frontend/src/services/messageService.ts` (`sendByAdmin`) | 桌面端已支持管理员发信表单 + API 调用 | DONE | 管理员可发送站内信 |
| P1-16 | Track 管理批量能力 | `frontend/src/pages/Admin.tsx` + `trackService.ts` | 管理分区仅列表/播放 | TODO | 支持批量移动专辑、批量标签、批量删除 |
| P1-17 | Track 上传与封面管理 | `frontend/src/components/UploadModal.tsx` + `CoverUpload.tsx` | 缺失 | TODO | 支持上传、封面变更、结果反馈 |
| P1-18 | Lyrics 编辑与批量导入 UI | `LyricsEditor.tsx` + `LyricsBatchImportModal.tsx` | Admin MusicSources 子分区已接入导入预览/提交 | IN_PROGRESS | 支持编辑与导入预览提交 |
| P1-19 | Credits 编辑/导出能力 | `CreditsEditor.tsx` + `creditsService.ts` | 仅 credits 只读 | TODO | 支持编辑与导出 |
| P1-20 | Track 标签管理 UI | `TrackTagsManager.tsx` | 缺失 | TODO | 支持曲目标签增删与批量更新 |

## P2（中优先，体验与运营增强）

| ID | 待开发项 | Web 参考 | Desktop 现状 | 状态 | 验收标准 |
|---|---|---|---|---|---|
| P2-01 | Album 管理页能力 | `frontend/src/pages/AlbumManagement.tsx` | Admin Albums 子分区已接入 Disc CRUD/曲目绑定工具 | IN_PROGRESS | 支持专辑 CRUD、封面、归属游戏、BPM 工具 |
| P2-02 | Game 管理页能力 | `frontend/src/pages/GameManagement.tsx` | 已有 CRUD，新增封面上传能力（本地路径上传） | IN_PROGRESS | 支持游戏 CRUD 与排序等操作 |
| P2-03 | Artist 管理页能力 | `frontend/src/pages/ArtistManagement.tsx` | 已有搜索/编辑/合并，新增分页与头像上传（本地路径上传） | IN_PROGRESS | 支持艺术家管理与关系维护 |
| P2-04 | TagGroup 管理 UI | `frontend/src/components/TagGroupManager.tsx` | 已在 Admin Tags 分区提供分组 CRUD | IN_PROGRESS | 支持标签分组管理 |
| P2-05 | MusicSource 导入向导 | `MusicSourceImportModal.tsx` + `musicSourceService.ts` | 缺失 | TODO | 支持候选预览、冲突处理、提交 |
| P2-06 | Track Notes 导入能力 | `TrackNotesImportModal.tsx` + `trackService.ts` | 缺失 | TODO | 支持候选搜索、预览、提交 |
| P2-07 | Catalog Metadata 导入能力 | `trackService.ts` 元数据导入相关方法 | 缺失 | TODO | 支持预览/提交/回滚 |
| P2-08 | 主题系统细节对齐 | `store/themeStore.ts` + `ThemeToggle.tsx` | 基础主题切换 | IN_PROGRESS | 对齐主题切换入口与持久化语义 |
| P2-09 | 搜索历史仓库语义对齐 | `store/searchStore.ts` | 基础最近搜索 | IN_PROGRESS | 对齐上限、去重、删除单项行为 |
| P2-10 | 管理导航分组语义 | `config/adminNavigation.ts` | 缺失 | TODO | 按 sectionKey 组织菜单与默认路由 |
| P2-11 | 路由级维护页跳转语义 | `App.tsx` maintenance route 逻辑 | 仅覆盖层拦截 | IN_PROGRESS | 对齐维护页路由与绕过条件 |
| P2-12 | 回归验收脚本化 | Web 路由/服务全链路 | 仅单元测试 + 人工冒烟 | IN_PROGRESS | 构建固定 smoke/regression 脚本 |

## 本轮结论
- 本轮验收口径按“主程序可启动”执行，已通过 `scripts/startup-smoke.ps1`（12 秒稳定存活，无启动失败日志）。
- Desktop 已具备“可启动 + 主播放链路 + 基础浏览/收藏/歌单/下载”的可用骨架。
- 与 Web 全量能力相比，缺口主要集中在：`管理后台`、`服务契约`、`播放器增强`、`导入导出工具链`。
- 开发推进顺序建议：`P0 -> P1 -> P2`，每完成一项同步更新 `03/04` 文档与契约矩阵状态。
- 每个任务项必须可回溯到 `06` 文档中的具体文件行，避免“功能已对齐”但缺少文件级证据。

## 本轮增量（2026-04-16 晚）
- 已扩展 Desktop 服务契约并落地实现：
  - `ITrackService` / `TrackService`：补齐批量删除、批量移动、筛选候选、重复检测、备注导入预览/提交/候选检索、元数据导入预览/提交/回滚、备注/元数据导出。
  - `IMusicSourceService` / `MusicSourceService`：补齐分类/节点 CRUD、导入预览/提交/候选检索、来源库导出。
  - `ICreditsService` / `CreditsService`：补齐 `credits/export` 导出能力。
- 新增核心模型：`TrackAdminModels.cs`（批量与导入导出模型）、`MusicSourceModels.cs` 扩展管理模型。
- 审计证据已重跑：`07_FRONTEND_DESKTOP_CODE_AUDIT_2026-04-16.md`。
- 现状仍非“全部对齐完成”，但服务层缺口已明显收敛（以最新 `07` 报告为准）。

## 本轮增量（2026-04-17）
- 管理端服务契约继续补齐：
  - `IGameService` / `GameService` 新增 `UploadGameCoverAsync`（`POST /api/games/:id/cover` 多部分上传）。
  - `IArtistService` / `ArtistService` 新增 `GetAvatarsAsync` 与 `UploadAvatarAsync`（`GET /api/artists/avatars`、`POST /api/artists/avatar/:name`）。
  - `IAnalyticsService` / `AnalyticsService` 新增 `GetPagesAsync` 与 `GetStatusCodesAsync`（`/api/analytics/pages`、`/api/analytics/status-codes`）。
- Desktop 管理 UI 增量：
  - `HoYoMainContent.xaml` 的 Analytics 分区新增「热门路径」与「状态码分布」列表。
  - Games 分区新增封面上传入口（本地路径）。
  - Artists 分区新增分页按钮/摘要与头像上传入口（本地路径）。
- ViewModel 增量：`MainViewModel.AdminParity.cs` 新增游戏封面上传命令、艺人头像上传命令、艺人分页逻辑与头像路径状态；`MainViewModel.cs` 新增艺人分页状态与 analytics 集合。
- 验证：`dotnet build`、`dotnet test --no-build`、`scripts/startup-smoke.ps1` 全部通过。
- 审计证据已刷新：`07_FRONTEND_DESKTOP_CODE_AUDIT_2026-04-16.md` / `07_FRONTEND_DESKTOP_CODE_AUDIT_2026-04-16.json`（本轮扫描 Desktop 文件数 `101`）。

