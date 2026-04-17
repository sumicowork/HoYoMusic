# 前端逐文件全量对齐清单（Web -> Windows Desktop）

> 更新日期：2026-04-15
> 说明：本清单基于 `frontend/src` 每一个可执行前端文件（`.ts/.tsx/.css`）逐一盘点，面向 Windows 客户端开发实施。

## 全量统计
- 扫描文件总数：`141`
- `DONE`：`10`
- `IN_PROGRESS`：`50`
- `TODO`：`81`
- Desktop 现有分区：`AdminSectionPanel, AlbumDetailSectionPanel, AlbumsSectionPanel, ArtistsSectionPanel, DiscoverSectionPanel, DownloadsSectionPanel, FavoritesSectionPanel, GamesSectionPanel, LibrarySectionPanel, PlaylistsSectionPanel, ProfileSectionPanel, SearchSectionPanel, SettingsSectionPanel, TagsSectionPanel`
- Desktop 已有服务抽象：`IAlbumService, IAuthService, ICreditsService, IDiscoverService, IDownloadService, IFavoriteService, IGameService, ILyricsService, IMessageService, IMusicSourceService, IPlaylistService, ISiteConfigService, ITokenStore, ITrackService`

## 逐文件对齐明细

| 文件 | 类别 | Web 实现要点（自动提取） | Desktop 对应 | 状态 | Windows 开发需求 |
|---|---|---|---|---|---|
| `frontend/src/components/admin/AdminActionBar.css` | `admin` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/admin/AdminActionBar.tsx` | `admin` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/admin/AdminPageHeader.css` | `admin` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/admin/AdminPageHeader.tsx` | `admin` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/PlayQueue.tsx` | `components` | stores=usePlayerStore | 队列浮层 | `DONE` | 持续收敛交互细节 |
| `frontend/src/components/SiteComplianceFooter.tsx` | `components` | services=siteConfigService；endpoints=/admin | 备案信息区 | `DONE` | 持续对齐链接与显示条件 |
| `frontend/src/components/AuthModal.tsx` | `components` | services=authService；stores=useAuthStore,useAuthModalStore；endpoints=/admin | 账号浮层 | `IN_PROGRESS` | 补齐模式切换与重定向恢复语义 |
| `frontend/src/components/FirstVisitModal.tsx` | `components` | services=siteConfigService；endpoints=/admin | 首次访问覆盖层 | `IN_PROGRESS` | 补齐文案/交互细节 |
| `frontend/src/components/Player.tsx` | `components` | services=favoriteService,lyricsService,trackService；stores=usePlayerStore | 底部播放器 + 详情/队列浮层 | `IN_PROGRESS` | 补齐均衡器/跨曲渐变/频谱可视化 |
| `frontend/src/components/PlaylistPickerModal.tsx` | `components` | services=playlistService | 通过歌单下拉实现 | `IN_PROGRESS` | 补齐独立挑选器体验 |
| `frontend/src/components/AdminLayout.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/AdminLayout.tsx` | `components` | stores=useAuthStore；endpoints=/admin,/admin/albums,/admin/analytics,/admin/artists,/admin/games,/admin/login,/admin/music-sources/library,/admin/settings | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/AlbumCoverUpload.tsx` | `components` | endpoints=/api | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/BulkMoveAlbumModal.tsx` | `components` | services=albumService,trackService | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/BulkTagModal.tsx` | `components` | services=tagService | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/CoverUpload.tsx` | `components` | services=albumService,trackService | 缺失 | `TODO` | 新增封面上传流程 |
| `frontend/src/components/CreditsDisplay.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/CreditsDisplay.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/CreditsEditor.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/CreditsImportModal.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/CrossfadeControl.tsx` | `components` | stores=usePlayerStore | 缺失 | `TODO` | 新增跨曲渐变控制 |
| `frontend/src/components/EqualizerControl.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/EqualizerControl.tsx` | `components` | stores=useEqualizerStore | 缺失 | `TODO` | 新增 EQ 状态与 UI |
| `frontend/src/components/FeedbackModal.tsx` | `components` | services=feedbackService | 缺失 | `TODO` | 新增反馈弹窗与提交流程 |
| `frontend/src/components/HeartButton.tsx` | `components` | services=favoriteService | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/KeyboardShortcutsModal.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/LazyImage.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/LyricsBatchImportModal.tsx` | `components` | services=lyricsImportService | Admin MusicSources 子分区歌词导入工具 | `IN_PROGRESS` | 已接入预览/提交，继续补齐冲突处理体验 |
| `frontend/src/components/LyricsDisplay.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/LyricsDisplay.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/LyricsEditor.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/MarkdownContent.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/MarkdownContent.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/MobileTabBar.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/MobileTabBar.tsx` | `components` | stores=usePlayerStore；endpoints=/albums,/artists,/library,/search | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/MusicSourceImportModal.tsx` | `components` | services=musicSourceService | 缺失 | `TODO` | 新增来源导入预览与提交 |
| `frontend/src/components/MusicSourcesDisplay.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/MusicSourcesDisplay.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/PageHeader.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/PageHeader.tsx` | `components` | services=messageService；stores=useAuthStore,useAuthModalStore；endpoints=/admin,/albums,/artists,/library,/me,/search,/tags | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/PageTransition.tsx` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/PlayQueue.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/Player.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/ProtectedRoute.tsx` | `components` | stores=useAuthStore,useAuthModalStore | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/SideNav.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/SideNav.tsx` | `components` | stores=useAuthStore,useThemeStore,useAuthModalStore；endpoints=/admin,/albums,/artists,/library,/me,/search,/tags | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/SiteComplianceFooter.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/SleepTimer.tsx` | `components` | stores=usePlayerStore | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/SpectrumVisualizer.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/SpectrumVisualizer.tsx` | `components` | stores=usePlayerStore | 缺失 | `TODO` | 新增可视化组件 |
| `frontend/src/components/TagGroupManager.tsx` | `components` | services=tagService | 缺失 | `TODO` | 新增标签分组管理能力 |
| `frontend/src/components/ThemeToggle.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/ThemeToggle.tsx` | `components` | stores=useThemeStore | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/TrackNotesImportModal.tsx` | `components` | services=trackService | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/TrackTagsManager.tsx` | `components` | services=tagService | 缺失 | `TODO` | 新增曲目标签管理能力 |
| `frontend/src/components/UploadModal.css` | `components` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/components/UploadModal.tsx` | `components` | services=trackService | 缺失 | `TODO` | 新增曲目上传流程 |
| `frontend/src/components/VirtualTrackList.tsx` | `components` | stores=usePlayerStore | 待映射 | `TODO` | 补齐组件级能力与状态联动 |
| `frontend/src/config/adminNavigation.ts` | `config` | endpoints=/admin,/admin/albums,/admin/analytics,/admin/artists,/admin/games,/admin/music-sources/library,/admin/settings,/admin/tags | AdminSectionPanel 多子分区入口 | `IN_PROGRESS` | 已补 Users/Tags/Games/Artists/Albums/MusicSources/Analytics/Settings，继续补齐路由语义 |
| `frontend/src/pages/Home.tsx` | `pages` | services=albumService,gameService,trackService；stores=usePlayerStore | DiscoverSectionPanel | `DONE` | 持续收敛视觉与信息密度 |
| `frontend/src/pages/AlbumDetail.tsx` | `pages` | services=albumService,trackService；stores=usePlayerStore,useThemeStore；endpoints=/albums | AlbumDetailSectionPanel | `IN_PROGRESS` | 补齐专辑详情体验细节 |
| `frontend/src/pages/Albums.tsx` | `pages` | services=albumService | AlbumsSectionPanel（入口） | `IN_PROGRESS` | 补齐专辑页信息结构与筛选体验 |
| `frontend/src/pages/ArtistDetail.tsx` | `pages` | services=trackService；stores=usePlayerStore；endpoints=/artists | ArtistsSectionPanel（分面） | `IN_PROGRESS` | 补齐艺人详情页完整语义 |
| `frontend/src/pages/Artists.tsx` | `pages` | 静态资源/样式/基础模块 | ArtistsSectionPanel（分面） | `IN_PROGRESS` | 补齐独立列表语义与导航 |
| `frontend/src/pages/GameDetail.tsx` | `pages` | services=gameService | GamesSectionPanel（入口） | `IN_PROGRESS` | 补齐详情级内容结构与动作链路 |
| `frontend/src/pages/Library.tsx` | `pages` | services=trackService；stores=usePlayerStore,useAuthStore；endpoints=/login | LibrarySectionPanel | `IN_PROGRESS` | 校验与 PublicLibrary 的功能边界一致性 |
| `frontend/src/pages/Maintenance.tsx` | `pages` | services=siteConfigService；stores=useAuthModalStore；endpoints=/admin | 维护覆盖层 | `IN_PROGRESS` | 对齐路由级维护页语义与跳转策略 |
| `frontend/src/pages/PlaylistDetail.tsx` | `pages` | services=playlistService；stores=usePlayerStore；endpoints=/me | PlaylistsSectionPanel | `IN_PROGRESS` | 补齐路由级详情能力 |
| `frontend/src/pages/Profile.tsx` | `pages` | services=favoriteService,playlistService；stores=usePlayerStore,useAuthStore | ProfileSectionPanel | `IN_PROGRESS` | 补齐个人中心细节与统计信息 |
| `frontend/src/pages/PublicLibrary.tsx` | `pages` | services=favoriteService,playlistService,trackService；stores=usePlayerStore | LibrarySectionPanel | `IN_PROGRESS` | 补齐高级筛选与批量操作细节 |
| `frontend/src/pages/Search.tsx` | `pages` | services=favoriteService,gameService,playlistService,tagService,trackService；stores=usePlayerStore,useSearchStore | SearchSectionPanel | `IN_PROGRESS` | 补齐复合筛选与结果卡片一致性 |
| `frontend/src/pages/Settings.tsx` | `pages` | services=api,feedbackService,siteConfigService,trackService；endpoints=/admin/music-sources/library,/api/docs,/auth/change-password | SettingsSectionPanel（用户+管理） | `IN_PROGRESS` | 已接入维护/首次访问/备案/测试邮件/管理员发信+反馈提交，继续补齐系统工具项 |
| `frontend/src/pages/TagDetail.tsx` | `pages` | services=tagService,trackService；stores=usePlayerStore；endpoints=/tags | TagsSectionPanel（分面） | `IN_PROGRESS` | 补齐标签详情页完整语义 |
| `frontend/src/pages/Tags.tsx` | `pages` | services=tagService | TagsSectionPanel（分面） | `IN_PROGRESS` | 补齐标签列表页结构 |
| `frontend/src/pages/TrackDetail.tsx` | `pages` | services=favoriteService,playlistService,tagService,trackService；stores=usePlayerStore,useThemeStore | 曲目详情浮层 | `IN_PROGRESS` | 补齐详情页语义、结构和交互密度 |
| `frontend/src/pages/Admin.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/Admin.tsx` | `pages` | services=trackService；stores=usePlayerStore | AdminSectionPanel（Users/Tags/Games/Artists/Albums/MusicSources/Analytics/Settings） | `IN_PROGRESS` | 继续补齐管理写接口与模块深度能力 |
| `frontend/src/pages/AlbumDetail.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/AlbumManagement.tsx` | `pages` | services=albumService,creditsService,discService,gameService | Admin Albums 子分区 Disc 工具 | `IN_PROGRESS` | 已接入 Disc CRUD/曲目绑定，继续补齐专辑写能力 |
| `frontend/src/pages/Albums.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/Analytics.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/Analytics.tsx` | `pages` | services=api；endpoints=/analytics/behavior/coverage,/analytics/cache,/analytics/cache/warmup,/analytics/hourly,/analytics/overview,/analytics/recent?limit=100,/analytics/storage | 缺失 | `TODO` | 新增分析统计子页面 |
| `frontend/src/pages/ArtistDetail.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/ArtistManagement.tsx` | `pages` | services=api,trackService；endpoints=/artists/aliases,/artists/avatars,/artists/merge,/artists/roles,/artists/roles/aliases,/artists/roles/merge | 缺失 | `TODO` | 新增艺术家管理子页面 |
| `frontend/src/pages/Artists.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/GameDetail.css` | `pages` | endpoints=/games/honkai3.png,/games/nexus.jpg,/games/petit.jpg,/games/tears.jpg,/genshin-bg.png,/starrail-bg.png,/zzz-bg.jpg | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/GameManagement.tsx` | `pages` | services=api,gameService；endpoints=/games | 缺失 | `TODO` | 新增游戏管理子页面 |
| `frontend/src/pages/Home.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/Library.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/Maintenance.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/MusicSourceLibraryManagement.tsx` | `pages` | services=gameService,musicSourceService | Admin MusicSources 子分区 + LyricsImport 工具 | `IN_PROGRESS` | 已接入歌词导入预览/提交，继续补齐来源库管理 |
| `frontend/src/pages/Profile.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/PublicLibrary.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/Search.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/TagDetail.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/TagManagement.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/TagManagement.tsx` | `pages` | services=tagService | Admin Tags 子分区 | `IN_PROGRESS` | 已支持标签/分组 CRUD，继续收敛与 Web 页面布局差异 |
| `frontend/src/pages/Tags.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/TrackDetail.css` | `pages` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/pages/UserManagement.tsx` | `pages` | services=messageService,userService；stores=useAuthStore | Admin Users 子分区 | `IN_PROGRESS` | 已支持分页/筛选/角色/状态/重置密码，继续补齐 Web 细节 |
| `frontend/src/services/authService.ts` | `services` | endpoints=/auth/login,/auth/me,/auth/register,/auth/send-verification-code | IAuthService + AuthService | `DONE` | 保持与 Web 参数/错误码一致 |
| `frontend/src/services/favoriteService.ts` | `services` | endpoints=/favorites,/favorites/check,/favorites/toggle | IFavoriteService + FavoriteService | `DONE` | 保持收藏批量语义一致 |
| `frontend/src/services/playlistService.ts` | `services` | endpoints=/playlists | IPlaylistService + PlaylistService | `DONE` | 保持详情与批量操作一致 |
| `frontend/src/services/albumService.ts` | `services` | endpoints=/albums/bulk-game | IAlbumService + AlbumService | `IN_PROGRESS` | 补齐专辑列表/更新/封面/BPM 工具链 |
| `frontend/src/services/creditsService.ts` | `services` | endpoints=/credits/export | ICreditsService + CreditsService | `IN_PROGRESS` | 补齐编辑与导出能力 |
| `frontend/src/services/gameService.ts` | `services` | endpoints=/games | IGameService + GameService | `IN_PROGRESS` | 补齐 getGameById 与管理写接口 |
| `frontend/src/services/lyricsService.ts` | `services` | 静态资源/样式/基础模块 | ILyricsService + LyricsService | `IN_PROGRESS` | 补齐编辑与导入工作流 |
| `frontend/src/services/messageService.ts` | `services` | endpoints=/messages/admin/send,/messages/read-all,/messages/unread-count | IMessageService + MessageService | `DONE` | 已接入管理员发信 sendByAdmin 与桌面管理表单 |
| `frontend/src/services/musicSourceService.ts` | `services` | endpoints=/music-sources/categories,/music-sources/export,/music-sources/import/candidates,/music-sources/import/commit,/music-sources/import/preview,/music-sources/nodes | IMusicSourceService + MusicSourceService | `IN_PROGRESS` | 补齐库管理、导入预览/提交、导出能力 |
| `frontend/src/services/siteConfigService.ts` | `services` | endpoints=/public/site-config/compliance,/public/site-config/first-visit-modal,/public/site-config/maintenance,/settings/compliance,/settings/first-visit-modal,/settings/maintenance,/settings/test-email | ISiteConfigService + SiteConfigService | `DONE` | 已接入 admin 读写配置、测试邮件及格式校验 |
| `frontend/src/services/trackService.ts` | `services` | endpoints=/api,/placeholder-cover.jpg,/tracks/bulk,/tracks/bulk-move,/tracks/duplicates/same-album-title,/tracks/filter-options,/tracks/metadata-export,/tracks/metadata-import/commit | ITrackService + TrackService | `IN_PROGRESS` | 补齐管理端批量/导入导出相关接口 |
| `frontend/src/services/api.ts` | `services` | stores=useAuthModalStore | 无独立等价层 | `TODO` | 补充 Desktop API 客户端策略层（鉴权/缓存/visitor-id/401 恢复语义） |
| `frontend/src/services/discService.ts` | `services` | endpoints=/discs,/tracks/:id/disc | IDiscService + DiscService | `IN_PROGRESS` | 已有契约与实现，继续补齐 UI 流程 |
| `frontend/src/services/feedbackService.ts` | `services` | endpoints=/public/feedback,/settings/feedback | IFeedbackService + FeedbackService | `IN_PROGRESS` | 已接入提交反馈，继续补齐 admin 列表能力 |
| `frontend/src/services/lyricsImportService.ts` | `services` | endpoints=/lyrics/import/commit,/lyrics/import/preview | ILyricsImportService + LyricsImportService | `IN_PROGRESS` | 已有契约与实现，继续补齐导入 UI 流程 |
| `frontend/src/services/tagService.ts` | `services` | endpoints=/tags,/tags/bulk-update,/tags/groups,/tags/groups/all | ITagService + TagService | `DONE` | 已支持 Tag/TagGroup CRUD 与批量标签接口 |
| `frontend/src/services/userService.ts` | `services` | endpoints=/users,/users/:id/status,/users/:id/role,/users/:id/reset-password | IUserService + UserService | `DONE` | 已支持用户管理、角色、状态与重置密码 |
| `frontend/src/App.css` | `src` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐对应能力 |
| `frontend/src/App.tsx` | `src` | stores=usePlayerStore,useAuthStore,useThemeStore；endpoints=/admin,/admin/albums,/admin/analytics,/admin/artists,/admin/games,/admin/music-sources/library,/admin/settings,/admin/tags | 待映射 | `TODO` | 补齐对应能力 |
| `frontend/src/index.css` | `src` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐对应能力 |
| `frontend/src/main.tsx` | `src` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐对应能力 |
| `frontend/src/store/authStore.ts` | `store` | services=authService；stores=useAuthStore | MainViewModel 鉴权状态 | `IN_PROGRESS` | 对齐初始化、恢复、登出语义 |
| `frontend/src/store/playerStore.ts` | `store` | stores=usePlayerStore | MainViewModel 播放/队列状态 | `IN_PROGRESS` | 补齐 crossfadeDuration/sleepTimerEnd 等等语义持久化一致性 |
| `frontend/src/store/searchStore.ts` | `store` | stores=useSearchStore | RecentSearchKeywords | `IN_PROGRESS` | 对齐上限、去重、删除行为 |
| `frontend/src/store/themeStore.ts` | `store` | stores=useThemeStore | ThemeMode + LocalSettings | `IN_PROGRESS` | 对齐切换入口与持久化细节 |
| `frontend/src/store/authModalStore.ts` | `store` | stores=useAuthModalStore | 缺失 | `TODO` | 新增认证弹窗模式/重定向状态层 |
| `frontend/src/store/equalizerStore.ts` | `store` | stores=useEqualizerStore | 缺失 | `TODO` | 新增 Equalizer 状态模型 |
| `frontend/src/theme/aurora-glass.css` | `theme` | endpoints=/%3E%3C/filter%3E%3Crect width=,/%3E%3C/svg%3E | 主题资源层 | `IN_PROGRESS` | 对齐主题 token、样式变量和切换行为 |
| `frontend/src/theme/publicPages.css` | `theme` | 静态资源/样式/基础模块 | 主题资源层 | `IN_PROGRESS` | 对齐主题 token、样式变量和切换行为 |
| `frontend/src/theme/theme.css` | `theme` | 静态资源/样式/基础模块 | 主题资源层 | `IN_PROGRESS` | 对齐主题 token、样式变量和切换行为 |
| `frontend/src/theme/themeConfig.ts` | `theme` | 静态资源/样式/基础模块 | 主题资源层 | `IN_PROGRESS` | 对齐主题 token、样式变量和切换行为 |
| `frontend/src/theme/mobile-all-pages.css` | `theme` | 静态资源/样式/基础模块 | 待映射 | `TODO` | 补齐页面级功能与导航入口 |
| `frontend/src/types/index.ts` | `types` | 静态资源/样式/基础模块 | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |
| `frontend/src/utils/audioContext.ts` | `utils` | 静态资源/样式/基础模块 | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |
| `frontend/src/utils/debugFeature.ts` | `utils` | stores=useAuthStore | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |
| `frontend/src/utils/format.ts` | `utils` | 静态资源/样式/基础模块 | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |
| `frontend/src/utils/imageUtils.ts` | `utils` | endpoints=/%3E%3C/g%3E%3Ctext x=,/%3E%3Ccircle cx=,/%3E%3Cg transform=,/%3E%3Cpath d=,/api,/uploads/ | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |
| `frontend/src/utils/tagPath.ts` | `utils` | 静态资源/样式/基础模块 | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |
| `frontend/src/utils/toast.ts` | `utils` | 静态资源/样式/基础模块 | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |
| `frontend/src/utils/useDebounce.ts` | `utils` | 静态资源/样式/基础模块 | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |
| `frontend/src/utils/useDominantColor.ts` | `utils` | 静态资源/样式/基础模块 | 基础设施/工具层 | `IN_PROGRESS` | 按功能被调用场景逐步补齐 Desktop 工具层 |

## 开发落地建议（按依赖顺序）
1. 先补服务契约缺口：`Tag/User/Feedback/Disc/LyricsImport`。
2. 再补 admin 路由与子模块：`Users/Analytics/Tags/Games/Artists/Albums/MusicSource/Settings`。
3. 最后补播放器增强与体验细节：`Equalizer/Crossfade/Spectrum/Modal 跳转恢复`。
