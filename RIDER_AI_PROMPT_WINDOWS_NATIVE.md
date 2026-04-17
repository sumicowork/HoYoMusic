# Rider AI 启动提示词（可直接复制）

你现在在仓库 `C:\Users\sumi\WebstormProjects\HoYoMusic` 中工作。
目标是开发 **Windows 原生客户端**，不允许使用 Electron/WebView 套壳。

请严格按以下要求执行：

1. 技术路线
- 使用 `.NET 8 + WinUI 3 + MVVM`。
- 在仓库根目录新建 `client-desktop/`，不要改动 `backend/` 与 `frontend/` 现有功能。

2. 与现有系统集成
- 后端地址为：`https://music.hoyodb.com`。
- API 文档入口：`https://music.hoyodb.com/api/docs`。
- API 响应契约统一为：`{ success, data?, error? }`，必须按该格式做解析与错误处理。
- 管理端 API 走 `Authorization: Bearer <token>`。

3. 首批必须交付（PoC）
- 初始化可运行的 WinUI 3 工程与解决方案。
- 实现登录页面与登录流程（含 token 保存与读取）。
- 实现曲目列表页面（读取并展示后端数据）。
- 实现基础播放能力（在线流播放，含错误提示）。
- 提供最小 README（运行方式、项目结构、已知限制）。

4. 工程约束
- 分层结构：`App` / `Core` / `Infrastructure` / `Tests`。
- 不要把客户端代码写到 `frontend/`。
- token 不允许明文存储，优先使用 Windows 凭据存储。
- 所有新增代码优先保证可编译、可运行，再做优化。

5. 开发顺序
- 第一步只做可运行 PoC，不要一开始做复杂主题或动画。
- 每完成一个模块，执行构建/运行验证并记录结果。
- 每次提交前输出：变更文件清单、运行命令、已知问题。

6. 交付方式
- 先生成完整脚手架（含 `.sln`、项目文件、基础页面、服务层、测试项目、README）。
- 再补充下一阶段待办（下载管理、更新机制、日志上报）。

请先输出你的执行计划清单，然后开始创建 `client-desktop/` 工程并落地首版代码。


