# HoYoMusic 项目长期记忆

## 项目本质与关键约束
- **这是一座"屎山"，由多手 AI 接力维护**。每个 AI 会话独立醒来、只读局部上下文就动手改。
- **当前生产服务正常运行**；其数据库被多轮 AI 加工过，是**唯一可信的真值（source of truth）**。
- **2026-07-10 已用线上库 `pg_dump` 重建权威 `db/schema.sql`（27 张表），并删除孤儿 `init_db.sql`** → 仓库可复现线上 schema。
- 漂移根因已补：新增 `backend/db/migrations/`（0001_init.sql）+ `backend/scripts/migrate.ts`（pg 驱动，`_migrations` 表追踪，按序事务执行）。**未来任何表结构改动必须走迁移文件**，否则会再次漂移。
- ⚠️ 线上库 27 张表与代码引用的真实表**完全一致，一张都不缺**（早先报告"缺 14 张"是误判；其中 canonical_credits/canonical_roles 等是 artistController.ts 里的 CTE 临时别名，非表）。

## 已与用户达成的共识
- 用户认可"4 客户端功能都做出来了能跑"，痛点集中在**可重建性 / 一致性 / 多 AI 维护杠杆**。
- 桌面端目标：要一个**真正桌面原生感、与网页端体验不同的应用**（对标 QQ音乐/Spotify），**不是网页套壳**。
- 路线 A = **Tauri v2 (Rust 壳) + 独立 React 19 UI**（2026-07-11 拍板并完成）。理由：①未来完全由 AI 开发，路线 A 只在 TS/React 一个生态作战；②前端组件库比 Fluent 更丰富好看；③跨平台一套出 Win/Mac/Linux；④干净起步丢掉 C# 屎山。路线 B（原生 C#/WinUI3）已排除。
- 旧 `client-desktop/`（C#/WinUI3 上代 AI 屎山）已从工作树删除（git 可恢复）。
- 用户要求"永远信赖源码、文档不可靠"。

## 当前验证状态（2026-07-11）
四端全部绿：backend tsc✓ vitest 34✓ · frontend tsc✓ vitest 19✓ · desktop tsc✓ vitest 37✓ · Rust cargo check✓ · **`tauri build` 产出 `hoyomusic-desktop.exe`**（release 包成功）。
- 桌面真集成：全局快捷键 + 托盘 + 真实流式下载（reqwest）已实现；SMTC 系统媒体键仍为 stub（需 windows crate，GUI 外无法验证，暂缓）。
- 后端 swagger 注解补全（路径 148），契约测试在 `backend/tests/`。
- 全部改动**尚未提交**（git 可恢复）。

## 行动优先级（未来）
- P2：桌面端补测试（已完成 37 个）、SMTC 真实集成、icon.icns 真实图标（macOS）。
- P3：补占位图/安全收尾/清死代码。
- 任何破坏性 DB 操作（DROP/TRUNCATE/force-reset）必须先问用户确认并备份。
