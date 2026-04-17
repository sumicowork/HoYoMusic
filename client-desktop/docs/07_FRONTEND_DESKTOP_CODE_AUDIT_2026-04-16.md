# Frontend vs Desktop Code Audit (Code-Only)

- Generated at: `2026-04-17 08:15:13`
- Frontend scanned files: `141`
- Desktop scanned files: `101`
- Route paths found in `frontend/src/App.tsx`: `15`
- Admin nav paths found in `frontend/src/config/adminNavigation.ts`: `9`

## Overall Result

- MATCHED: `47`
- PARTIAL: `36`
- MISSING: `58`

Conclusion: **Not fully aligned yet** based on code traversal and heuristic evidence extraction.

## Route Evidence

### Frontend Routes
- `*`
- `/`
- `/albums`
- `/albums/:id`
- `/artists`
- `/artists/:id`
- `/games/:id`
- `/library`
- `/maintenance`
- `/me`
- `/playlists/:id`
- `/search`
- `/tags`
- `/tags/:id`
- `/track/:id`

### Frontend Admin Routes
- `/admin`
- `/admin/albums`
- `/admin/analytics`
- `/admin/artists`
- `/admin/games`
- `/admin/music-sources/library`
- `/admin/settings`
- `/admin/tags`
- `/admin/users`

## Service Endpoint Evidence

- Frontend endpoint literals: `54`
- Desktop endpoint literals: `102`
- Common literals: `41`
- Frontend-only literals: `13`
- Desktop-only literals: `61`

### Frontend-only Endpoint Samples
- `/albums/bulk-game`
- `/api`
- `/favorites`
- `/games`
- `/music-sources/import/candidates`
- `/placeholder-cover.jpg`
- `/playlists`
- `/settings/feedback`
- `/tags`
- `/tracks/notes-import/candidates`
- `/tracks/notes/clear-all`
- `/tracks/precheck-duplicates`
- `/tracks/preview-credits`

### Desktop-only Endpoint Samples
- `/albums/{albumId}`
- `/albums/{albumId}/discs`
- `/albums/{albumId}/discs/assign`
- `/analytics/hourly`
- `/analytics/overview`
- `/analytics/pages?days={normalizedDays}`
- `/analytics/status-codes?days={normalizedDays}`
- `/api/public/covers/proxy?path={encoded}`
- `/application/octet-stream`
- `/artists/aliases`
- `/artists/aliases/{aliasId}`
- `/artists/avatar/{escapedName}`
- `/artists/avatars`
- `/artists/merge`
- `/artists/roles/aliases`
- `/artists/roles/aliases/{aliasId}`
- `/artists/roles/merge`
- `/artists/{escaped}`
- `/auth/change-password`
- `/credits/{trackId}/credits`
- `/discs/{discId}`
- `/games/{gameId}`
- `/games/{gameId}/cover`
- `/image/gif`
- `/image/jpeg`
- `/image/png`
- `/image/webp`
- `/lyrics/{trackId}/lyrics`
- `/messages/inbox{query}`
- `/messages/{deliveryId}/read`
- `/music-sources/categories/{categoryId}`
- `/music-sources/import/candidates{query}`
- `/music-sources/nodes/{nodeId}`
- `/music-sources/nodes{query}`
- `/playlists/{playlistId}`
- `/playlists/{playlistId}/reorder`
- `/playlists/{playlistId}/tracks`
- `/playlists/{playlistId}/tracks/{trackId}`
- `/public/albums/random{query}`
- `/public/top-tracks{query}`

## File-by-File Audit

