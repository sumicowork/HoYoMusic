# 06 - Android 架构建议（Kotlin + Compose）

## 1. 目标

建立一个可维护、可扩展、便于 AI 协作开发的 Android 原生架构。

## 2. 技术栈建议

- 语言：Kotlin
- UI：Jetpack Compose
- 架构：MVVM + Repository + UseCase（可选）
- 网络：Retrofit + OkHttp + Kotlinx Serialization 或 Moshi
- 并发：Coroutines + Flow
- DI：Hilt（或 Koin）
- 播放器：Media3 ExoPlayer
- 图片：Coil
- 本地存储：Room（后续）+ DataStore/EncryptedSharedPreferences
- 日志：Timber（debug）

## 3. 模块建议（首版可单模块，后续拆分）

推荐包结构：

- `app/`
  - `core/network`
  - `core/model`
  - `core/common`
  - `feature/auth`
  - `feature/discovery`
  - `feature/track`
  - `feature/player`
  - `feature/settings`

## 4. 分层建议

### 4.1 Data Layer

- DTO 与 API Service 定义。
- Response Envelope 统一解析。
- Repository 实现与错误映射。

### 4.2 Domain Layer

- UseCase（可选）：
  - `GetPublicTracksUseCase`
  - `PlayTrackUseCase`
  - `ReportTrackPlayUseCase`

### 4.3 Presentation Layer

- Compose Screen + ViewModel。
- UI State 使用不可变数据类。
- 事件单向流动（MVI/MVVM 均可，但需统一）。

## 5. 网络层关键约束

1. 所有请求默认加 `x-visitor-id`。
2. 有 token 时自动注入 Authorization。
3. 统一处理 `{ success, data?, error? }`。
4. 对 401 做会话失效处理。
5. 对 429/503 做友好提示和退避重试。

## 6. 播放器架构建议

推荐双层：

- `PlayerEngine`：封装 ExoPlayer 生命周期和控制。
- `PlayerViewModel`：管理队列、播放模式、进度状态、上报策略。

状态字段建议：

- `currentTrack`
- `playlist`
- `playMode`
- `isPlaying`
- `progressMs`
- `durationMs`
- `bufferedPositionMs`

## 7. 播放上报实现建议

- `PlaybackSessionManager` 管理 `session_key`。
- 上报节奏：
  - 切歌/暂停/播放结束时上报。
  - 每隔 N 秒节流上报一次（可选）。

## 8. UI 页面建议（MVP）

1. Splash / Init（健康检查、配置加载）
2. Home（随机曲目、热门曲目）
3. TrackList（搜索、分页）
4. Player（迷你 + 全屏）
5. Login（可选）
6. Settings（切换 API Base URL，仅 debug）

## 9. 状态管理建议

- 页面状态统一：`Loading` / `Content` / `Empty` / `Error`。
- 错误提示统一通过 `UiMessage` 中央队列分发。

## 10. 测试建议

- 单元测试：Repository、解析器、播放模式逻辑。
- 集成测试：Fake API + ViewModel。
- UI 测试：关键路径（列表 -> 播放 -> 切歌）。

## 11. AI 协作规范

1. 每个 PR 只做一个功能切片。
2. 先写接口和数据模型，再写 UI。
3. 关键行为必须附“可复现测试步骤”。
4. 对外契约改动要明确列出影响范围。

## 12. 建议的首批任务顺序

1. 基础工程与 DI。
2. 网络层与 envelope 解析。
3. 公共曲目列表与详情。
4. ExoPlayer 接入。
5. 播放上报。
6. 登录与会话管理。
7. 错误与空态统一。
