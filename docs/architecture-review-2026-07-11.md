# HoYoMusic 产品/架构/数据库 综合分析报告

> 日期：2026-07-11
> 目的：在动手统一前端/桌面端「展示与操作」之前，先把"这是什么网站、需要什么模块、数据库结构是否合理"想清楚。
> 范围：基于本地 `hoyomusic` 库（结构 = 线上真值，数据 = 极小种子）、`backend/db/schema.sql`、frontend / Desktop 源码的实际探查。

---

## 0. 数据现状（先回答导入问题）

- 本地 Postgres 在跑（:5432），`hoyomusic` 库存在，**但只有种子数据**：tracks=4、albums=4、games=7、users=1、tag_groups=6、visit_logs=32，其余表 0 行。
- **未导入任何"从服务器下载的数据包"**——磁盘上也找不到该数据包文件。
- 之前的工作是把线上库的 **schema** 用 `pg_dump` 重建为 `backend/db/schema.sql`（27 张表定义，本地实装 26 张，缺 `artist_avatars`）。
- 结论：当前本地库**不能**反映真实曲库规模，做 UI 联调时看到的都是空壳/样例。若要真机调试，需导入数据包（破坏性操作，须先备份+确认）。

---

## 1. 这是一个什么网站

**HoYoMusic = 一个面向 miHoYo / HoYoverse 游戏的「同人音乐曲库 / 在线试听 + 资料整理」站点。**

内容域（来自 `games` 表与样例专辑）：
原神 / 崩坏：星穹铁道 / 绝区零 / 崩坏3 / 未定事件簿 / 崩坏因缘精灵 / 星布谷地。

核心能力（从表结构反推）：
- **曲库浏览**：按 游戏 / 专辑 / 艺术家 / 标签 四个维度检索与试听。
- **无损播放/下载**：tracks 表存 `sample_rate`(48k)、`bit_depth`(24)、`file_size`、`sha256_hash`，明显是 FLAC 无损曲库。
- **用户体系**：注册/登录、收藏(favorites)、自建歌单(playlists)、个人页(Profile)。
- **管理后台**：专辑/艺术家/标签/游戏/用户管理，还有一套**元数据批量导入+可回滚**子系统（`catalog_metadata_import_*`）。
- **运营能力**：站内信(site_messages)、用户反馈(feedback_messages)、访问日志(visit_logs)、有效播放统计(track_play_events)。
- **合规能力**：`app_settings` 里有 `maintenance_mode`、`site_compliance`(ICP/公安备案号)、`first_visit_modal` —— 说明它是**面向公网、需要满足国内合规**的真实站点。

一句话定位：**"HoYoverse 游戏原声的维基 + 无损音乐库 + 轻量社区"**。

---

## 2. 模块设计（产品视角应拆成的模块）

| 模块 | 职责 | 现有落地 | 备注 |
|---|---|---|---|
| **A. 曲库浏览（Discover/Library）** | 首页精选、全量曲库、搜索 | FE: Home/PublicLibrary/Search；Desktop: Home/Library/Search | Home 与 Library 职责重叠，需厘清 |
| **B. 内容实体** | 专辑 / 艺术家 / 单曲 / 游戏 的详情与列表 | albums/tracks/games + 虚拟艺术家 | 艺术家无独立表（见 §3 重大缺陷） |
| **C. 分类体系** | 标签(tag) + 曲源树(music_source) 两套 | tags/tag_groups + music_source_* | 两套并用且命名含糊，需定边界 |
| **D. 用户与社交** | 注册登录、收藏、歌单、个人页、站内信、反馈 | users/favorites/playlists/site_messages/feedback | Desktop 暂无账号体系 |
| **E. 播放器** | 流式播放、下载、队列、进度 | tracks.file_path + 播放器组件 | Desktop 已打通真实流式下载 |
| **F. 管理后台** | 内容 CRUD + 元数据导入回滚 + 用户/数据分析/设置 | admin 多页 + catalog_metadata_import_* | 导航与术语混乱（见 §4） |
| **G. 合规与运维** | 维护模式、备案信息、首访弹窗、访问/播放统计 | app_settings + visit_logs + track_play_events | 日志表会无限膨胀，需保留策略 |
| **H. 跨端一致性** | 路由/菜单/术语/主题 在前端与桌面端统一 | 目前两边几乎不可互映射 | 本次重点 |

