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

## 平台真正目的（决定 IA 的尺子，2026-07-11 用户点明）
- 用户原话：平台"不仅局限于普通的音乐播放功能"。**本质不是"音乐播放器"，而是 HoYoVerse 游戏音乐的「资料/百科全书 + 无损试听」站**，对标物应是 VGMdb / Discogs / 游戏 OST wiki，不是 QQ音乐/Spotify。
- 数据库里"超出播放器"的两大独特价值（已用真实库 `hoyomusic_import` 验证）：
  1. **场景定位系统**：`music_source_categories`(12类:场景音乐/活动/魔神任务/传说任务/世界任务/战斗音乐…) + `music_source_nodes`(2550个层级节点, 如 枫丹→枫丹廷区→海薇玛映影欢乐城) + `track_music_sources`(3988)。即"这首歌在游戏哪个剧情/场景/任务播"。
  2. **创作者归属库**：`track_credits`(26125行, 400+种角色: 作曲/编曲/每一种乐器/人声/合唱/念白/甚至黑嗓猫声) + `artist_aliases`/`artist_role_aliases`。即"谁做的"。
- ⚠️ 当前前端页面是按"播放器"套路搭的，**没把"场景定位"和"创作者"当一等公民**（游戏页甩专辑网格不用场景树、歌曲页不把"在哪播"做成可点跳转、创作者靠字符串推导不可点）。这是页面分级/跳转"怪"的根因。
- 用户要求：**先定目的，再以目的为尺子评估每个页面该不该存在、该干什么**——不要以"页面好不好看"或"像不像传统音乐平台"为标准。
- **目的细节已确认（2026-07-11 用户答四问）**：① 场景定位=**一等导航维度**（按游戏场景/任务树浏览音乐）；② 创作者=**目的本身**，需独立可逛页（按角色筛选列表+详情）；③ 核心用户=**HOYO-MiX 粉丝**，来不只是听歌、更要了解每首曲子的丰富信息（在哪播/谁做的/类型风格语言）；④ 四柱：游戏=**主入口**(场景树天然按游戏分，是独特浏览的根；用户自认不太确定，我判断正确)、创作者=**一等公民**(新增独立入口)、标签=**描述性分面**(类型/风格/是否人声/语言, 可点筛选, 非死chip)、曲库=用户质疑是否必要→**建议降级/合并进搜索**(无查询态=全部曲目+分面)。**核心逻辑：曲子(Track)是所有入口的终点；歌曲详情页是信息最丰富页(听+在哪播[场景面包屑可点]+完整credits+标签+所属专辑)。**
- **两个依赖**：① 创作者实体 **已解决（2026-07-11 阶段三-②）**：`artists` 表经迁移 0002 建成（1105 位创作者，`track_credits.artist_id` 外键），`getArtists`/`getArtistById`/`getCredits` 都已改用实体，前端按数字 id 跳转闭环。② 标签用户想要的"类型/风格/语言"目前库里没有(`tags` 表仅 BPM 97+人声类型 3)→维度很薄，**阶段三-③ 仍未做**，需后续补打标签数据或先用现有。
- 2026-07-11 用户明确：前端/桌面端 IA 混乱的修复，**先只做前端精细 UI/UX 优化，桌面端暂搁置**（桌面端已完成能跑的基线，路线 A Tauri 已定）。

## 当前验证状态（2026-07-11）
四端全部绿：backend tsc✓ vitest 34✓ · frontend tsc✓ vitest 19✓ · desktop tsc✓ vitest 37✓ · Rust cargo check✓ · **`tauri build` 产出 `hoyomusic-desktop.exe`**（release 包成功）· **`tauri dev` 已实机弹出原生窗口并连真实曲库**（2026-07-11 用户要求"提交并运行看 UI"，已提交 `330484c` 并启动成功）。
- 桌面真集成：全局快捷键 + 托盘 + 真实流式下载（reqwest）已实现；SMTC 系统媒体键仍为 stub（需 windows crate，GUI 外无法验证，暂缓）。
- 后端 swagger 注解补全（路径 148），契约测试在 `backend/tests/`。

## ⚠️ 后端启动自动迁移 runMigrations 雷区（已踩，必记）
- `backend/src/index.ts` 的 `runMigrations()` 在**每次后端启动**重放一堆 `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` / `UPDATE`（含 tracks/albums uuid、title_cn 回填等），是反复"动结构"的元凶之一。改表结构请走正式迁移文件（`backend/db/migrations/`），**不要指望靠改这段代码持久化**。
- 🔴 **最危险的坑（2026-07-11 阶段三-② 已踩并修复）**：原 `runMigrations` 第 17 步有 `DROP TABLE IF EXISTS artists CASCADE`，每次启动都把刚建好的 `artists` 创作者表清空（症状：启动后 `artists` 表=0 行，但 `track_credits.artist_id` 列仍在、存着 1105 个旧 id）。**该 DROP 已被去掉，步骤17 现在只 `DROP TABLE IF EXISTS track_artists`（真·遗留连接表）**。
- **铁律**：未来任何会话**绝不可**在 `runMigrations()` 里重新加入 `DROP TABLE ... artists`，也不可加入会清掉 `artists`/`track_credits` 数据的语句。`artists` 现在是 canonical 一级表，其数据由 `scripts/backfillArtists.ts` 从 `track_credits` 回填生成（dev 库已回填 1105 创作者/26125 关联）。

## ⚠️ 运行桌面端的硬坑（已踩过，必记）
- **`tauri` CLI 内部调用 `cargo`，但 Bash 工具默认 PATH 无 `~/.cargo/bin`**（`cargo check` 之前用绝对路径 `/c/Users/sumi/.cargo/bin/cargo` 跑的，没暴露此问题）。直接 `npm run tauri dev` 会报 `failed to run 'cargo metadata' ... program not found`。
- **正确启动方式**：先 `export PATH="/c/Users/sumi/.cargo/bin:$PATH"`，再 `cd Desktop && npm run tauri dev`。后端需先 `cd backend && npm run dev`（:3000，Postgres 已在跑）。
- 桌面端 `BASE` 默认绝对 `http://localhost:3000/api`（dev 与打包 exe 都直连），CORS 默认全开，无需 vite 代理。
- **关闭窗口会终止整个 `tauri dev` 进程树（含 vite）**——要看 UI 就别关窗口；关了告诉我重启用带 PATH 的命令。
- **主题：默认亮色**（2026-07-11 由暗色改亮色，保留 HoYo 紫/青强调色；token 在 `global.css`+`AppShell.tsx` 内联 `shellCss`+`theme.ts` 三处同步，`color-scheme: light` + AntD `defaultAlgorithm`）。
- 已知限制：歌单需 JWT（桌面端未做登录→空）；top-tracks 因无播放量数据为空（正常）；SMTC 为桩。

## 行动优先级（未来）
- P2：桌面端补测试（已完成 37 个）、SMTC 真实集成、icon.icns 真实图标（macOS）。
- P3：补占位图/安全收尾/清死代码。
- 任何破坏性 DB 操作（DROP/TRUNCATE/force-reset）必须先问用户确认并备份。
