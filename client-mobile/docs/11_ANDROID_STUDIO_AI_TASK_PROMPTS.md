# 11 - Android Studio AI 子任务提示词（按模块投喂）

## 用法

当主提示词过大或 AI 执行偏移时，使用下面的子任务提示词逐个执行。

---

## Prompt A - 建工程与网络层

```text
请在 client-mobile 下创建 Android Kotlin + Compose 工程，最小可运行。
要求：
1) 配置 Retrofit + OkHttp + Coroutines + Hilt。
2) 建立统一 ApiEnvelope 解析：{ success, data?, error? }。
3) 实现 Health API（GET /api/health）和 PublicTracks API（GET /api/public/tracks）。
4) 首屏显示健康状态和曲目列表。
5) 出错时显示 error message，不崩溃。

请输出：
- 变更文件列表
- 核心代码
- 如何运行
- 验证步骤
```

---

## Prompt B - 认证与会话

```text
在现有 Android 项目中实现认证会话模块。
要求：
1) 实现 POST /api/auth/login 和 GET /api/auth/me。
2) token 存储使用 EncryptedSharedPreferences（或等效加密存储）。
3) OkHttp 拦截器自动注入 Authorization。
4) 处理 401：清空会话并发出 UI 事件。
5) 所有请求自动注入 x-visitor-id。

请附：
- Session 状态机图（文字版）
- 回归步骤
```

---

## Prompt C - 播放器核心

```text
请实现 Android 播放器核心，使用 Media3 ExoPlayer。
要求：
1) 支持加载 /api/public/tracks/:id/stream。
2) 实现播放/暂停/拖动进度/上一首下一首。
3) 实现四种播放模式：sequence/loop/shuffle/single（语义对齐 web playerStore）。
4) 建立 PlayerController + PlayerViewModel 分层。
5) 不允许页面重组导致重复创建播放器。

请附：
- 状态字段定义
- 关键监听器处理逻辑
- 单元测试建议
```

---

## Prompt D - 播放上报

```text
请实现播放上报模块（POST /api/public/tracks/:id/play）。
要求：
1) 上报字段：played_seconds, track_duration_seconds, session_key。
2) 每次播放会话生成独立 session_key。
3) 在暂停/切歌/结束时上报，失败不阻断播放。
4) 增加节流策略，避免过于频繁请求。
5) 输出可测试的调试日志。

请附：
- 上报时序说明
- 异常处理策略
```

---

## Prompt E - 封面与列表体验

```text
请实现封面加载与列表优化。
要求：
1) 实现 CoverUrlResolver，兼容 http(s)、/uploads、/games 路径。
2) 列表优先请求 thumb 封面（/api/public/covers/proxy?size=thumb）。
3) 使用 Coil 缓存并提供占位图。
4) 网络失败时不阻塞列表。
5) 添加分页加载与下拉刷新。

请附：
- URL 解析规则
- 弱网场景验证方法
```

---

## Prompt F - 质量与回归

```text
请为当前 Android 项目补齐质量保障。
要求：
1) 统一错误映射（网络错误、401、403、404、429、503）。
2) 建立 UI 状态模板：Loading/Content/Empty/Error。
3) 补充关键单元测试（Repository、播放模式、上报逻辑）。
4) 输出一份手工回归清单（10条以上）。
5) 输出已知风险和后续改进计划。
```

---

## 推荐执行顺序

A -> C -> D -> E -> B -> F

说明：先公共闭环播放，再接登录，能更快形成可演示版本。