| Frontend File | Category | Status | Evidence |
|---|---|---|---|
| `frontend/src/components/AuthModal.tsx` | `components` | `MATCHED` | `账户中心; LoginCommand` |
| `frontend/src/components/BulkMoveAlbumModal.tsx` | `components` | `MATCHED` | `bulk; Album` |
| `frontend/src/components/BulkTagModal.tsx` | `components` | `MATCHED` | `bulk; Tag` |
| `frontend/src/components/CrossfadeControl.tsx` | `components` | `MATCHED` | `Crossfade; crossfade` |
| `frontend/src/components/FeedbackModal.tsx` | `components` | `MATCHED` | `SubmitFeedbackCommand; AdminFeedbackItems` |
| `frontend/src/components/FirstVisitModal.tsx` | `components` | `MATCHED` | `ShowFirstVisitModal; AcknowledgeFirstVisitCommand` |
| `frontend/src/components/Player.tsx` | `components` | `MATCHED` | `HoYoPlayerBar; PlaybackQueueView` |
| `frontend/src/components/SiteComplianceFooter.tsx` | `components` | `MATCHED` | `ShowComplianceFooter; OpenComplianceLinkCommand` |
| `frontend/src/components/TrackTagsManager.tsx` | `components` | `MATCHED` | `BulkUpdate; Tag` |
| `frontend/src/components/UploadModal.tsx` | `components` | `MATCHED` | `Upload; 上传` |
| `frontend/src/pages/Admin.tsx` | `pages` | `MATCHED` | `AdminSectionPanel; OpenAdminSection` |
| `frontend/src/pages/AlbumDetail.tsx` | `pages` | `MATCHED` | `AlbumDetailSectionPanel; album-detail` |
| `frontend/src/pages/AlbumManagement.tsx` | `pages` | `MATCHED` | `IsAdminAlbumsSection; CreateAdminDiscCommand` |
| `frontend/src/pages/Albums.tsx` | `pages` | `MATCHED` | `AlbumsSectionPanel; albums` |
| `frontend/src/pages/ArtistDetail.tsx` | `pages` | `MATCHED` | `ArtistsSectionPanel; artists` |
| `frontend/src/pages/Artists.tsx` | `pages` | `MATCHED` | `ArtistsSectionPanel; artists` |
| `frontend/src/pages/GameDetail.tsx` | `pages` | `MATCHED` | `GamesSectionPanel; games` |
| `frontend/src/pages/Home.tsx` | `pages` | `MATCHED` | `DiscoverSectionPanel; discover` |
| `frontend/src/pages/Library.tsx` | `pages` | `MATCHED` | `LibrarySectionPanel; library` |
| `frontend/src/pages/Maintenance.tsx` | `pages` | `MATCHED` | `ShowMaintenanceOverlay; MaintenanceMessage` |
| `frontend/src/pages/MusicSourceLibraryManagement.tsx` | `pages` | `MATCHED` | `IsAdminMusicSourcesSection; 歌词批量导入` |
| `frontend/src/pages/PlaylistDetail.tsx` | `pages` | `MATCHED` | `PlaylistsSectionPanel; playlists` |
| `frontend/src/pages/Profile.tsx` | `pages` | `MATCHED` | `ProfileSectionPanel; profile` |
| `frontend/src/pages/PublicLibrary.tsx` | `pages` | `MATCHED` | `LibrarySectionPanel; library` |
| `frontend/src/pages/Search.tsx` | `pages` | `MATCHED` | `SearchSectionPanel; search` |
| `frontend/src/pages/Settings.tsx` | `pages` | `MATCHED` | `SettingsSectionPanel; settings` |
| `frontend/src/pages/TagDetail.tsx` | `pages` | `MATCHED` | `TagsSectionPanel; tags` |
| `frontend/src/pages/TagManagement.tsx` | `pages` | `MATCHED` | `IsAdminTagsSection; CreateAdminTagCommand` |
| `frontend/src/pages/Tags.tsx` | `pages` | `MATCHED` | `TagsSectionPanel; tags` |
| `frontend/src/pages/TrackDetail.tsx` | `pages` | `MATCHED` | `TrackDetailStatusMessage; CurrentDetailTrack` |
| `frontend/src/pages/UserManagement.tsx` | `pages` | `MATCHED` | `IsAdminUsersSection; RefreshAdminUsersCommand` |
| `frontend/src/services/albumService.ts` | `services` | `MATCHED` | `IAlbumService.cs; AlbumService.cs` |
| `frontend/src/services/authService.ts` | `services` | `MATCHED` | `IAuthService.cs; AuthService.cs` |
| `frontend/src/services/creditsService.ts` | `services` | `MATCHED` | `ICreditsService.cs; CreditsService.cs` |
| `frontend/src/services/discService.ts` | `services` | `MATCHED` | `IDiscService.cs; DiscService.cs` |
| `frontend/src/services/favoriteService.ts` | `services` | `MATCHED` | `IFavoriteService.cs; FavoriteService.cs` |
| `frontend/src/services/feedbackService.ts` | `services` | `MATCHED` | `IFeedbackService.cs; FeedbackService.cs` |
| `frontend/src/services/gameService.ts` | `services` | `MATCHED` | `IGameService.cs; GameService.cs` |
| `frontend/src/services/lyricsImportService.ts` | `services` | `MATCHED` | `ILyricsImportService.cs; LyricsImportService.cs` |
| `frontend/src/services/lyricsService.ts` | `services` | `MATCHED` | `ILyricsService.cs; LyricsService.cs` |
| `frontend/src/services/messageService.ts` | `services` | `MATCHED` | `IMessageService.cs; MessageService.cs` |
| `frontend/src/services/musicSourceService.ts` | `services` | `MATCHED` | `IMusicSourceService.cs; MusicSourceService.cs` |
| `frontend/src/services/playlistService.ts` | `services` | `MATCHED` | `IPlaylistService.cs; PlaylistService.cs` |
| `frontend/src/services/siteConfigService.ts` | `services` | `MATCHED` | `ISiteConfigService.cs; SiteConfigService.cs` |
| `frontend/src/services/tagService.ts` | `services` | `MATCHED` | `ITagService.cs; TagService.cs` |
| `frontend/src/services/trackService.ts` | `services` | `MATCHED` | `ITrackService.cs; TrackService.cs` |
| `frontend/src/services/userService.ts` | `services` | `MATCHED` | `IUserService.cs; UserService.cs` |
| `frontend/src/App.css` | `App.css` | `PARTIAL` | `app` |
| `frontend/src/App.tsx` | `App.tsx` | `PARTIAL` | `app` |
| `frontend/src/components/EqualizerControl.tsx` | `components` | `PARTIAL` | `Equalizer` |
| `frontend/src/components/MusicSourceImportModal.tsx` | `components` | `PARTIAL` | `music source` |
| `frontend/src/components/PlayQueue.css` | `components` | `PARTIAL` | `playqueue` |
| `frontend/src/components/PlayQueue.tsx` | `components` | `PARTIAL` | `PlayQueue` |
| `frontend/src/components/Player.css` | `components` | `PARTIAL` | `player` |
| `frontend/src/components/SleepTimer.tsx` | `components` | `PARTIAL` | `SleepTimer` |
| `frontend/src/components/SpectrumVisualizer.tsx` | `components` | `PARTIAL` | `Spectrum` |
| `frontend/src/index.css` | `index.css` | `PARTIAL` | `index` |
| `frontend/src/main.tsx` | `main.tsx` | `PARTIAL` | `main` |
| `frontend/src/pages/Admin.css` | `pages` | `PARTIAL` | `admin` |
| `frontend/src/pages/AlbumDetail.css` | `pages` | `PARTIAL` | `albumdetail` |
| `frontend/src/pages/Albums.css` | `pages` | `PARTIAL` | `albums` |
| `frontend/src/pages/Analytics.css` | `pages` | `PARTIAL` | `analytics` |
| `frontend/src/pages/Analytics.tsx` | `pages` | `PARTIAL` | `IsAdminAnalyticsSection` |
| `frontend/src/pages/ArtistManagement.tsx` | `pages` | `PARTIAL` | `IsAdminArtistsSection` |
| `frontend/src/pages/Artists.css` | `pages` | `PARTIAL` | `artists` |
| `frontend/src/pages/GameDetail.css` | `pages` | `PARTIAL` | `gamedetail` |
| `frontend/src/pages/GameManagement.tsx` | `pages` | `PARTIAL` | `IsAdminGamesSection` |
| `frontend/src/pages/Library.css` | `pages` | `PARTIAL` | `library` |
| `frontend/src/pages/Maintenance.css` | `pages` | `PARTIAL` | `maintenance` |
| `frontend/src/pages/Profile.css` | `pages` | `PARTIAL` | `profile` |
| `frontend/src/pages/PublicLibrary.css` | `pages` | `PARTIAL` | `publiclibrary` |
| `frontend/src/pages/Search.css` | `pages` | `PARTIAL` | `search` |
| `frontend/src/pages/Tags.css` | `pages` | `PARTIAL` | `tags` |
| `frontend/src/pages/TrackDetail.css` | `pages` | `PARTIAL` | `trackdetail` |
| `frontend/src/services/api.ts` | `services` | `PARTIAL` | `api` |
| `frontend/src/store/authStore.ts` | `store` | `PARTIAL` | `auth` |
| `frontend/src/store/equalizerStore.ts` | `store` | `PARTIAL` | `equalizer` |
| `frontend/src/store/playerStore.ts` | `store` | `PARTIAL` | `player` |
| `frontend/src/store/searchStore.ts` | `store` | `PARTIAL` | `search` |
| `frontend/src/store/themeStore.ts` | `store` | `PARTIAL` | `theme` |
| `frontend/src/theme/theme.css` | `theme` | `PARTIAL` | `theme` |
| `frontend/src/types/index.ts` | `types` | `PARTIAL` | `index` |
| `frontend/src/utils/format.ts` | `utils` | `PARTIAL` | `format` |
| `frontend/src/components/AdminLayout.css` | `components` | `MISSING` | `adminlayout` |
| `frontend/src/components/AdminLayout.tsx` | `components` | `MISSING` | `AdminLayout` |
| `frontend/src/components/AlbumCoverUpload.tsx` | `components` | `MISSING` | `AlbumCoverUpload` |
| `frontend/src/components/CoverUpload.tsx` | `components` | `MISSING` | `CoverUpload` |
| `frontend/src/components/CreditsDisplay.css` | `components` | `MISSING` | `creditsdisplay` |
| `frontend/src/components/CreditsDisplay.tsx` | `components` | `MISSING` | `CreditsDisplay` |
| `frontend/src/components/CreditsEditor.tsx` | `components` | `MISSING` | `CreditsEditor` |
| `frontend/src/components/CreditsImportModal.tsx` | `components` | `MISSING` | `CreditsImportModal` |
| `frontend/src/components/EqualizerControl.css` | `components` | `MISSING` | `equalizercontrol` |
| `frontend/src/components/HeartButton.tsx` | `components` | `MISSING` | `HeartButton` |
| `frontend/src/components/KeyboardShortcutsModal.tsx` | `components` | `MISSING` | `KeyboardShortcutsModal` |
| `frontend/src/components/LazyImage.tsx` | `components` | `MISSING` | `LazyImage` |
| `frontend/src/components/LyricsBatchImportModal.tsx` | `components` | `MISSING` | `LyricsBatchImportModal` |
| `frontend/src/components/LyricsDisplay.css` | `components` | `MISSING` | `lyricsdisplay` |
| `frontend/src/components/LyricsDisplay.tsx` | `components` | `MISSING` | `LyricsDisplay` |
| `frontend/src/components/LyricsEditor.tsx` | `components` | `MISSING` | `LyricsEditor` |
| `frontend/src/components/MarkdownContent.css` | `components` | `MISSING` | `markdowncontent` |
| `frontend/src/components/MarkdownContent.tsx` | `components` | `MISSING` | `MarkdownContent` |
| `frontend/src/components/MobileTabBar.css` | `components` | `MISSING` | `mobiletabbar` |
| `frontend/src/components/MobileTabBar.tsx` | `components` | `MISSING` | `MobileTabBar` |
| `frontend/src/components/MusicSourcesDisplay.css` | `components` | `MISSING` | `musicsourcesdisplay` |
| `frontend/src/components/MusicSourcesDisplay.tsx` | `components` | `MISSING` | `MusicSourcesDisplay` |
| `frontend/src/components/PageHeader.css` | `components` | `MISSING` | `pageheader` |
| `frontend/src/components/PageHeader.tsx` | `components` | `MISSING` | `PageHeader` |
| `frontend/src/components/PageTransition.tsx` | `components` | `MISSING` | `PageTransition` |
| `frontend/src/components/PlaylistPickerModal.tsx` | `components` | `MISSING` | `PlaylistPickerModal` |
| `frontend/src/components/ProtectedRoute.tsx` | `components` | `MISSING` | `ProtectedRoute` |
| `frontend/src/components/SideNav.css` | `components` | `MISSING` | `sidenav` |
| `frontend/src/components/SideNav.tsx` | `components` | `MISSING` | `SideNav` |
| `frontend/src/components/SiteComplianceFooter.css` | `components` | `MISSING` | `sitecompliancefooter` |
| `frontend/src/components/SpectrumVisualizer.css` | `components` | `MISSING` | `spectrumvisualizer` |
| `frontend/src/components/TagGroupManager.tsx` | `components` | `MISSING` | `TagGroupManager` |
| `frontend/src/components/ThemeToggle.css` | `components` | `MISSING` | `themetoggle` |
| `frontend/src/components/ThemeToggle.tsx` | `components` | `MISSING` | `ThemeToggle` |
| `frontend/src/components/TrackNotesImportModal.tsx` | `components` | `MISSING` | `TrackNotesImportModal` |
| `frontend/src/components/UploadModal.css` | `components` | `MISSING` | `uploadmodal` |
| `frontend/src/components/VirtualTrackList.tsx` | `components` | `MISSING` | `VirtualTrackList` |
| `frontend/src/components/admin/AdminActionBar.css` | `components` | `MISSING` | `adminactionbar` |
| `frontend/src/components/admin/AdminActionBar.tsx` | `components` | `MISSING` | `AdminActionBar` |
| `frontend/src/components/admin/AdminPageHeader.css` | `components` | `MISSING` | `adminpageheader` |
| `frontend/src/components/admin/AdminPageHeader.tsx` | `components` | `MISSING` | `AdminPageHeader` |
| `frontend/src/config/adminNavigation.ts` | `config` | `MISSING` | `adminnavigation` |
| `frontend/src/pages/ArtistDetail.css` | `pages` | `MISSING` | `artistdetail` |
| `frontend/src/pages/Home.css` | `pages` | `MISSING` | `home` |
| `frontend/src/pages/TagDetail.css` | `pages` | `MISSING` | `tagdetail` |
| `frontend/src/pages/TagManagement.css` | `pages` | `MISSING` | `tagmanagement` |
| `frontend/src/store/authModalStore.ts` | `store` | `MISSING` | `authmodal` |
| `frontend/src/theme/aurora-glass.css` | `theme` | `MISSING` | `aurora-glass` |
| `frontend/src/theme/mobile-all-pages.css` | `theme` | `MISSING` | `mobile-all-pages` |
| `frontend/src/theme/publicPages.css` | `theme` | `MISSING` | `publicpages` |
| `frontend/src/theme/themeConfig.ts` | `theme` | `MISSING` | `themeconfig` |
| `frontend/src/utils/audioContext.ts` | `utils` | `MISSING` | `audiocontext` |
| `frontend/src/utils/debugFeature.ts` | `utils` | `MISSING` | `debugfeature` |
| `frontend/src/utils/imageUtils.ts` | `utils` | `MISSING` | `imageutils` |
| `frontend/src/utils/tagPath.ts` | `utils` | `MISSING` | `tagpath` |
| `frontend/src/utils/toast.ts` | `utils` | `MISSING` | `toast` |
| `frontend/src/utils/useDebounce.ts` | `utils` | `MISSING` | `usedebounce` |
| `frontend/src/utils/useDominantColor.ts` | `utils` | `MISSING` | `usedominantcolor` |

## Method Notes

- This report is generated from source code traversal, not from previous parity documents.
- Classification is heuristic for non-service UI files; treat `PARTIAL` as requiring manual confirmation.
- Machine-readable details: `C:/Users/sumi/WebstormProjects/HoYoMusic/client-desktop/docs/07_FRONTEND_DESKTOP_CODE_AUDIT_2026-04-16.json`
