# 03 - 认证与会话规范（Android）

## 1. 来源依据

- `backend/src/routes/authRoutes.ts`
- `backend/src/middleware/authenticateStream.ts`
- `frontend/src/services/api.ts`

## 2. 认证接口

## 2.1 登录

- `POST /api/auth/login`
- 请求体字段以后端 schema 为准（建议从 `docs.json` 读取具体字段）。
- 返回 `token` 与 `user`（见前端 `LoginResponse` 类型）。

## 2.2 获取当前用户

- `GET /api/auth/me`
- 需要 `Authorization: Bearer <token>`。

## 2.3 其他接口（后续）

- `POST /api/auth/send-verification-code`
- `POST /api/auth/register`
- `POST /api/auth/change-password`

Android MVP 可先不实现完整注册流程。

## 3. token 策略建议

## 3.1 存储

- Android 使用 `EncryptedSharedPreferences`（或 DataStore + Tink）保存 token。
- 不要明文落盘。

## 3.2 注入

网络层拦截器逻辑：

1. 若有 token，则自动注入 Authorization。
2. 若无 token，则发送匿名请求（公共接口依然可用）。

## 3.3 失效处理

收到 `401` 时：

- 清空本地 token。
- 保留当前页面（可选），弹出登录引导。
- 不要直接闪退或进入死循环重试。

## 4. stream/download 的特殊鉴权

`authenticateStream` 支持两种 token 来源：

1. query：`?token=...`
2. header：`Authorization: Bearer ...`

这主要用于管理路由：

- `GET /api/tracks/:id/stream`
- `GET /api/tracks/:id/download`

注意公共路由无需此 token：

- `GET /api/public/tracks/:id/stream`
- `GET /api/public/tracks/:id/download`（是否开放由后端开关决定）

## 5. visitor id 规范

参考 Web 行为：

- 首次生成 UUID，持久化。
- 所有请求带 `x-visitor-id`。

这有助于后端访问日志归因与播放行为分析。

## 6. 会话状态机建议

建议定义以下状态：

- `Anonymous`
- `Authenticating`
- `Authenticated(user)`
- `Expired`

状态转换核心：

- App 启动时若有 token，先请求 `/auth/me` 验证。
- 验证失败转 `Anonymous`。
- 登录成功转 `Authenticated`。
- 任何鉴权型请求返回 401，转 `Expired -> Anonymous`。

## 7. UI 行为建议

- 匿名用户可直接浏览与播放公共内容。
- 需要管理权限的入口默认隐藏。
- 当请求 admin API 返回 403 时，提示“权限不足”。

## 8. AI 实施要求

1. 认证逻辑必须在单独模块，不与 UI 控件耦合。
2. Token 更新/清除只能由会话模块统一处理。
3. API 报错文案要可本地化，不写死在数据层。
4. 任何登录失败都要保留服务端返回 message（如存在）。
