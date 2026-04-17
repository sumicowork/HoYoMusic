# 04 - 曲目与播放契约（Android 核心）

## 1. 真相来源

- `backend/src/routes/publicRoutes.ts`
- `backend/src/controllers/trackController.ts`
- `frontend/src/services/trackService.ts`
- `frontend/src/store/playerStore.ts`
- `frontend/src/types/index.ts`

## 2. 曲目核心模型（基于 Web 类型）

Android 端建议先覆盖以下字段（按优先级）：

- `id: number`
- `uuid?: string`
- `title: string`
- `title_cn?: string | null`
- `title_en?: string | null`
- `album_id: number | null`
- `album_title?: string`
- `cover_path: string | null`
- `duration: number | null`
- `track_number: number | null`
- `release_date: string | null`
- `artists: Artist[]`
- `favorite_count?: number`
- `effective_play_count?: number`

注意：所有字段都应“可缺省可空”，避免崩溃。

## 3. 关键接口

### 3.1 曲目列表

- `GET /api/public/tracks`
- 支持分页/筛选/排序参数（详见 `02_API_BASELINE_AND_ENV.md`）。

### 3.2 曲目详情

- `GET /api/public/tracks/:id`

### 3.3 流媒体播放

- `GET /api/public/tracks/:id/stream`

### 3.4 播放上报

- `POST /api/public/tracks/:id/play`
- body：
  - `played_seconds`
  - `track_duration_seconds`
  - `session_key`

### 3.5 热门曲目

- `GET /api/public/top-tracks?limit=20`

## 4. 播放上报语义（非常重要）

后端使用“有效播放”阈值：

- `played >= max(10, min(30, duration * 0.5))`

也即：

- 最低 10 秒。
- 最高按 30 秒封顶。
- 短音频按一半时长算。

Android 客户端建议：

1. 播放开始时生成 `session_key`（每个 track + 每次播放会话唯一）。
2. 周期上报（如每 10~15 秒）或在暂停/切歌/结束时上报。
3. `played_seconds` 使用累计有效播放时长，避免只上报一次 0。
4. 上报失败不阻塞播放（fire-and-forget + 日志）。

## 5. Web 播放模式语义（需要对齐）

`frontend/src/store/playerStore.ts` 定义：

- `sequence`：顺序播放，到尾停止。
- `loop`：列表循环，到尾回到首。
- `shuffle`：随机播放，尽量避免立即重复当前曲。
- `single`：单曲循环（Web store 里 toggle 包含该模式，Android 应支持）。

Android 必须保证下一首/上一首在上述模式下行为一致。

## 6. 队列行为建议

### 6.1 点击歌曲

- 默认“替换当前播放目标并开始播放”。
- 如需求是“加入队列”需有独立入口。

### 6.2 删除当前曲目

- 若队列仍有曲目，自动切到合理下一曲。
- 若队列为空，停止播放并重置进度。

### 6.3 恢复状态

可持久化：

- `playlist`
- `currentTrack`
- `playMode`
- `volume`

但要防御“曲目已下线/字段变化”。

## 7. 播放器实现建议（Android）

使用 `androidx.media3`（ExoPlayer）：

- `MediaItem.fromUri(streamUrl)`
- `Player.Listener` 监听状态变化
- 在 `onIsPlayingChanged` / `onPlaybackStateChanged` / `onMediaItemTransition` 中更新 ViewModel

## 8. stream URL 构造策略

公共播放：

- `${BASE_URL}/public/tracks/{id}/stream`

管理流（后续）：

- `${BASE_URL}/tracks/{id}/stream?token={jwt}`

MVP 优先公共播放，降低鉴权复杂度。

## 9. 错误处理策略

### 常见错误

- `404`：曲目不存在或流资源失效。
- `415`：媒体格式异常（少见）。
- `503`：服务维护。

### 客户端处理

- 当前曲目播放失败 -> 自动尝试下一首（可配置）。
- 若连续失败超过阈值 -> 暂停并提示。

## 10. Android 数据层接口建议

建议拆分为：

- `TrackRemoteDataSource`
- `TrackRepository`
- `PlaybackReporter`
- `PlayerController`

让 AI 先实现数据和播放控制，再接 UI。

## 11. 最小回归清单

1. 列表可加载、下拉可刷新。
2. 任意曲目可正常播放。
3. 暂停/继续/拖动进度正常。
4. 切歌后上报 `session_key` 变化正确。
5. 播放结束后按播放模式进入下一状态。
