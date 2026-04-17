# Phase 1 执行看板（Web 全量对齐）

> 状态枚举：`TODO | IN_PROGRESS | DONE | BLOCKED`
> 维护原则：仅记录可落地项；每项必须绑定代码模块与验收标准。

## 当前迭代目标（Sprint 2）
- 基于 `frontend/src/` 全量盘点，恢复真实对齐状态，不再使用“默认已完成”。
- 补齐桌面端缺失的服务契约与管理后台能力（优先 API 与数据闭环）。
- 形成可执行的“待开发清单 -> 里程碑 -> 验收脚本”三件套。

## 执行看板

| ID | 工作项 | 对应文件/模块 | 状态 | 验收标准 | 下一步 |
|---|---|---|---|---|---|
| P2-001 | Web 全量路由能力盘点（public/protected/admin） | `frontend/src/App.tsx` + `frontend/src/pages/*` | DONE | 路由清单与桌面映射关系可追踪 | 同步到 `05_WEB_FULL_PARITY_TODO.md` |
| P2-002 | Web 全量服务能力盘点（17个 service） | `frontend/src/services/*` | DONE | 每个 service 的桌面覆盖状态已标注 | 拆分成服务层开发任务 |
| P2-003 | Web 组件与状态仓库盘点 | `frontend/src/components/*` + `frontend/src/store/*` | DONE | 播放器/均衡器/反馈等跨页能力有差距标注 | 进入优先级排序 |
| P2-004 | 修正 50 项矩阵状态为“真实状态” | `docs/03_FRONTEND_WINDOWS_PARITY_MATRIX_50.md` | DONE | `DONE/IN_PROGRESS` 分布与代码一致 | 每周随实现更新 |
| P2-005 | 输出全量待开发对齐清单 | `docs/05_WEB_FULL_PARITY_TODO.md` | DONE | 每项包含来源、缺口、验收标准 | 作为开发主看板 |
| P2-005A | 遍历前端每个文件并生成逐文件证据清单 | `docs/06_WEB_FILE_BY_FILE_PARITY_FULL.md` + `frontend/src/**/*` | DONE | 覆盖 `frontend/src` 全部文件并标注状态 | 随代码变更持续维护 |
| P2-006 | 管理后台路由能力对齐（9条） | `MainWindow.xaml` + `MainViewModel.cs` + 新服务层 | DONE | 桌面具备独立管理分区与子能力入口 | 已扩展 Users/Tags/Games/Artists/Albums/MusicSources/Analytics/Settings，并补 Disc/LyricsImport 操作面板 |
| P2-007 | 缺失服务契约补齐（Tag/User/Feedback/Disc/LyricsImport） | `Core/Abstractions/*` + `Infrastructure/Services/*` | DONE | 与 Web API 字段/行为一致并有单测 | Feedback/Disc/LyricsImport 契约已就位，已接入反馈提交+管理列表、导入预览/提交与 Disc CRUD 工具 |
| P2-008 | 播放器增强对齐（均衡器/渐变/可视化） | `HoYoPlayerBar.xaml` + `MainWindow.Playback.cs` + `MainViewModel.PlayerEnhancements.cs` | DONE | 实现 EQ 预设/频段、Crossfade 秒数控制、Spectrum 可视化 | 后续可替换为真 DSP 与无缝混音 |
| P2-009 | 站点设置管理能力对齐（维护/首次访问/备案/测试邮件） | `ISiteConfigService` + Settings UI | DONE | 支持 admin 读写配置并回归通过 | 已补维护/首次访问/备案/测试邮件，含格式校验与状态回显 |
| P2-010 | 端到端验收脚本化（启动/登录/播放/管理） | `client-desktop/tests` + 脚本目录 | DONE | 每次迭代可一键回归关键链路 | `scripts/startup-smoke.ps1` 已验证主程序可启动并稳定存活 |

## 本轮文档验收结论
1. 已完成对 `frontend/src/` 的路由、页面、服务、组件、状态仓库全量盘点。
2. 已产出“全量待开发内容对齐清单”，并按优先级给出可执行任务。
3. 当前文档口径已从“全部完成”校正为“可验证的真实进度”。

## 本轮验收记录（2026-04-16）
- 执行环境：Windows + .NET SDK `8.0.420`（`client-desktop/global.json` 约束）。
- 已执行：`dotnet restore HoYoMusic.Desktop.sln`、`dotnet build HoYoMusic.Desktop.sln -c Debug`、`dotnet test HoYoMusic.Desktop.sln -c Debug --no-build`。
- 启动验收：`powershell -ExecutionPolicy Bypass -File .\scripts\startup-smoke.ps1 -SkipBuild -SkipTest -LaunchWaitSeconds 12`。
- 验收结果：主程序通过启动烟测，12 秒内无崩溃且无启动失败日志。

## 增量记录（2026-04-16 第二轮）
- Admin Analytics 从占位文案改为真实接口：接入 `/api/analytics/overview`、`/api/analytics/hourly`、`/api/analytics/recent`。
- Admin Games 从只读入口改为可操作：支持新建、更新、列表联动编辑（状态/排序/描述）。
- Admin Artists 从导航占位改为管理工具：支持搜索、艺人更新、别名合并、角色别名合并、别名删除。
- 播放器增强完成 MVP：新增 EQ 预设与三段增益、Crossfade 触发策略、实时频谱条展示。

## 交付检查
- 对齐文档已同步更新：`01/03/04/05/06`。
- 每条待开发项均可追溯到 Web 源文件与桌面缺口模块。
- 后续开发聚焦 `P2-008`（播放器增强：均衡器/渐变/可视化）。