---

## 3. 数据库结构批判（综合评估）

### 3.1 优点（先肯定）
- **外键齐全**（28 个），删除语义合理：依赖表 CASCADE、可选父表 SET NULL。
- 专辑/曲目用 `uuid` 做对外引用，安全。
- 索引覆盖到位；`app_settings` 用 JSONB 存单例配置，合理。

### 3.2 重大缺陷（P0，建议重构）
1. **艺术家没有一级实体表。**
   艺术家是"虚拟"的：从 `track_credits`(credit_key/credit_value 的 EAV) 推导，`artist_avatars` 用**名字字符串**当键，`artist_aliases`/`artist_role_aliases` 也都是名字字符串。
   后果：艺术家页要靠聚合 `track_credits` 重建；`artist.id` 为 null（桌面端详情页已踩坑）；改名即断链；"某歌手所有歌"只能字符串匹配。
   **应新增 `artists(id, name, name_en, bio, avatar_path, ...)`，并让 `track_credits.artist_id` 引用它；`artist_avatars` 合并进 `artists`。**

2. **两套分类体系职责重叠、命名晦涩。**
   `music_source_categories`/`music_source_nodes`（按游戏的三级树）+ `tags`/`tag_groups`（全局层级标签），两者都给曲目打标。
   建议**显式分工并改名**：
   - `music_source_*` → "曲源树 / 在游戏内的出现场景"（主题曲/战斗/城镇/BOSS…），改名 `soundtrack_categories`/`soundtrack_nodes`；
   - `tags`/`tag_groups` → "编辑向分类"（流派/情绪/语言），保留；
   - 在 UI 术语表与文档里写清两者区别，避免互相竞争。

3. **标题三列冗余。**
   `tracks` / `albums` 同时有 `title` + `title_cn` + `title_en`，哪个是"权威展示名"不清晰。
   **建议**：`title`=展示名（默认中文/本地化），`title_original`=原名（原文），删除三向拆分。

### 3.3 中等问题（P1）
4. **`track_credits` 是 EAV**：能存任意角色（作曲/作词/演唱/编曲），但"按角色查艺术家"无法类型化。配合 §3.2-1 加 `artist_id` 后解决。
5. **`users` 只有 `is_admin` 布尔，无 `role`**：无法区分 普通用户/编辑/审核/管理员。部分 UI 期望 `role` 列（已验证查询 `role` 报错）。建议加 `role` 枚举（user/editor/moderator/admin）。
6. **`visit_logs` / `track_play_events` 宽表且无保留策略**：含经纬度、UA 解析、字节数等，会无限增长，拖慢备份与查询。建议：加月度分区 / 定时清理 / 或独立 analytics schema。
7. **`music_source_nodes` 上 `game_id` 与 `category_id` 并存**：`game_id` 可由 `category_id` 推导，属冗余（为查询性能可保留，但需注释为派生）。

### 3.4 小问题（P2）
8. `app_settings` 把维护/合规/首访弹窗混在一张 JSONB 表——可接受，但建议按 key 分组管理。
9. `album_discs` + `tracks.disc_id` + `tracks.track_number` 三段式定位碟/轨，略分散，可保留。
10. 本地实装比 schema.sql 少 `artist_avatars` 表（表结构漂移，需走迁移补齐）。

> 所有改动必须以**迁移文件**落地（项目已有 `backend/db/migrations/` + `migrate.ts`），且对线上真值库向后兼容；禁止直接 DROP/TRUNCATE。

---

## 4. 前端 / 桌面端「展示与操作」混乱清单（来自源码探查）

### 4.1 路由命名两 app 互相矛盾
| 概念 | frontend | Desktop |
|---|---|---|
| 专辑 | `/albums`(复数) | `/album`(单数) |
| 艺术家 | `/artists` | `/artist` |
| 歌单 | `/playlists/:id` | `/playlist` |
| 曲库 | `/library`（叫"曲库"） | `/library`（叫"乐库"） |

