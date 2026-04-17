只允许在mobile下开发。其他的与你无关。继续进行全量Android客户端开发。先明确本次开发的内容，然后执行。每次执行完后验证是否满足开发目标。灵活运用多个subagent互相讨论，开发内容要吻合原前后端的web实现。单次开发量要大，不要局限于一个功能或一个实现。至少实现再50个重大功能，没有完成不许结束总结。没有完成不许结束总结。没有完成不许结束总结。# 10 - Android Studio AI 主提示词（可直接复制）

> 用法：将以下提示词整体发给 Android Studio AI，然后按它输出的分步计划逐项执行。

```text
你是我的 Android 开发搭档。请在当前仓库内新增并完善 HoYoMusic Android 原生客户端（Kotlin + Jetpack Compose），并严格遵守以下约束。

【项目上下文】
- 仓库根目录是 HoYoMusic。
- 现有后端在 backend/（Express + PostgreSQL），现有 Web 在 frontend/（React + Vite）。
- 你开发的是 Android 客户端，目录在 client-mobile/。
- 线上 API 地址默认：https://music.hoyodb.com/api

【必须阅读文件（真相源优先级）】
1) client-mobile/docs/00_DOC_INDEX.md
2) client-mobile/docs/01_PROJECT_CURRENT_STATE.md
3) client-mobile/docs/02_API_BASELINE_AND_ENV.md
4) client-mobile/docs/03_AUTH_AND_SESSION_SPEC.md
5) client-mobile/docs/04_TRACK_AND_PLAYBACK_CONTRACT.md
6) client-mobile/docs/05_COVER_AND_STORAGE_SPEC.md
7) client-mobile/docs/06_ANDROID_ARCHITECTURE_KOTLIN.md
8) client-mobile/docs/07_MIGRATION_PARITY_MATRIX.md
9) client-mobile/docs/08_IMPLEMENTATION_ROADMAP.md
10) client-mobile/docs/09_RISKS_AND_GUARDRAILS.md

同时参考这些源码：
- backend/src/index.ts
- backend/src/routes/publicRoutes.ts
- backend/src/routes/trackRoutes.ts
- backend/src/middleware/authenticateStream.ts
- frontend/src/services/api.ts
- frontend/src/services/trackService.ts
- frontend/src/store/playerStore.ts
- frontend/src/types/index.ts

【硬性契约】
- 所有接口响应按 { success, data?, error? } 解析。
- 不要修改 backend 的接口契约。
- 公共播放优先使用 /api/public/tracks/:id/stream。
- 播放上报用 POST /api/public/tracks/:id/play。
- 支持 x-visitor-id 请求头。

【首要目标（MVP）】
1. 公共曲目列表与详情。
2. 播放器（播放/暂停/进度/上一首下一首）。
3. 播放模式：sequence/loop/shuffle/single。
4. 播放上报（包含 played_seconds、track_duration_seconds、session_key）。
5. 失败兜底（网络错误、404、503、401）。

【技术栈要求】
- Kotlin + Jetpack Compose
- Retrofit + OkHttp + Coroutines + Flow
- Hilt（或 Koin，但优先 Hilt）
- Media3 ExoPlayer
- Coil

【输出格式要求】
每次回答必须按以下结构：
1) 任务理解
2) 计划清单（checklist）
3) 将改动的文件列表
4) 代码实现
5) 验证步骤
6) 风险与回滚点

【实施策略】
- 先搭基础工程与网络层，再做播放，再做 UI 细节。
- 小步提交，每步都可编译。
- 对不确定接口字段，先去读 docs.json 或后端源码，不要猜。

【现在开始执行】
请先完成 Phase 0：
- 建立 Android 工程骨架（app module）
- 建立网络层（ApiClient、Envelope 解析、错误映射）
- 打通 GET /api/health 和 GET /api/public/tracks
- 给出可运行的首屏（显示健康状态 + 曲目列表）

完成后请输出：
- 你新增/修改的文件
- 如何运行
- 已验证结果
- 下一步计划（Phase 1）
```

## 补充说明

如果 Android Studio AI 容易一次改太多，可把任务拆到 `11_ANDROID_STUDIO_AI_TASK_PROMPTS.md` 的子提示词逐个执行。
