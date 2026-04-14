# Windows Desktop Docs Index

## 目标
- 统一 Windows 客户端的现状、架构、路线图与执行进度入口。
- 让后续迭代按同一口径推进：`契约对齐 -> 功能闭环 -> 稳定发布`。

## 推荐阅读顺序
1. `client-desktop/README.md`：当前能力边界与运行方式。
2. `client-desktop/KNOWN_ISSUES.md`：已知限制与风险。
3. `client-desktop/PHASE1_CONTRACT_MATRIX.md`：Web 对齐任务矩阵。
4. `client-desktop/WINDOWS_CLIENT_ROADMAP.md`：中长期阶段计划。
5. `client-desktop/docs/01_EXECUTION_TRACKER.md`：当前执行看板与当期动作。

## 文档职责划分
- `README.md`：对外入口与开发者快速上手。
- `KNOWN_ISSUES.md`：问题清单，聚焦事实与影响范围。
- `PHASE1_CONTRACT_MATRIX.md`：接口与行为一致性检查表。
- `WINDOWS_CLIENT_ROADMAP.md`：阶段目标、验收标准、风险缓解。
- `01_EXECUTION_TRACKER.md`：按周推进的可执行 backlog。

## 更新规则
- 任何新增功能必须同步更新：
  - `PHASE1_CONTRACT_MATRIX.md`（状态变化）
  - `01_EXECUTION_TRACKER.md`（任务拆解与责任）
- 任何行为变更需标注是否与 `frontend/`、`backend/` 一致。
- 未完成项必须写明阻塞原因和下一步。


