# Windows 桌面端文档索引

## 目标
- 统一 Windows 客户端的现状、架构、路线图与执行进度入口。
- 让后续迭代按同一口径推进：`契约对齐 -> 功能闭环 -> 稳定发布`。

## 推荐阅读顺序
1. `client-desktop/README.md`：当前能力边界与运行方式。
2. `client-desktop/KNOWN_ISSUES.md`：已知限制与风险。
3. `client-desktop/PHASE1_CONTRACT_MATRIX.md`：Web 对齐任务矩阵。
4. `client-desktop/WINDOWS_CLIENT_ROADMAP.md`：中长期阶段计划。
5. `client-desktop/docs/01_EXECUTION_TRACKER.md`：当前执行看板与当期动作。
6. `client-desktop/docs/02_FRONTEND_WINDOWS_FEATURE_INVENTORY.md`：前端与桌面已实现功能盘点。
7. `client-desktop/docs/03_FRONTEND_WINDOWS_PARITY_MATRIX_50.md`：50 项重大功能对齐矩阵。
8. `client-desktop/docs/04_FRONTEND_WINDOWS_CURRENT_COMPARISON.md`：全量对齐进度复核快照。
9. `client-desktop/docs/05_WEB_FULL_PARITY_TODO.md`：基于 Web 全量实现的待开发清单。
10. `client-desktop/docs/06_WEB_FILE_BY_FILE_PARITY_FULL.md`：逐文件全量对齐明细（覆盖 `frontend/src` 每个文件）。
11. `client-desktop/docs/07_FRONTEND_DESKTOP_CODE_AUDIT_2026-04-16.md`：基于代码遍历的自动化审计报告。
12. `client-desktop/docs/08_BEHAVIOR_PARITY_ANALYSIS.md`：详情页返回导航行为一致性分析。
13. `client-desktop/docs/09_BEHAVIOR_PARITY_MATRIX.md`：行为一致性任务矩阵（第一阶段）。
14. `client-desktop/docs/10_BEHAVIOR_PARITY_RISK_ORDER.md`：行为一致性风险优先级。
15. `client-desktop/docs/11_BEHAVIOR_PARITY_CHECKLISTS.md`：行为一致性检查清单。
16. `client-desktop/docs/12_BEHAVIOR_PARITY_EXECUTION_LOG.md`：行为一致性执行日志。
17. `client-desktop/docs/13_DEVELOPMENT_PROGRESS.md`：**开发进度总文档** — 当前完成度、差距分析、推荐开发路线。

## 文档职责划分
- `README.md`：对外入口与开发者快速上手。
- `KNOWN_ISSUES.md`：问题清单，聚焦事实与影响范围。
- `PHASE1_CONTRACT_MATRIX.md`：接口与行为一致性检查表。
- `WINDOWS_CLIENT_ROADMAP.md`：阶段目标、验收标准、风险缓解。
- `01_EXECUTION_TRACKER.md`：按周推进的可执行待办。
- `02_FRONTEND_WINDOWS_FEATURE_INVENTORY.md`：功能盘点与范围基线。
- `03_FRONTEND_WINDOWS_PARITY_MATRIX_50.md`：跨端功能差距与推进状态。
- `04_FRONTEND_WINDOWS_CURRENT_COMPARISON.md`：阶段复核结论与指标快照。
- `05_WEB_FULL_PARITY_TODO.md`：可执行开发清单（按优先级分层）。
- `06_WEB_FILE_BY_FILE_PARITY_FULL.md`：文件级证据清单（开发排期与验收溯源）。

## 更新规则
- 任何新增功能必须同步更新：
  - `PHASE1_CONTRACT_MATRIX.md`（状态变化）
  - `01_EXECUTION_TRACKER.md`（任务拆解与责任）
  - `03_FRONTEND_WINDOWS_PARITY_MATRIX_50.md`（跨端差距）
  - `05_WEB_FULL_PARITY_TODO.md`（待开发项是否关闭）
  - `06_WEB_FILE_BY_FILE_PARITY_FULL.md`（文件级状态变化）
- 任何行为变更需标注是否与 `frontend/`、`backend/` 一致。
- 未完成项必须写明阻塞原因和下一步。



