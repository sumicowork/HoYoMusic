# HoYoMusic 数据库内容与模块设计分析（基于真实数据包 · 2026-07-11）

> 数据源：`hoyomusic_20260710221108aaaem.sql.gz`（2026-07-10 22:11 从服务器下载的全量备份）
> 还原方式：`pg_dump -Fc` 自定义格式 + gzip，已用 `pg_restore --no-owner` 还原到**并行库 `hoyomusic_import`**，原 `hoyomusic`（种子库）未动。
> 还原命令（备查）：
> `gzip -dc "<file>.sql.gz" > db/backups/hoyo_import.dump && pg_restore -U postgres -O -d hoyomusic_import db/backups/hoyo_import.dump`

---

## 0. 数据规模（真实行数）

| 域 | 表 | 行数 | 说明 |
|---|---|---|---|
| 内容 | tracks | **3594** | 核心曲库 |
| 内容 | albums | 146 | 专辑 |
| 内容 | album_discs | 65 | 多碟（disc_number/disc_title） |
| 内容 | games | 8 | 8 款 HoYo 游戏（含 2 款未上线） |
| 创作 | track_credits | **26125** | 词/曲/编曲/演唱…自由字符串，**无 artists 表** |
| 创作 | artist_aliases | 9 | 艺术家别名归一（canonical↔alias） |
| 创作 | artist_role_aliases | 39 | 角色别名归一（录音师↔Recording Engineer） |
| 分类A | tags | 100 | 描述性分面标签（人声类型/语种/BPM…） |
| 分类A | tag_groups | 3 | 标签分组（人声类型/语种/BPM） |
| 分类B | music_source_categories | 12 | 按游戏分的"出处类别"（场景音乐/魔神任务…） |
| 分类B | music_source_nodes | 2550 | 游戏内出处树（游戏→类别→地点，3 层） |
| 关联 | track_tags | 3594 | 曲↔标签 |
| 关联 | track_music_sources | 3988 | 曲↔游戏内出处 |
| 用户 | users | 15 | 仅 `is_admin` 二进制，**无 role 列** |
| 社交 | favorites | 31 | 收藏 |
| 社交 | playlists | 4 | 歌单（playlist_tracks 仅 1 条） |
| 合规 | app_settings | 3 | ICP/公安备案号、维护模式、首访公告 |
| 分析 | track_play_events | 3937 | 播放事件 |
| 分析 | visit_logs | **102394** | 访问日志（会无限膨胀） |
| 导入 | catalog_metadata_import_batches | 1 | 批量导入批次 |
| 导入 | catalog_metadata_import_changes | 2830 | 可回滚的导入变更明细 |

---

## 1. 数据库里到底装了什么（画像）

### 1.1 内容实体
- **tracks**：`file_path` 是阿里云 OSS 直链（`https://hoyomusic.oss-cn-shanghai.aliyuncs.com/...flac`），即音频文件**不在库内**，库只存元数据 + 外链。`title`/`title_cn`/`title_en` 三列并存（样本里三者常相等，如 "PEAK"）；`lyrics_status`(has/none)、`sample_rate`/`bit_depth`/`file_size`/`duration` 是 Hi-Res 无损属性；`uuid` 是唯一外键锚点；`play_count`。
- **albums**：`title/title_cn/title_en` + `game_id` + `cover_path`(OSS)。`album_discs` 支持多碟（如 disc1 霜尽春归 / disc2 早至的黎明）。
- **games**：8 款，`status`(active/unreleased) + `display_order` 控制排序与是否展示未上线游戏。

### 1.2 艺术家（关键结构缺陷）
**没有 `artists` 表。** 艺术家身份完全靠 `track_credits.credit_key`（词/曲/编曲/演唱…）+ `credit_value`（自由字符串，如 `郑宇界JODODO(HOYO-MiX)`、`陈致逸 Yu-Peng Chen`）承载，2.6 万行。
- 存在 `artist_aliases`(9) 与 `artist_role_aliases`(39) 两张**归一辅助表**，但只是"查表映射"，**没有被任何外键强制**——`track_credits` 仍写原始字符串。这就是桌面端 `artist.id` 为 `null`、改名即断链的根因。
- 归一表本身也"半成品"：9 条别名远覆盖不了 26125 条 credits 的实际艺术家数量。