### 4.2 同一概念三套文案
- `/library`：FE 侧栏"曲库" / Desktop"乐库"
- `/`：FE"主页" / Desktop"首页"
- `/artists`：FE 侧栏"艺术家" / FE 移动底栏"创作者"

### 4.3 孤儿页面（有路由、菜单进不去）
- FE：`/tags`、`/tags/:id`、`/games/:id` 在任一菜单都无入口。
- Desktop：`/album`、`/artist` 不在侧栏，只靠 Library 卡片链接进入。

### 4.4 重复 / 重叠
- FE `Home` 与 `PublicLibrary` 都是浏览型，边界模糊。
- 标签双套：`Tags`/`TagDetail`(公开) 与 `TagManagement`(后台) 并存，但公开端无入口。

### 4.5 后台语义混乱
- `/admin` 导航 label 写"曲目管理"，实际是仪表盘 → 误导。
- 退出登录 `navigate('/admin/login')` 是**无效路由**，会落到 `*`→`/` 导致状态错乱。
- "Music Source 库" 用英文 label，其余皆中文，路径风格突兀。
- "管理后台"入口对**所有用户**可见，点了才被 `requireAdmin` 拦截回 `/`——入口暴露即无效。
- Desktop **完全无账号体系**（无 `/me`、无登录、无 admin），维护模式也无等效处理。

---

## 5. 统一方案建议（先对齐，再实施）

### 5.1 路由约定（两端强制一致）
- 集合资源用**复数**：`/albums`、`/artists`、`/tracks`、`/tags`、`/games`、`/playlists`、`/users`。
- 详情：`/{resource}/:id`。
- 两端共享同一套路由常量（抽一个 `routes.ts`）。

### 5.2 统一中文术语表（定一次，全端遵守）
| 概念 | 规范中文 | 禁用别名 |
|---|---|---|
| `/` | 首页 | 主页 |
| `/library` | 曲库 | 乐库 |
| `/artists` | 艺术家 | 创作者 |
| 歌单 | 歌单 | 播放列表 |
| 我的 | 我的 | — |

### 5.3 前端菜单层级（统一后）
- 主导航（未登录）：首页 / 搜索 / 曲库 / 专辑 / 艺术家 / 标签 / 游戏
- 用户区（登录后）：我的 / 我的歌单 / 反馈
- 管理后台（仅 `is_admin` 显示）：
  - 概览（原"曲目管理"改名）
  - 内容资产：专辑 / 艺术家 / 标签 / 游戏
  - 曲源管理：曲源库（原 Music Source）
  - 运营：用户 / 数据分析 / 站内信 / 反馈
  - 系统：设置
- 修复退出登录（清 token 后跳 `/`，删 `/admin/login` 依赖）；仅管理员可见后台入口。

### 5.4 桌面端菜单（播放器应精简）
侧栏：首页 / 曲库 / 搜索 / 歌单 / 我的（后续加账号）。
专辑/艺术家经曲库卡片进入即可，不堆进原生播放器导航；桌面端不进管理后台（符合"播放器"定位）。

### 5.5 孤儿页清理
- FE：把「标签」「游戏」补进导航；新增 `/games` 索引页（目前只有 `/games/:id`）。
- 厘清 Home vs 曲库：Home=个性化精选/推荐，曲库=全量可筛选浏览。

---

## 6. 建议的实施顺序（待你确认）
1. **（可选）导入真实数据包**做真机调试 —— 需你提供路径，我先备份再导入。
2. **统一术语表 + 路由常量**（低成本、高收益，先动这个）。
3. **修前端菜单/孤儿页/后台语义**（纯前端，风险低）。
4. **桌面端菜单对齐**（加 专辑/艺术家 入口或确认靠卡片进入）。
5. **数据库重构 P0**（建 `artists` 表、理清两套分类、合并 `artist_avatars`）—— 走迁移，兼容线上。
6. **日志表保留策略**（P1）。

> 本报告仅做分析与方案，未改动任何代码/数据。下一步想先推进哪一块？（我建议从 2→3 开始，纯前端、立竿见影。）
