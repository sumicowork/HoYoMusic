# 00 - 文档总索引（Android AI 开发入口）

## 目标

本索引用于指导 Android Studio AI 在 HoYoMusic 仓库中做正确决策：

- 先理解边界，再写代码。
- 先对齐 API 契约，再做 UI。
- 先做可运行闭环，再做增强功能。

## 推荐阅读顺序

1. `docs/01_PROJECT_CURRENT_STATE.md`
2. `docs/02_API_BASELINE_AND_ENV.md`
3. `docs/03_AUTH_AND_SESSION_SPEC.md`
4. `docs/04_TRACK_AND_PLAYBACK_CONTRACT.md`
5. `docs/05_COVER_AND_STORAGE_SPEC.md`
6. `docs/06_ANDROID_ARCHITECTURE_KOTLIN.md`
7. `docs/07_MIGRATION_PARITY_MATRIX.md`
8. `docs/08_IMPLEMENTATION_ROADMAP.md`
9. `docs/09_RISKS_AND_GUARDRAILS.md`
10. `docs/10_ANDROID_STUDIO_AI_MASTER_PROMPT.md`
11. `docs/11_ANDROID_STUDIO_AI_TASK_PROMPTS.md`
12. `docs/12_DATA_MODEL_FIELD_DICTIONARY.md`
13. `docs/13_TEST_PLAN_AND_ACCEPTANCE.md`
14. `docs/14_DECISION_LOG.md`

## AI 开发基本约束

1. 所有接口响应按 `{ success, data?, error? }` 解析。
2. 默认 API 基地址是 `https://music.hoyodb.com/api`。
3. 管理接口使用 JWT Bearer；公共播放接口无登录也可访问。
4. 仅当调用 `GET /api/tracks/:id/stream` 或 `/download`（管理路由）时，才需要 `token` query 或 Authorization 头（见 `authenticateStream`）。
5. Android 首版优先使用公共读接口 + 公共流媒体接口，减少后台权限复杂度。

## 与现有端的关系

- Web（`frontend/`）是当前线上行为参考实现。
- Backend（`backend/`）是契约真相源。
- Desktop（`client-desktop/`）是原生客户端经验参考，不是 Android 的直接代码来源。

## 建议 Android MVP 范围

- 登录（可选，先匿名播放也可）
- 首页推荐（随机曲目 / 游戏）
- 曲目搜索 + 筛选（最小化参数）
- 播放器（播放、暂停、进度、上一首/下一首）
- 播放上报（`POST /api/public/tracks/:id/play`）

## 非目标（MVP 阶段）

- 复杂后台管理功能（导入、批量操作、元数据回滚）。
- 离线下载、缓存加密、歌词高级编辑。
- 任何破坏后端契约或直接改数据库的行为。

## 开发工作流（建议）

1. 先让 AI 生成项目架构和网络层。
2. 先跑通 `health` 与 `public tracks`。
3. 再接入播放器（Media3/ExoPlayer）与播放上报。
4. 最后补 UI、状态管理、错误处理和测试。

## 交付标准（每个里程碑）

- 可编译运行。
- 可在真机或模拟器请求线上接口。
- 遇到网络错误有可读提示，不崩溃。
- 核心流程可复现（含测试步骤）。
