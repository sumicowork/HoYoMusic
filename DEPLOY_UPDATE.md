# 🚀 HoYoMusic 增量部署指南

**基于当前生产环境的增量更新步骤**

> 本文档记录每次功能更新后，基于已运行的生产环境需要执行的增量部署操作。
> 生产环境已通过 1Panel 面板部署，后端运行在 Node.js 进程，前端为 Nginx 静态托管。

---

## 通用部署流程

每次更新都遵循以下基本流程：

```bash
# 1. 在服务器上拉取最新代码
cd /path/to/hoyomusic
git pull origin main

# 2. 后端：安装新依赖 + 重启
cd backend
npm install --production
# 通过 1Panel 或 pm2 重启 Node 进程
pm2 restart hoyomusic-backend   # 或 1Panel 面板重启

# 3. 前端：重新构建 + 替换静态文件
cd ../frontend
npm install
npm run build
# 将 dist/ 内容复制到 Nginx 静态目录
cp -r dist/* /path/to/nginx/html/
```

---

## 更新记录

### 2026-03-11 — v3.9 播放体验大幅升级

本次更新聚焦音乐播放体验，新增均衡器、频谱可视化、拖拽排序、动态封面背景。

#### 后端变更

**无变更**。本次更新纯前端。

#### 前端变更

**无新增 npm 依赖**（已有的 `react-beautiful-dnd` 现已启用）。

需要重新 `npm run build`：

**新增文件**：
- `utils/audioContext.ts` — Web Audio API 单例（AudioContext + 10 段 EQ BiquadFilter + AnalyserNode）
- `utils/useDominantColor.ts` — 封面图主色提取 Hook（Canvas getImageData）
- `store/equalizerStore.ts` — 均衡器 Zustand Store（10 段增益 + 10 个预设 + localStorage 持久化）
- `components/EqualizerControl.tsx` — 均衡器 UI（10 段垂直滑块 + 预设选择 + 开关）
- `components/EqualizerControl.css` — 均衡器样式
- `components/SpectrumVisualizer.tsx` — 实时音频频谱可视化（Canvas + requestAnimationFrame）
- `components/SpectrumVisualizer.css` — 频谱样式

**修改文件**：
- `components/Player.tsx` — 集成 AudioGraph（EQ + 频谱）、动态封面背景、均衡器按钮
- `components/PlayQueue.tsx` — 从箭头按钮改为拖拽排序（react-beautiful-dnd DragDropContext）
- `components/PlayQueue.css` — 拖拽样式（drag handle、拖拽中高亮）

**功能说明**：
1. **均衡器** — 10 段频率调节（31Hz~16KHz），内置 10 个预设（平坦/重低音/高音/人声/摇滚/电子/古典/爵士/流行/原声），设置持久化到 localStorage
2. **频谱可视化** — 展开播放器后封面图下方显示实时频谱柱状图
3. **拖拽排序** — 播放队列支持拖拽重新排序（拖拽手柄 + 拖拽中视觉反馈）
4. **动态封面背景** — 展开播放器时，背景自动提取封面图主色生成渐变（类似 Apple Music）

#### 部署命令

```bash
cd /path/to/hoyomusic
git pull origin main

# 后端（无变更，无需重启）

# 前端（重新构建）
cd frontend
npm run build
cp -r dist/* /path/to/nginx/html/
```

---

### 2026-03-11 — v3.8 性能优化与搜索增强

本次更新聚焦后端性能优化和前端搜索体验提升。

#### 后端变更

**无新增 npm 依赖**。

**代码优化**（无需额外操作，重启后端即可生效）：
- `cache.ts` — 内存缓存升级为 LRU 缓存（最大 500 条目，防止无限增长）
- `cache.ts` — 新增 `getOrRefresh()` stale-while-revalidate 方法（零延迟缓存刷新）
- `albumController.ts` — 缓存 TTL 统一为 300 秒（原 120 秒）
- `artistController.ts` — 缓存 TTL 统一为 300 秒（原 180 秒）
- `tagController.ts` — 缓存 TTL 统一为 300 秒（原 120 秒）
- `artistController.ts` — `getArtistById` N+1 查询优化：6 次数据库往返 → 2 次（CTE 合并）

**无数据库 Schema 变更**。

#### 前端变更

需要重新 `npm run build`：
- `Search.tsx` — 搜索条件 URL 持久化（所有筛选条件编码到 URL Query，支持书签/分享/刷新保持）

#### 部署命令

```bash
cd /path/to/hoyomusic
git pull origin main

# 后端（无新依赖，直接重启）
pm2 restart hoyomusic-backend

# 前端（重新构建）
cd frontend
npm run build
cp -r dist/* /path/to/nginx/html/
```

---

### 2026-03-10 — v3.6 功能批量更新

本次更新包含大量新功能和性能优化，需要执行以下步骤：

#### 后端变更

**新增 npm 依赖**（需要 `npm install`）：
- `pino` + `pino-pretty` — 结构化日志
- `swagger-jsdoc` + `swagger-ui-express` — API 文档
- `zod` — 请求验证

**数据库自动迁移**（后端启动时自动执行，无需手动操作）：
- `playlists` 表 + `playlist_tracks` 表（播放列表系统）
- `favorites` 表（收藏系统）
- `tracks` 表新增 `sha256_hash`、`play_count` 列
- `visit_logs` 表（访问统计）

**新增 API 端点**：
- `POST /api/auth/change-password` — 修改密码
- `GET /api/docs` — Swagger API 文档
- `GET /api/analytics/export` — 数据导出 (JSON/CSV)
- `GET /api/analytics/duplicates` — 重复检测
- `GET /api/analytics/storage` — 存储分析
- `POST /api/public/tracks/:id/play` — 播放计数
- `GET /api/public/top-tracks` — 热门排行
- `POST /api/favorites/toggle` — 切换收藏
- `GET /api/favorites` — 收藏列表
- `GET/POST /api/playlists` — 播放列表 CRUD

**无需额外配置**，所有新功能开箱即用。

#### 前端变更

需要重新 `npm install` 和 `npm run build`：
- 新增：收藏页面、播放列表页面、设置页面
- 新增：睡眠定时器、淡入淡出控制
- 新增：搜索历史、热门排行
- 新增：OLED 纯黑主题
- 新增：键盘快捷键增强
- 新增：存储分析面板

#### 部署命令

```bash
cd /path/to/hoyomusic
git pull origin main

# 后端
cd backend
npm install --production
pm2 restart hoyomusic-backend

# 前端
cd ../frontend
npm install
npm run build
cp -r dist/* /path/to/nginx/html/

# 验证
curl http://localhost:3000/api/health
curl http://localhost:3000/api/docs
```

---

*后续每个功能更新将在下方追加部署说明*

