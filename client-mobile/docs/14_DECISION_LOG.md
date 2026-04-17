# 14 - 技术决策记录（Android）

## ADR-001: Android 采用 Kotlin + Jetpack Compose

- 日期：2026-04-09
- 状态：Accepted

### 背景

项目已有 Web 与 Windows 原生客户端方向。现在新增 Android 客户端，需要高质量播放体验并适配后续扩展。

### 决策

选择 Kotlin + Jetpack Compose 原生方案。

### 原因

1. Android 平台能力接入最直接。
2. 播放器、后台播放、系统交互生态更成熟。
3. 与 AI 协作时调试链路更稳定。

### 影响

- 需单独维护 Android 代码库。
- 但可获得更可控的体验与性能。

---

## ADR-002: MVP 优先公共接口闭环

- 日期：2026-04-09
- 状态：Accepted

### 决策

MVP 优先使用：

- `GET /api/public/tracks`
- `GET /api/public/tracks/:id`
- `GET /api/public/tracks/:id/stream`
- `POST /api/public/tracks/:id/play`

### 原因

- 降低鉴权与权限复杂度。
- 更快形成可演示版本。

### 影响

- 管理后台能力后置。

---

## ADR-003: 保持后端契约不改动

- 日期：2026-04-09
- 状态：Accepted

### 决策

Android 客户端适配现有后端契约，不主动推动后端 API 重构。

### 原因

- 当前已有 Web/Desktop 依赖。
- 契约变更成本高、联动风险大。

### 影响

- Android 需要更强 DTO 容错。

---

## ADR-004: 封面加载优先走后端 proxy

- 日期：2026-04-09
- 状态：Accepted

### 决策

对于远程 cover_path，优先走：

- `/api/public/covers/proxy`

### 原因

- 避免客户端直连 OSS/WebDAV。
- 使用服务端安全校验与缩略图能力。

---

## ADR-005: 迭代策略为“小步可运行”

- 日期：2026-04-09
- 状态：Accepted

### 决策

每个 AI 任务必须：

1. 变更范围可控。
2. 可编译运行。
3. 有验证步骤与回滚点。

### 原因

避免 AI 一次性大改导致难以排障。

---

## ADR-006: Phase 0 使用 Raw+Envelope 双解析策略

- 日期：2026-04-09
- 状态：Accepted

### 决策

Android 网络层采用双通道解析：

- 常规接口走 `{ success, data?, error? }` envelope 解析。
- `GET /api/health` 走 raw 解析并映射为统一 `HealthStatus`。

### 原因

`/api/health` 当前由后端返回 `success + message + database...`，未放入 `data` 字段。为遵守“契约优先、后端不改”的原则，客户端兼容该现状。

### 影响

- 后续新增接口默认继续走 envelope。
- 特例接口必须在仓储层显式标注并加容错处理。

---

## ADR-007: Phase 1/2 基础能力采用“共享播放器 + 多页面导航”

- 日期：2026-04-09
- 状态：Accepted

### 决策

Android 客户端在当前迭代采用：

- `PlayerViewModel` 作为跨页面共享播放器状态源。
- Navigation Compose 统一管理 Home / 列表 / 详情 / 播放器 / 登录 / 设置。
- 播放上报通过 `PlaybackReporter` 在暂停、结束和周期进度中触发。

### 原因

- 对齐 Web 端 `playerStore` 的全局队列和播放模式语义。
- 避免页面切换导致播放器实例重建和状态丢失。
- 在不改后端契约前提下，最快形成“浏览-播放-上报”闭环。

### 影响

- 代码结构更接近可上线多页面应用，而非单页 Demo。
- 后续可在现有架构上继续补后台播放通知、音频焦点和登录完善。

---

## ADR-008: Batch-2 采用“后台播放服务 + 高级搜索一次对齐”

- 日期：2026-04-09
- 状态：Accepted

### 决策

本轮 Android 客户端采用：

- 前台播放服务 + MediaSession + 通知控制链路。
- 公共列表搜索参数按 Web 命名一次性对齐（`game_ids/tag_ids/tag_logic/year/duration/...`）。
- 公共 GET 增加缓存/离线读取/重试策略，认证态 GET 添加 `no-cache`。

### 原因

- 需要先解决播放在前后台切换中的稳定性与系统控制一致性。
- 避免多端搜索参数语义分叉导致“同接口不同行为”。
- 提升弱网与维护态可用性，避免用户频繁操作导致失败放大。

### 影响

- Android 端结构从“可演示”进入“可持续扩展”状态。
- 后续可在当前基础上继续做下载队列、后台通知强化与更高覆盖率测试。
