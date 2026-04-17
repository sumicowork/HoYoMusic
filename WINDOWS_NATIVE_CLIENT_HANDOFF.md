# HoYoMusic Windows 原生客户端交接文档

## 1. 目标
- 仅开发 Windows 客户端，不做 Electron/WebView 套壳。
- 客户端技术栈建议：`.NET 8 + WinUI 3 + MVVM`。
- 复用现有后端 API，不改动 `backend/` 对外契约。

## 2. 当前仓库边界
- 现有后端：`backend/`（Express + PostgreSQL）。
- 现有前端：`frontend/`（React + Vite，继续作为 Web 端）。
- 已移除 Electron 脚手架，后续桌面客户端请新增独立目录：`client-desktop/`。

## 3. 必须遵循的 API 约束
- 响应协议保持：`{ success, data?, error? }`。
- 管理端鉴权：`Authorization: Bearer <token>`。
- 公共播放与下载遵守后端当前路由与 token 校验机制。
- 接口核对入口：`https://music.hoyodb.com/api/docs`。

## 4. 建议目录（新建）
- `client-desktop/HoYoMusic.Desktop.sln`
- `client-desktop/src/HoYoMusic.Desktop.App`（WinUI UI）
- `client-desktop/src/HoYoMusic.Desktop.Core`（应用层、用例、DTO）
- `client-desktop/src/HoYoMusic.Desktop.Infrastructure`（HTTP、存储、播放器、更新）
- `client-desktop/tests/HoYoMusic.Desktop.Tests`
- `client-desktop/README.md`

## 5. 分阶段开发计划

### Phase 1: PoC（1-2 周）
- 可启动 Windows 应用，完成环境配置与基础导航。
- 打通登录 API、用户信息读取。
- 打通曲目列表读取与基础播放（在线流）。

### Phase 2: Beta（2-4 周）
- 实现下载队列（并发控制、失败重试、任务状态）。
- 接入凭据安全存储（Windows Credential Manager）。
- 完善错误提示与日志记录。

### Phase 3: Release（1-2 周）
- 安装包与自动更新（beta/stable 通道）。
- 回归测试：登录、播放、下载、更新、异常恢复。
- 灰度发布与回滚方案。

## 6. 技术建议
- HTTP：`HttpClientFactory + Polly`（超时、重试、熔断）。
- JSON：`System.Text.Json`，统一序列化策略。
- 状态管理：MVVM（CommunityToolkit.Mvvm）。
- 播放：优先 `LibVLCSharp`（流媒体与格式兼容更稳）。
- 日志：`Serilog`（本地文件 + 结构化字段）。

## 7. 验收标准（首版）
- Windows 安装、启动、登录可用。
- 播放主链路稳定，异常有可理解提示。
- 下载成功率达标，并能重试失败任务。
- 自动更新可用，保留回滚路径。

## 8. 不要做的事
- 不要重写或破坏 `backend/` 现有 API 契约。
- 不要把桌面端逻辑混入 `frontend/`。
- 不要默认明文存储 token。

## 9. 迁移说明
- Rider 直接打开仓库根目录开发。
- 新功能全部提交到新分支（示例：`feat/windows-native-client`）。
- 优先保证后端兼容与最小可用闭环，再扩展高级功能。

