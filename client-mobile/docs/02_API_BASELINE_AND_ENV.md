# 02 - API 基线、环境与联调规则

## 1. 环境与基地址

### 1.1 默认线上

- API Base URL：`https://music.hoyodb.com/api`

### 1.2 客户端配置建议

Android 端提供以下配置层级：

1. BuildConfig 默认值（release 指向线上）。
2. `local.properties` 或 debug-only 覆盖（便于本地联调）。
3. 开发者设置页可临时修改（仅 debug）。

## 2. 统一响应结构

统一封装解析器：

```json
{
  "success": true,
  "data": {}
}
```

```json
{
  "success": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Readable message"
  }
}
```

解析规则建议：

- `success=true` 且 `data` 为空时，按成功无载荷处理。
- `success=false` 时优先展示 `error.message`。
- 若服务端异常导致格式不完整，展示通用错误并记录原始 body。

## 3. 首批推荐接入接口（Android MVP）

## 3.1 健康检查

- `GET /health`

用途：启动阶段快速判断服务可达。

## 3.2 公共曲目浏览

- `GET /public/tracks`
- `GET /public/tracks/:id`
- `GET /public/tracks/:id/music-sources`
- `GET /public/tracks/random?count=10`
- `GET /public/top-tracks?limit=20`

## 3.3 公共播放

- `GET /public/tracks/:id/stream`
- `POST /public/tracks/:id/play`

## 3.4 可选认证（登录后功能）

- `POST /auth/login`
- `GET /auth/me`

## 4. 查询参数建议（来自 Web 现状）

`frontend/src/services/trackService.ts` 显示公共搜索参数常用如下：

- `search`
- `game_ids`（逗号拼接）
- `artist`
- `year_from` / `year_to`
- `duration_min` / `duration_max`
- `tag_ids`（逗号拼接）
- `tag_logic`（`AND` / `OR`）
- `sort_by` / `sort_dir`
- `page` / `limit`

Android 首版可先实现子集（`search,page,limit,sort`），后续逐步补齐。

## 5. 鉴权头与 visitor id

Web 当前会在请求头加 `x-visitor-id`（见 `frontend/src/services/api.ts`）。

Android 建议同步：

- 首次安装生成 UUID 并持久化。
- 所有请求自动带 `x-visitor-id`。
- 登录后自动带 `Authorization: Bearer <token>`。

这样可以保持与现有访问日志链路一致（`visitLogger` 相关统计）。

## 6. 缓存与 no-cache 语义

Web 对“认证态 GET”会额外加 `Cache-Control: no-cache`。

Android 建议：

- 公共接口可使用短期缓存（OkHttp cache）。
- 管理接口/用户敏感接口建议 no-cache 或更严格策略。

## 7. 错误码与 HTTP 状态处理建议

常见需要显式处理：

- `401`：token 过期或无效，触发重新登录。
- `403`：权限不足（如非 admin）。
- `404`：资源不存在（曲目/封面）。
- `408`：请求超时。
- `429`：限流触发。
- `503`：维护模式或下载关闭。

## 8. 与 Nginx/反代相关注意事项

已知线上场景中，`/api/docs.json` 可访问而 `/api/docs/` 静态资源可能 404。对 Android 开发影响较小，但说明：

- 不要依赖 Swagger UI 页面可用性。
- 以 `docs.json`、后端路由源码为准。

## 9. API 回归最小清单（每次发版前）

1. `GET /api/health` 正常。
2. `GET /api/public/tracks` 可分页返回。
3. `GET /api/public/tracks/{id}/stream` 可播放。
4. `POST /api/public/tracks/{id}/play` 返回 success。
5. 登录后 `GET /api/auth/me` 正常。
6. token 失效时客户端不会崩溃，能引导重新登录。
