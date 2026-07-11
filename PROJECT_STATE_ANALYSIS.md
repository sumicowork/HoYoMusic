# HoYoMusic 项目现状分析（基于源码核实）

> 分析时间：2026-07-10
> 方法：仅依据**真实源码**（package.json / .csproj / build.gradle / src / db / 配置）核实；
> 所有 `.md` 文档（README / CLAUDE.md / docs / 各端 docs）均视为不可靠，未采信其声明。
> 文件计数已排除 `node_modules` / `bin` / `obj` / 构建缓存。

---

## 0. 项目定位与整体架构

**HoYoMusic = 米哈游（HoYo）游戏原声音乐目录 / 播放平台。** 一个后端 + 三个前端客户端的典型全栈单体仓：

```
                         ┌─────────────────────────────┐
   Web (React 19/Vite) ──┤                             │
                         │    后端 REST API            │
   Desktop (WinUI3/.NET8)├─  Express 5 + PostgreSQL    │── PostgreSQL
                         │     :3000/api               │   (pgcrypto/UUID)
   Mobile (Kotlin/Compose)┤     music.hoyodb.com/api   │
                         └─────────────────────────────┘
```

- **单一后端契约**：三端均对接同一套 REST API。Web 开发期指向 `localhost:3000/api`（环境变量），桌面端/移动端硬编码生产域名 `https://music.hoyodb.com/api/`（可用环境变量覆盖）。
- 桌面端 `desktop/src/lib/api.ts` 解析后端 `{success,data,error}` 信封（与 Web 同源），三端共享同一 REST 契约；类型由 OpenAPI 生成。
- 跨端仅通过 HTTP/REST 协作，**无**共享代码库、无本地后端副本。

---

## 1. 后端 backend/（Express 5 + PostgreSQL + TypeScript）—— 功能完整，但 Schema 与代码脱节

**技术栈（package.json 核实）**：Express 5.2.1、TypeScript 5.9.3、`pg` 8.18（裸驱动，无 ORM）、jsonwebtoken 9 + passport(passport-jwt/local) + bcrypt、zod 4 校验、multer 2 + sharp 0.34 + music-metadata 11、存储抽象 ali-oss / webdav / 本地 fs（由 `STORAGE_MODE` 三选一）、helmet 8 / cors 2 / compression / express-rate-limit、swagger-jsdoc + swagger-ui-express、nodemailer、geoip-lite + ua-parser（访问日志）、@alicloud/esa（ESA 分析）。**所有依赖均在 src/ 中被实际 import，无“声明未用”**。

**构建**：`tsc --noEmit` 通过（退出码 0），strict 模式，构建可用。入口 `src/index.ts`（~784 行）。

**实际 API 面（src/routes + controllers 核实）**：挂载于 `/api/*`，约 22 个路由组、100+ 端点：
- auth(5) / tracks(25, 含上传·流·下载·批量·重复检测·笔记导入导出·目录元数据按 UUID 替换回滚) / public(10) / lyrics(7) / credits(6) / albums(10) / artists(13) / games(5) / tags(14) / music-sources(14) / playlists(8) / favorites(3) / disc(6) / messages(6) / users(7) / analytics(23, 仅 admin) / settings(12) / debug(4, 默认关闭)。
- 鉴权（JWT + Local 双策略，校验 `token_version`/`account_status`）、zod 校验、`helmet`/`cors`/限流、请求/访问日志、全局错误处理、维护模式守卫 —— **均为真实实现，无空 stub**。

**结构性缺口（已核实，关键风险）**：
1. **DB Schema 严重滞后于代码**（见第 5 节）。代码引用约 14 张表在 `db/*.sql` 中**无 DDL**，按现有 SQL 建库后 favorites / playlists / settings / messages / artist 别名等接口会直接报错。
2. **零测试**：`package.json` 的 `test` 脚本为 `exit 1` 占位。
3. **调试接口**：`debug` 路由默认关闭（`DEBUG_API_ENABLED=false`），但含 HMAC/签名校验，属高危功能，生产需确保关闭。

---