### 1.3 分类体系（三套并存，是最大混乱源）
1. **tags + tag_groups**（全局描述性分面）：如"人声类型/语种/BPM"，可带颜色、可分层（`parent_id`）。BPM 标签是自动生成的（91BPM/87BPM…）。
2. **music_source**（HoYo 专属"游戏内出处"）：`music_source_categories`(按游戏，如原神的 场景音乐/尘歌壶/魔神任务/战斗音乐…) + `music_source_nodes`(3 层树：如 枫丹→枫丹廷区→海薇玛映影欢乐城(白天))。`track_music_sources` 把曲关联到"这歌在游戏的哪个场景/任务里播放"。
3. **album / game**（结构归属）：专辑归属游戏、曲归属专辑。

问题：`tags` 与 `music_source` 在 UI 上常被混为一谈（都是"分类"入口），但语义完全不同——前者是"这首歌听起来像什么"，后者是"这首歌在游戏里哪里能听到"。

### 1.4 用户与权限
`users` 列：id/username/password_hash/email/email_verified/is_admin/account_status/status_reason/last_login_*/token_version。**没有 `role` 列**（此前架构报告推测的"只有 is_admin 无 role"应修正为"只有 is_admin，连 role 枚举都没有"）。权限是 admin / 非admin 二元，无编辑/审核/运营等细粒度角色。

### 1.5 合规与运维（证明是公网站点）
`app_settings` 三条 JSON 直指公网合规：
- `site_compliance`：含 `鲁ICP备2026012072号-1` + `鲁公网安备37030502001081号`（ICP + 公安备案）。
- `maintenance_mode`：维护开关 + 公告。
- `first_visit_modal`：首访弹窗（"内测暂缓推行公告"，预计 7 月继续更新）——证实站点处于**内测/准公网**阶段。

### 1.6 分析与导入
- `visit_logs`(10.2万) 是宽表且无保留策略，会随时间无限膨胀，需分区/滚动清理。
- `catalog_metadata_import_batches` + `catalog_metadata_import_changes`(2830)：管理后台的**批量可回滚元数据导入**系统（这正是之前报告里提到的"可回滚批量导入"模块的真实落地）。

---

## 2. 这是什么网站

**HoYoMusic = 面向 HoYoverse 全家桶（原神/星铁/绝区零/崩坏3/未定事件簿/崩坏学园2/星布谷地/崩坏因缘精灵）的「同人/衍生无损音乐曲库 + 在线试听 + 资料整理」公网站点。**

核心特征（由数据反推）：
- **无损优先**：库只存 FLAC 元数据与外链，强调 Hi-Res（sample_rate/bit_depth/file_size）。
- **游戏内出处标注**：这是它区别于普通音乐站的最大特色——每首曲能定位到"在哪个游戏的哪个场景/任务播放"（music_source 树）。
- **公网合规**：ICP + 公安备案、维护模式、首访公告齐全，内测阶段。
- **批量导入驱动**：曲库靠"可回滚批量导入"维护，而非手工逐条录入。
- **轻社交**：收藏/歌单/站内信/反馈，但使用率极低（playlist_tracks 仅 1 条）。

---

## 3. 建议的模块设计

