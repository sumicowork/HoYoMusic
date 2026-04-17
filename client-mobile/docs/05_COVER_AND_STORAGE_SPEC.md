# 05 - 封面与存储模式规范

## 1. 真相来源

- `backend/src/services/storageService.ts`
- `backend/src/routes/publicRoutes.ts`
- `frontend/src/services/trackService.ts#getCoverUrl`

## 2. 存储模式

后端支持三种存储模式：

- `local`
- `oss`
- `webdav`

这会导致 `cover_path` 可能是：

1. `/uploads/...` 本地相对路径。
2. `http(s)://...` 远程直链。
3. `/games/...` 前端静态资源路径（特殊场景）。

Android 不应假设只有一种格式。

## 3. 后端封面代理接口

- `GET /api/public/covers/proxy?path=<cover_path_or_url>&size=thumb`

语义：

- `size=thumb`：缩略图（640x640，服务端生成/缓存）。
- 不传 size：原图。

## 4. 为什么建议 Android 也走代理

1. 避免客户端直连 OSS/WebDAV 带来签名与跨域复杂度。
2. 后端已做 SSRF 防护与 host 校验。
3. 缩略图由服务端统一生成，节省流量。

## 5. Android 端封面 URL 统一策略

建议实现 `CoverUrlResolver`：

输入：`coverPath: String?`、`thumb: Boolean`
输出：可直接加载的 URL

规则建议（对齐 Web）：

1. `coverPath == null` -> 返回本地占位图。
2. `coverPath` 以 `http://` 或 `https://` 开头 -> 使用 `/api/public/covers/proxy`。
3. `coverPath` 以 `/` 开头且不是 `/uploads/` -> 直接拼接站点域名（静态资源）。
4. `coverPath` 是 `uploads` 相对路径 -> 正规化后拼站点域名；若 `thumb=true`，优先走 proxy。

## 6. 图片加载库建议

使用 `Coil`（Compose 友好）：

- 支持内存/磁盘缓存。
- 支持占位图、错误图、渐进显示。

推荐策略：

- 列表页请求 `thumb=true`。
- 详情页可请求原图。

## 7. 服务端安全约束（客户端需配合）

`publicRoutes.ts` 对远程 URL 有以下限制：

- 仅允许 `http/https`。
- 屏蔽内网/本地地址（SSRF 防护）。
- 响应体最大字节数受限。
- content-type 必须是图片。

客户端不要尝试绕过这些规则。

## 8. 缓存建议

服务端对封面已设置 `Cache-Control`，客户端仍可做二级缓存：

- 图片缓存：依赖 Coil 默认策略。
- 列表数据缓存：短时缓存（数十秒到几分钟）。

## 9. 故障兜底

- 封面请求失败时显示占位图，不影响播放。
- 不要因图片加载失败阻断列表渲染。
- 对 404 封面可本地记忆短时失败，避免频繁重试。

## 10. 回归清单

1. 三种路径样式（http(s)、/uploads、/games）都能显示。
2. 列表缩略图加载速度可接受。
3. 弱网下不会阻塞主线程。
4. 封面失败不会导致 app 崩溃。