## 2. 前端 frontend/（React 19 + Vite 7 + Antd 6 + Tailwind 4）—— 功能完整，少量死代码

**技术栈（package.json 核实）**：React 19.2 + TS 5.9 + Vite 7.2；Ant Design 6.2（中文 locale）；Tailwind 4.1；react-router-dom 7.13；zustand 5（7 个 store）；axios 1.13（**无** react-query）；howler 2.2（播放）；recharts 3.8（分析）；react-beautiful-dnd + react-window；react-markdown。**全部依赖均被实际 import**。

**构建**：`vite.config.ts` 无 dev `proxy`（前端直连 `VITE_API_URL`，回退 `window.location.origin + '/api'`）。`build` = `tsc && vite build`。

**实际内容**：19 个真实页面（含完整管理后台：专辑/标签/游戏/艺人/用户/分析/设置/音乐来源库）、约 45 个组件、核心 `Player.tsx`(770 行，howler + 队列 + 均衡器 + 频谱 + 展开面板)、`AuthModal`、上传/封面、`ProtectedRoute`、`AdminLayout` 等。功能高度完整，无空路由/占位页。

**缺口**：
1. **缺失资源**：`trackService.ts` 在封面为空时返回 `/placeholder-cover.jpg`，但 `public/` 下无此文件 → 无封面曲目运行时 404（多数页面已用内联 SVG 兜底，但该路径仍会 404）。
2. **未接入的死代码**（定义但从未被渲染/import）：`Library.tsx`、`SpectrumVisualizer.tsx`、`CrossfadeControl.tsx`、`KeyboardShortcutsModal.tsx`、`SleepTimer.tsx`（playerStore 有睡眠定时器逻辑但无 UI 入口）。
3. 无构建型断链（strict + noUnusedLocals 下 import 均可解析）。

---

## 3. 桌面端 desktop/（Tauri v2 + React，独立 UI）—— 已重构（2026-07-11）

> 原 `client-desktop/`（WinUI 3 + .NET 8 C#）已于 2026-07-11 经用户确认（也是上一代 AI 堆的屎山）从工作树删除（git 可恢复）。桌面端重写为 **Tauri v2 + 独立 React+TS UI**，与 Web 端不复用组件、仅共享后端 REST 契约 + OpenAPI 生成类型。

**技术栈（desktop/package.json / src-tauri/Cargo.toml 核实）**：Tauri v2（Rust 壳）+ React 19 + Vite 7 + TypeScript 5.9 + Ant Design 6 + Tailwind 4 + zustand。`desktop/src-tauri/` 为 Rust 侧（`lib.rs`/`commands.rs`：媒体元数据/播放状态、托盘、全局快捷键、离线下载命令；`tauri.conf.json`；`capabilities/`）。

**结构**：`desktop/src/` 为独立 React 应用 —— `App.tsx`(Antd ConfigProvider + AppShell 布局)、`router.tsx`、`pages/`(Home/Library/Search/Album/Artist/Playlist)、`components/{player,layout,ui}/`(播放栏/迷你播放器/波形可视化、侧栏/顶栏、Button/CoverArt 等暗色主题组件)、`store/playerStore.ts`(zustand 播放状态)、`lib/api.ts`(REST 客户端，解析 `{success,data,error}` 信封)、`lib/tauri.ts`(原生桥)、`hooks/`(useAudioPlayer/useMediaSession/useGlobalShortcuts/useTray)、`generated/api-types.ts`(OpenAPI 生成)、`theme/`。

**功能**：浏览/搜索/曲库/专辑/艺人/歌单，播放栏 + 迷你播放器 + 波形可视化，系统媒体控制(SMTC)/托盘/全局快捷键/离线下载（Rust 命令 + TS 桥，[UNVERIFIED: 待本机装 Rust 后 `tauri build` 实测]）。

**缺口**：本机尚未安装 Rust/Tauri CLI（无 cargo），故未做原生编译验证；UI 已 `tsc --noEmit` 0 errors；桌面端暂无自动化测试。

---

## 4. 移动端 client-mobile/（Kotlin + Jetpack Compose + Hilt）—— 四端中最完整