| 模块 | 职责 | 主要表 |
|---|---|---|
| **A. 曲库浏览** | 专辑/曲目/游戏列表、搜索、筛选 | tracks, albums, album_discs, games |
| **B. 内容实体（创作）** | 词曲编曲等 credits、艺术家归一 | track_credits, artist_aliases, artist_role_aliases（**应升级为 artists 实体表**） |
| **C. 分类体系** | 描述性分面标签 + 游戏内出处树 | tags, tag_groups, music_source_categories, music_source_nodes, track_tags, track_music_sources |
| **D. 用户与权限** | 注册/登录/账号状态/鉴权 | users, auth_verification_codes |
| **E. 轻社交** | 收藏、歌单、站内信、反馈 | favorites, playlists, playlist_tracks, site_messages, site_message_deliveries, feedback_messages |
| **F. 播放器** | 流式试听、歌词、播放统计 | tracks(file_path/lyrics_path), track_play_events |
| **G. 管理后台** | 可回滚批量导入、内容审核、设置 | catalog_metadata_import_*, app_settings |
| **H. 合规与运维** | ICP/备案、维护模式、首访公告、统计 | app_settings, visit_logs, track_play_events |
| **I. 跨端一致（新）** | 前端/桌面端共享路由与术语，消除菜单混乱 | （代码层，非 DB） |

---

## 4. 数据库结构问题（按严重程度）

### P0（必须重构）
1. **艺术家无实体表**：`track_credits.credit_value` 是自由字符串，改名/合并/去重全部断裂。应建 `artists(id, name, name_cn, name_en, ...)` + `track_credits.artist_id` 外键，把 `artist_aliases` 作为"别名子表"挂到 `artists` 上。
2. **分类双轨语义重叠**：`tags`（描述性）与 `music_source`（游戏内出处）在 UI 混用。应**明确分工**并在数据模型上隔离：tags=听觉/语言等"关于音乐本身"的 facet；music_source=游戏内 provenance。
3. **title 三列冗余**：`title/title_cn/title_en` 常相等，易不一致。建议保留 `title`（默认显示）+ 可选 `title_cn`/`title_en` 仅当确有差异时填。

### P1（应改进）
4. **users 无 role**：只有 `is_admin` 布尔。后台运营/审核/编辑等角色无法表达。加 `role` 枚举或角色表。
5. **visit_logs 无保留策略**：10.2 万行且只增不删，需滚动清理/归档（或改为按日聚合）。
6. **artist_aliases / artist_role_aliases 覆盖率极低**（9/39），且与 credits 无外键约束，归一形同虚设。

### P2（可优化）
7. `music_source_nodes` 的 `category_id` 与 `parent_id` 冗余表达层级，可考虑纯 parent 树。
8. `playlist_tracks` 几乎空（1 行），歌单功能实际使用极少，可评估是否降级。

---

## 5. 前端 / 桌面端信息架构统一（基于真实数据）

结合上一版架构报告，新增数据层面的修正建议：
- **术语统一**：游戏内出处（music_source）应叫「出处/场景」，标签（tags）叫「标签」，两者在菜单里必须分开两个入口，不能都叫"分类"。
- **艺术家页**：当前桌面端 `artist.id` 为 null，是因为根本没 artists 表。重建 artists 实体后，艺术家页按 `artist_id` 聚合 credits，而非字符串推导。
- **首页/曲库职责**：首页=推荐+随机（已有 random/top-tracks），曲库=完整浏览+筛选（按 game / music_source / tag）。两者不要重叠成"两个首页"。
- **后台**：把"曲目管理"改名为"曲库/导入"，并补"导入批次"入口（catalog_metadata_import_*），与"站点设置"（app_settings：合规/维护/公告）分开。

---

## 6. 下一步（待你定）

数据已在 `hoyomusic_import`（并行、零风险，原种子库完好）。要让真实数据跑起来，二选一：
- **(a) 指后端到 `hoyomusic_import`**（改 `backend/.env` 的 DATABASE_URL 一行，可逆，不动任何库）——前端/桌面端立即看到 3594 首真实曲库。
- **(b) 用 `hoyomusic_import` 覆盖 `hoyomusic`**（`DROP` + 重命名）——让"hoyomusic"这个名字本身就是真实库，与线上一致，但会清掉现有种子（已备份在 `db/backups/hoyomusic_seed_preimport_20260711.dump`）。

要我执行 (a) 还是 (b)？或者先只做模块/IA 的前端统一、暂不碰数据库？
