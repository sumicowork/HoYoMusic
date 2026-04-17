# HoYoMusic Mobile Client (Android) - AI Handoff Pack

本目录用于给 Android Studio 内的 AI（Gemini / JetBrains AI / 其他）提供完整上下文，目标是：

- 在不破坏现有后端契约的前提下，新建 Android 原生客户端（Kotlin + Jetpack Compose）。
- 尽量减少 AI 对字段、接口、鉴权、播放语义的误判。
- 让 AI 能按文档直接开始分阶段开发。

## 目录结构

- `docs/00_DOC_INDEX.md`：文档总索引与阅读顺序。
- `docs/01_PROJECT_CURRENT_STATE.md`：项目现状与边界。
- `docs/02_API_BASELINE_AND_ENV.md`：API 基线、环境与联调规则。
- `docs/03_AUTH_AND_SESSION_SPEC.md`：认证、会话、401 行为规范。
- `docs/04_TRACK_AND_PLAYBACK_CONTRACT.md`：曲目、播放、上报、队列语义。
- `docs/05_COVER_AND_STORAGE_SPEC.md`：封面/存储模式/代理规则。
- `docs/06_ANDROID_ARCHITECTURE_KOTLIN.md`：Android 技术架构建议。
- `docs/07_MIGRATION_PARITY_MATRIX.md`：Web -> Android 行为对齐矩阵。
- `docs/08_IMPLEMENTATION_ROADMAP.md`：分阶段开发计划与 DoD。
- `docs/09_RISKS_AND_GUARDRAILS.md`：风险、禁区与自检清单。
- `docs/10_ANDROID_STUDIO_AI_MASTER_PROMPT.md`：可直接喂给 AI 的主提示词。
- `docs/11_ANDROID_STUDIO_AI_TASK_PROMPTS.md`：按模块拆分的执行提示词。
- `docs/12_DATA_MODEL_FIELD_DICTIONARY.md`：字段字典与 DTO 参考。
- `docs/13_TEST_PLAN_AND_ACCEPTANCE.md`：测试计划与验收标准。
- `docs/14_DECISION_LOG.md`：技术决策记录（ADR）。

## 已知事实来源（仓库内）

本目录内容优先依据以下文件：

- `AGENTS.md`
- `backend/src/index.ts`
- `backend/src/routes/publicRoutes.ts`
- `backend/src/routes/trackRoutes.ts`
- `backend/src/middleware/authenticateStream.ts`
- `backend/src/services/storageService.ts`
- `frontend/src/services/api.ts`
- `frontend/src/services/trackService.ts`
- `frontend/src/store/playerStore.ts`
- `frontend/src/types/index.ts`
- `client-desktop/README.md`
- `client-desktop/PHASE1_CONTRACT_MATRIX.md`

## 建议使用方式

1. 先把 `docs/00_DOC_INDEX.md` 和 `docs/10_ANDROID_STUDIO_AI_MASTER_PROMPT.md` 发给 Android Studio AI。
2. 然后按 `docs/11_ANDROID_STUDIO_AI_TASK_PROMPTS.md` 逐任务推进。
3. 每完成一个任务，让 AI 按 `docs/09_RISKS_AND_GUARDRAILS.md` 自检后再提交。

## 注意

- 当前线上接口文档 JSON 可从 `https://music.hoyodb.com/api/docs.json` 获取。
- 如果 Swagger UI 页面静态资源受反向代理影响不可用，以 `docs.json` 和仓库源码为准。
- 不要让 AI 修改 `backend/` 现有契约，除非你明确决定升级后端并同步 Web/Desktop/Mobile。