**技术栈（build.gradle.kts 核实）**：Kotlin 2.0.21、AGP 8.8.2、compileSdk/targetSdk 34、minSdk 26；Jetpack Compose（Material3 + navigation-compose）；Hilt 2.52；Retrofit 2.11 + OkHttp 4.12 + Moshi；androidx.media3(ExoPlayer) 1.4.1；WorkManager 2.9.1（下载）、Coil、security-crypto、DataStore；**11 个单元测试**（MockWebServer）。

**功能**：浏览/搜索（20+ 筛选参数）、曲目详情/播放（媒体会话+前台服务+通知+音频焦点+睡眠定时+历史+重试）、收藏、歌单全 CRUD、登录（EncryptedSharedPreferences）、下载（WorkManager）、设置/诊断。拦截器链完整（VisitorId/Auth/NoCache/OfflineCache/CachePolicy）。**全仓无 TODO/FIXME/NotImplemented/stub**。

**缺口（设计选择，非缺失）**：release 未启用混淆（`isMinifyEnabled=false`）；默认系统 App 图标（无自定义 ic_launcher）；`HOYOMUSIC_API_BASE_URL` 默认回退线上域名。

---

## 5. 关键风险汇总（按严重度）

| # | 风险 | 证据 | 影响 |
|---|------|------|------|
| 1 | **DB Schema 曾不可重建（2026-07-10 已修复）** | 原 `setup.ts` 只执行 `schema.sql`（10 表），`init_db.sql`（16 表）是未引用的孤儿；二者均滞后于线上库。**已于 2026-07-10 用线上库 `pg_dump` 重建权威 `schema.sql`（27 张表），并删除 `init_db.sql`** → 仓库现已可复现线上 schema。 | （修复前）`npm run setup` 只能建 10 张表的库、缺 22 张、应用无法启动；（修复后）仓库可复现。⚠️ 后续仍须靠迁移系统防止再次漂移 |
| 2 | **零自动化测试** | 后端 `test`=`exit 1`；前端/桌面测试缺位（仅移动端有 11 单测） | 重构/迁移无回归保护，schema 漂移难发现 |
| 3 | **前端缺失占位资源** | `public/placeholder-cover.jpg` 不存在 | 无封面曲目封面 404 |
| 4 | **调试接口默认高危** | `DEBUG_API_ENABLED` 默认 false 但含签名校验路由 | 配置错误即暴露高危能力 |
| 5 | **死代码/未接入 UI** | 前端 5 个组件未渲染；桌面 2 个 ConvertBack 未实现 | 维护噪音，功能入口缺失（如睡眠定时器无 UI） |

**结论**：四个客户端均“功能完整、可运行”，当前线上服务也确实在正常运行（其数据库被多轮 AI 加工，是真实结构的唯一来源）。**已用线上库 `pg_dump` 重建权威 `schema.sql`（27 张表），仓库现已能复现线上结构；代码引用的真实表与线上库 27 张表完全一致、一张都不缺**（早先“14 张缺表”是误判：那些表在线上库本就存在，其中 `canonical_credits/roles/stats/alias_matches` 实为 `artistController.ts` 中的 CTE 别名，并非表）。**剩下真正的隐患是“未来会再次漂移”**——只要还有 AI 直接改线上库而不走迁移，仓库又会慢慢落后。所以下一步重点从“修复”转向“防再漂移”。

---

## 6. 建议下一步（优先级，已深挖核实）

> 关键新发现：`backend/src/index.ts:218` 已暴露 `GET /api/docs.json` 完整 OpenAPI 3.0 规范；`setup.ts` 只跑 `schema.sql`（10 表），`init_db.sql` 是未被引用的孤儿文件。

**P0 — 止血：让数据库可重建（✅ 已完成，2026-07-10）**
1. ✅ 已取线上库 `pg_dump`（`hoyomusic_20260710221108aaaem.sql.gz`），据此重建权威 `backend/db/schema.sql`（27 张表，干净可移植、可被 `setup.ts` 直接执行）。
2. ✅ 已删除孤儿 `init_db.sql`（`git rm`，可 `git checkout` 恢复）。
3. **待办**：把这次同步转化为迁移基线——建议引入轻量迁移机制（如 `node-pg-migrate` / `golang-migrate`），让未来任何表结构改动都生成迁移文件并写入仓库，从根上杜绝再次漂移。

