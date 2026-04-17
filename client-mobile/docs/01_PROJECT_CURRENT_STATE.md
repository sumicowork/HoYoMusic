# 01 - 项目现状与边界说明

## 1. 仓库现实结构

当前仓库是单仓多端：

- `backend/`：Express + PostgreSQL API。
- `frontend/`：React + Vite Web SPA。
- `client-desktop/`：Windows 原生 PoC（.NET 8 + WinUI 3）。

Android 客户端应新增在 `client-mobile/` 下，保持与现有端解耦。

## 2. 关键入口文件

- 后端入口：`backend/src/index.ts`
  - 接入安全中间件、限流、CORS、压缩、维护模式。
  - 挂载 API 路由（`/api/auth`、`/api/tracks`、`/api/public` 等）。
  - 提供 `GET /api/docs.json` 和 `GET /api/health`。
  - 启动时执行大量迁移 SQL（向后兼容风格）。

- 前端入口：`frontend/src/App.tsx`（按 `AGENTS.md` 描述）
- 前端 API 客户端：`frontend/src/services/api.ts`

## 3. 必须保留的后端契约

### 3.1 统一响应包

所有接口按以下结构解析：

- 成功：`{ success: true, data: ... }`
- 失败：`{ success: false, error: { code, message } }`

Android 端不要假设所有失败都带完整 `error`，需要兜底提示。

### 3.2 鉴权分流

- 管理接口：`authenticateJWT`（Bearer Token）。
- 流媒体专用：`authenticateStream`（支持 query token 和 Authorization）。
- 公共接口：`/api/public/*` 通常无需登录。

### 3.3 维护模式

`backend/src/index.ts` 在 `/api` 下有维护模式守卫。Android 客户端需要准备对 503/维护提示的 UI。

## 4. 存储模式差异（影响客户端 URL 策略）

`backend/src/services/storageService.ts` 支持：

- `local`
- `oss`
- `webdav`

这会影响 `cover_path` 与 `file_path` 是本地路径还是远程 URL。Android 不要硬编码拼接规则，应复用服务层统一函数（参考 Web `trackService.getCoverUrl` 逻辑）。

## 5. 当前线上已知地址

- 基础域名：`https://music.hoyodb.com`
- API 前缀：`/api`
- Swagger JSON：`https://music.hoyodb.com/api/docs.json`

注：如 Swagger UI 页面不可访问，以 `docs.json + 源码` 作为真相源。

## 6. Android 端建议边界（首版）

### 推荐先做

- 公共曲目列表/详情
- 流媒体播放
- 播放上报
- 基础账号登录（可选）

### 延后再做

- 后台复杂管理能力
- 上传 FLAC、批量导入、元数据回滚
- 桌面特有流程迁移

## 7. 与桌面端关系

`client-desktop/` 可复用的是“接口契约理解”和“跨端行为矩阵思路”，而不是代码直接复制。

- 可借鉴：
  - API envelope 解析
  - 播放模式语义
  - 分阶段交付方法
- 不可直接搬：
  - WinUI 视图层
  - Windows 存储/凭据实现

## 8. Android AI 需要遵守的工作原则

1. 字段来自接口，不靠猜测。
2. 先实现 Domain/Data 层，再实现 UI。
3. 任何新增接口必须先核对 `docs.json` 或后端源码。
4. 提交前要给出“本次变更影响的接口列表”和“回归清单”。
