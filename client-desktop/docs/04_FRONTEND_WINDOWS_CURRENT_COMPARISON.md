# 前端 vs Windows 当前对比（2026-04-16）

## 范围
- 前端基线：`frontend/src/App.tsx` 及 route/page/service 能力面。
- Windows 基线：`client-desktop/src/HoYoMusic.Desktop.App/MainWindow.xaml`、`MainWindow.xaml.cs`、`ViewModels/MainViewModel.cs`。
- 详细盘点来源：
  - `client-desktop/docs/02_FRONTEND_WINDOWS_FEATURE_INVENTORY.md`
  - `client-desktop/docs/03_FRONTEND_WINDOWS_PARITY_MATRIX_50.md`
  - `client-desktop/docs/05_WEB_FULL_PARITY_TODO.md`
  - `client-desktop/docs/06_WEB_FILE_BY_FILE_PARITY_FULL.md`
  - `client-desktop/PHASE1_CONTRACT_MATRIX.md`
  - `client-desktop/docs/01_EXECUTION_TRACKER.md`

## 当前能力快照

| 领域 | 前端 | Windows | 差距状态 |
|---|---|---|---|
| IA 与导航 | 首页/游戏/专辑/艺人/标签/搜索/个人中心/管理均为路由级页面 | 分区级导航 + 一体化工作区 | 公共区主干可用，admin 多子分区已接入，仍缺深层管理页 |
| 公共曲库 | 高级筛选/排序/分页/搜索 | 高级筛选/排序/分页/搜索 | 已对齐 |
| 播放与队列 | 全局播放器 + 队列动作 | 播放/队列/下载深度整合 | 桌面端一体化操作更强 |
| 收藏与歌单 | 完整 CRUD 与播放链路 | 完整 CRUD 与播放链路 + 批量工具 | 已对齐 |
| 消息与会话 | 登录弹窗 + 401 恢复 + 站内信 | 登录/注册/改密 + 站内信 + 错误映射 | 会话恢复与弹窗细节仍有差异 |
| 维护/首次访问/备案 | 壳层完整可见 + admin 设置页可配置 | public 展示 + admin 读写配置（含测试邮件） | 核心链路已对齐，待补更多配置细节 |
| 艺人/标签/搜索深度体验 | 独立详情页、语义更丰富 | 分区页 + 分面流程 | 持续对齐中 |
| 管理后台能力 | 9 条 admin 路由 + 分模块管理 | 单管理分区（已含 Users/Tags/Games/Artists/Albums/MusicSources/Analytics/Settings + Disc/LyricsImport 工具） | Games/Artists/Analytics 已接入实操，剩余深层语义持续补齐 |

## 全量对齐进度复核

### 50 项对齐矩阵（`03_FRONTEND_WINDOWS_PARITY_MATRIX_50.md`）
- 总项数：50
- `DONE`：34（68.0%）
- `IN_PROGRESS`：16（32.0%）
- `PLANNED`：0（0.0%）

### 文件级全量对齐（`06_WEB_FILE_BY_FILE_PARITY_FULL.md`）
- 总文件数：141
- `DONE`：10（7.1%）
- `IN_PROGRESS`：50（35.5%）
- `TODO`：81（57.4%）

### Phase 1 契约矩阵（`PHASE1_CONTRACT_MATRIX.md`）
- 总项数：20
- `DONE`：10（50.0%）
- `IN_PROGRESS`：9（45.0%）
- `TODO`：1（5.0%）
- `BLOCKED`：0（0.0%）

### Phase 1 执行看板（`01_EXECUTION_TRACKER.md`，P1-001~P1-011）
### Phase 2 执行看板（`01_EXECUTION_TRACKER.md`，P2-001~P2-010 + P2-005A）
- 总项数：11
- `DONE`：7（63.6%）
- `IN_PROGRESS`：3（27.3%）
- `TODO`：1（9.1%）
- `BLOCKED`：0（0.0%）

## 本轮已完成项（摘要）
1. 完成对 `frontend/src/` 的全量盘点（routes/pages/services/components/stores）。
2. 修正 50 项矩阵状态，恢复真实差距分布（33/17）。
3. 产出“全量待开发对齐清单”（`05_WEB_FULL_PARITY_TODO.md`），覆盖服务、页面、组件、管理后台。
4. 管理设置与管理员发信流程已接入桌面管理分区并可直接调用后端契约。
5. 设置分区已接入反馈提交与管理反馈列表，登录后可保留受限分区跳转意图并恢复。
6. Admin Albums/MusicSources 子分区已接入 Disc 管理与 LyricsImport 预览/提交工具。
7. Admin Analytics 已改为真实接口驱动，补齐 hourly/recent 视图。
8. Admin Games 已补新建/更新编辑器，Admin Artists 已补搜索/更新/别名与角色别名管理工具。
9. 播放器已补 EQ/Crossfade/Spectrum 的可操作 MVP（可继续迭代为真 DSP）。

## 下一批对齐重点（按用户可见优先）
- 详情页深语义：Games/Artists/Tags 的信息密度与导航层级继续向 Web 靠拢。
- 管理后台深度能力：补齐封面上传、头像上传与细粒度分页/筛选。
- 播放器增强深化：将当前 Crossfade/EQ MVP 升级为真混音与 DSP。
- 管理员发信与用户管理联动：快速选取接收人、过期时间与广播策略。