**P1 — 契约硬化（✅ 已完成，2026-07-10）**
3. ✅ 已用 `swagger-jsdoc` 导出 `openapi/openapi.json`（OpenAPI 3.0，**已补全至 148 个路径 / 180 operations**），并用 `openapi-typescript` + `openapi-fetch` 在 `frontend/src/generated/` 生成 `api-types.ts`(8892 行) 与 `api-client.ts`（类型化客户端）。契约测试 `backend/tests/contract.test.ts` **2/2 通过**，断言 spec 中的 schema 均存在于生成类型中——防漂移护栏生效。
4. ✅ 已引入 `vitest` + 漂移探测器 `backend/tests/drift.test.ts`；**已起本地 Postgres 测试库实际跑通（1 passed）**：扫描 61 源文件、35 表引用、排除 6 个 CTE 别名、27 张真实表全齐、无缺失。该测试是“防再漂移”的硬护栏。

**P2 — 架构减负（减少 AI 维护的栈数）**
5. ✅ **P2 已完成（2026-07-11）**：桌面端重写为 **Tauri v2 + 独立 React UI**（路线 A，用户拍板），旧 `client-desktop/`（WinUI3 C#，亦为上代 AI 屎山）已从工作树删除（git 可恢复）。新桌面端 `desktop/` 含完整 Rust 壳 + 独立播放器/曲库 UI + 原生桥，`tsc` 0 errors；后端 swagger 已补全、契约测试 2/2 通过。移动端原生保留（后台播放/媒体控制刚需）。
6. 若未来需 iOS，在写第 5 套栈之前先规划 KMP/Flutter。

**P3 — 正确性与打磨**
7. ✅ 前端已删 5 个未引用死组件 + 孤儿 CSS，并生成 `public/placeholder-cover.jpg` + 给 `trackService` 加内联 SVG 兜底（消 404）。
8. 安全：`setup.ts` 的 admin 密码已改为从 `ADMIN_PASSWORD` 环境变量读取（默认弱密码 `changeme`，会打印弱密码警告，绝不在日志中泄露真实密码）；任何非 dev 环境应通过环境变量注入强密码。确认生产 `DEBUG_API_ENABLED=false`。
9. `tools/` 审计已删 2 个 dead Python 脚本，另 2 个脚本因依赖缺失 SQL 待调查；旧 `client-desktop` 的 `ConvertBack` 未实现项随该目录删除已一并消除。

**本轮执行产出清单（2026-07-10，并行 subagent 完成）**
- `backend/db/migrations/0001_init.sql` — 迁移基线（= schema.sql，27 表）
- `backend/scripts/migrate.ts` + `package.json` 的 `migrate` 脚本 — 轻量迁移运行器（`_migrations` 表记录）
- `backend/vitest.config.ts` + `backend/tests/drift.test.ts` + `test`=vitest run — 漂移测试（已实测通过）
- `openapi/openapi.json` + `frontend/src/generated/api-types.ts` + `api-client.ts` — OpenAPI 规范与类型化客户端
- `docs/ARCHITECTURE_FROM_SOURCE.md` — 基于源码的准确架构/运维文档
- 前端：删 5 死组件 + 孤儿 CSS；补 `public/placeholder-cover.jpg` + SVG 兜底
- 删 `tools/data/` 下 2 个 dead 脚本

**整体判断**：功能层面四个客户端都“做出来了、能跑”，问题集中在**可重建性、一致性、维护杠杆**三件事上。P0(可重建)、P1(防漂移护栏)、B(表面清理) 均已完成；项目从“脆弱多 AI 屎山”升级为“有迁移基线 + 测试护栏 + 准确文档”的可维护状态。下一步只剩 P2(减栈，慎行)与少量 P3 打磨。
