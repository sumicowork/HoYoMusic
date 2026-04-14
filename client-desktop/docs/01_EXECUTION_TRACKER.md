# Phase 1 Execution Tracker

> 状态枚举：`TODO | IN_PROGRESS | DONE | BLOCKED`
> 维护原则：只记录可执行项；每项必须有验收标准。

## 当前迭代目标（Sprint 1）
- 对齐核心契约：认证、发现、播放模式、队列边界。
- 建立统一错误映射，避免未处理异常直达 UI。
- 建立服务层回归测试基线，确保后续改动可控。

## 执行看板

| ID | 工作项 | 对应文件/模块 | 状态 | 验收标准 | 下一步 |
|---|---|---|---|---|---|
| P1-001 | 完成服务层契约矩阵细化 | `client-desktop/PHASE1_CONTRACT_MATRIX.md` | IN_PROGRESS | A/B/C 核心项都具备状态与实现点 | 补齐每行 owner 与预计完成日 |
| P1-002 | 统一 API 错误映射接入 | `HoYoMusic.Desktop.Core/Contracts/ApiErrorMapper.cs` + `Infrastructure/Services/*` | IN_PROGRESS | 常见错误返回可映射成可读消息 | 清点未接入服务并补齐 |
| P1-003 | 播放模式边界回归 | `MainViewModel` + `PlaybackQueueRulesTests.cs` | IN_PROGRESS | `sequence/loop/shuffle/single` 与 Web 行为一致 | 增加 next/prev 边界用例 |
| P1-004 | 播放上报闭环 | `TrackService` + 播放事件调用链 | TODO | 播放事件可稳定上报且失败不打断播放 | 定义最小播放阈值策略 |
| P1-005 | 页面状态模板统一 | `MainWindow.xaml` + VM 状态字段 | TODO | 加载/空态/错误态语义统一 | 抽出公共状态展示片段 |
| P1-006 | Admin 入口与权限回归 | `MainViewModel` + UI 显示条件 | DONE | 非管理员不展示管理入口 | 合并到每次发布回归清单 |

## 本周落地顺序
1. 收敛 `P1-002`：确保所有服务异常走统一映射。
2. 推进 `P1-003`：补齐播放队列边界测试。
3. 启动 `P1-004`：接入播放上报与失败保护。

## 交付检查
- `dotnet build` 成功。
- `dotnet test` 通过。
- 文档状态同步更新（矩阵 + 看板）。
- 变更说明包含“与 Web 对齐点”。

