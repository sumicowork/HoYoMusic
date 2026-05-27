# 08 行为一致性分析（Web -> Windows Desktop）

## 范围
- 基线来源：`frontend/src/App.tsx`、`frontend/src/components/ProtectedRoute.tsx`、`frontend/src/store/authStore.ts`、`frontend/src/store/playerStore.ts`、`frontend/src/store/searchStore.ts`。
- 桌面对应：`client-desktop/src/HoYoMusic.Desktop.App/ViewModels/MainViewModel*.cs`、`Controls/HoYoMainContent.xaml`。

## 关键差异（本轮聚焦）
1. 详情页入口一致性
- Web：从发现/曲库/收藏/歌单/专辑曲目进入详情页，行为稳定且可返回来源页。
- Desktop（修复前）：详情页返回入口不统一，存在固定返回到发现/曲库的硬编码按钮，且上下文无法保持。
- 本轮目标：实现来源感知返回（context-aware back）。

2. 详情页返回语义
- Web：`navigate(-1)` 优先，语义是“返回上一步用户上下文”。
- Desktop（修复前）：固定按钮导致上下文跳转偏差。
- 本轮目标：统一通过 `BackFromDetailCommand` 返回到记录的来源 section。

3. 详情页打开路径
- Web：`/albums/:id` 与 `/track/:id` 分离，track 可从多入口打开。
- Desktop：`SectionAlbumDetail` 与 `SectionTrackDetail` 分离，但来源记录缺失。
- 本轮目标：在 `OpenAlbumDetailAsync` / `OpenTrackDetailAsync` / `OpenDiscoverTrackDetailAsync` / `OpenAlbumTrackDetailAsync` 进入详情前记录来源。

## 本轮落地约束
- 不改 API 合约，不改后端接口。
- 只改桌面导航行为与文档基线，先收敛用户反馈最强的问题（专辑/歌曲详情打开与返回）。

## 验收口径
- 从 `discover/albums/games/library/favorites/playlists/album-detail` 进入 `track-detail` 后，点击“返回上一页”应回到正确来源。
- 从 `discover/albums/games` 进入 `album-detail` 后，点击“返回上一页”应回到来源列表。
- 构建通过：`dotnet build HoYoMusic.Desktop.sln`。


