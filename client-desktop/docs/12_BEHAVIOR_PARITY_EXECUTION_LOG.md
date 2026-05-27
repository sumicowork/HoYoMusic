# 12 行为一致性执行日志

## 2026-04-17（本轮）

### 已完成
- 新增详情来源感知返回状态：`_lastNonDetailSection`、`_detailBackSection`。
- 新增 `BackFromDetailCommand`，统一详情页返回语义。
- 详情打开链路加入来源记录：
  - `OpenAlbumDetailAsync`
  - `OpenAlbumTrackDetailAsync`
  - `OpenTrackDetailAsync`
  - `OpenDiscoverTrackDetailAsync`
- `HoYoMainContent.xaml` 将详情页头部返回按钮统一为“返回上一页”。
- 登出流程补充 detail back 状态兜底清理，避免回到受限页。

### 验证记录
- 构建：`dotnet build HoYoMusic.Desktop.sln -v minimal`（通过，0 error）。
- 测试：`dotnet test HoYoMusic.Desktop.sln -v minimal --no-build`（通过，90/90）。
- 启动烟测：`powershell -ExecutionPolicy Bypass -File .\scripts\startup-smoke.ps1 -SkipBuild`（通过，12 秒无启动崩溃）。

### 下一步
1. 跑全量 `dotnet test` 与 `startup-smoke.ps1`。
2. 按 `11_BEHAVIOR_PARITY_CHECKLISTS.md` 逐条人工验证详情链路。
3. 继续推进 auth/queue/search/admin 的行为一致性矩阵。

