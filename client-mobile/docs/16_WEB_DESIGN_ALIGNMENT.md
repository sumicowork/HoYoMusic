# 16 - Web 设计语言对齐（Android）

## 对齐来源

- `frontend/src/theme/theme.css`
- `frontend/src/theme/themeConfig.ts`
- `frontend/src/theme/aurora-glass.css`
- `frontend/src/theme/mobile-all-pages.css`

## 已映射到 Android 的关键 Token

1. 主色 `#667eea` -> `MaterialTheme.colorScheme.primary`
2. 次色 `#764ba2` -> `MaterialTheme.colorScheme.secondary`
3. 深色基底 `#141414/#1f1f1f/#262626` -> `background/surface/surfaceVariant`
4. 浅色基底 `#f5f5f5/#ffffff/#fafafa` -> `background/surface/surfaceVariant`
5. 边框色 `#d9d9d9/#434343` -> `outline`
6. 文本层级 `rgba(...,0.88/0.65/0.45/0.25)` -> `onBackground/onSurface + Typography`
7. 玻璃背景+极光渐变 -> `GlassBackground`
8. 玻璃卡片边框/阴影/圆角 -> `GlassCard`
9. 主按钮渐变 `#667eea -> #764ba2` -> `GlassPrimaryButton`
10. 二级按钮半透明玻璃 -> `GlassGhostButton`
11. 页面标题风格（Display/Section）-> `GlassSectionTitle`
12. 移动端间距体系（8/12/16/20）-> 各页面统一间距

## 本轮主要更新页

- `feature/home/HomeScreen.kt`
- `feature/track/TrackListScreen.kt`
- `feature/track/TrackDetailScreen.kt`
- `feature/favorite/FavoriteScreen.kt`
- `feature/playlist/PlaylistListScreen.kt`
- `feature/playlist/PlaylistDetailScreen.kt`
- `feature/download/DownloadCenterScreen.kt`
- `feature/settings/SettingsScreen.kt`
- `feature/auth/LoginScreen.kt`
- `feature/player/MiniPlayerBar.kt`
- `feature/player/PlayerScreen.kt`

更新日期：2026-04-10

