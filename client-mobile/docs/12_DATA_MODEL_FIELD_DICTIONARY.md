# 12 - 数据模型字段字典（Android DTO 参考）

## 1. 目的

为 AI 生成 DTO/Domain Model 提供字段清单，减少“字段缺失/类型误判”。

## 2. Track（参考 `frontend/src/types/index.ts`）

| 字段 | 类型 | 说明 | Android 建议 |
|---|---|---|---|
| id | number | 主键 | 必需 |
| uuid | string? | 稳定 UUID | 可选 |
| title | string | 标题（历史字段） | 必需 |
| title_cn | string? | 中文标题 | 可选 |
| title_en | string? | 英文标题 | 可选 |
| album_id | number? | 专辑 ID | 可空 |
| album_uuid | string? | 专辑 UUID | 可选 |
| file_path | string | 文件路径/URL | 保留但不直接依赖 |
| cover_path | string? | 封面路径/URL | 可空 |
| duration | number? | 秒 | 可空 |
| track_number | number? | 曲序 | 可空 |
| sample_rate | number? | 采样率 | 可空 |
| bit_depth | number? | 位深 | 可空 |
| file_size | number? | 文件大小 | 可空 |
| release_date | string? | 发行日期 | 可空 |
| notes | string? | 备注 | 可空 |
| disc_id | number? | 碟片 ID | 可空 |
| disc_number | number? | 碟片号 | 可空 |
| disc_title | string? | 碟片标题 | 可空 |
| created_at | string | 创建时间 | 可选展示 |
| updated_at | string | 更新时间 | 可选展示 |
| album_title | string? | 专辑名 | 可选 |
| album_cover | string? | 专辑封面 | 可选 |
| favorite_count | number? | 收藏数 | 可选 |
| play_count | number? | 播放数（旧） | 可选 |
| effective_play_count | number? | 有效播放数 | 可选 |
| unique_ips | number? | 去重IP（统计） | 可选 |
| artists | Artist[] | 艺术家列表 | 必需（可空数组） |
| lyrics_status | enum? | none/has/instrumental | 可选 |

## 3. Artist

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 主键 |
| name | string | 名称 |

## 4. ApiResponse Envelope

| 字段 | 类型 | 说明 |
|---|---|---|
| success | boolean | 成功标记 |
| data | T? | 载荷 |
| error.code | string? | 错误码 |
| error.message | string? | 错误信息 |

## 5. 登录相关

`frontend/src/types/index.ts`：

- `LoginRequest`：`identifier`, `password`
- `LoginResponse`：`token`, `user`

## 6. 播放上报请求体

来自 `trackService.recordPlay` 与 `publicRoutes.ts`：

- `played_seconds?: number`
- `track_duration_seconds?: number`
- `session_key?: string`

## 7. DTO 设计建议

1. API DTO 与 Domain Model 分离。
2. DTO 尽量可空，Domain 层再规范化。
3. 对 unknown 字段保留扩展空间。

## 8. 默认值建议

- `artists` 默认空数组。
- `duration` 无值时展示 `--:--`。
- `cover_path` 无值时使用本地占位图。

## 9. 解析异常处理

当字段类型不匹配（如 string/number 混用）时：

- 记录日志
- 回退默认值
- 不要让页面崩溃

## 10. 版本演进建议

后续如后端字段升级，优先：

1. 增量加字段，不删旧字段。
2. Android DTO 先兼容新旧两种格式。
3. 版本稳定后再清理技术债。
