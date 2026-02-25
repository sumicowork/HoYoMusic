## Plan: HoYoMusic 系统性 UI/UX 优化方案

**执行状态**: 2026-02-25 已完成第一批次

基于对当前 React + Ant Design + Zustand 技术栈的完整代码审查，识别出 8 个核心可用性问题，覆盖导航、播放器、响应式、无障碍、视觉层级等维度。方案按「影响力 × 实现成本」排序，每条均精确到组件和交互变更。

### 执行进度

| 方案 | 状态 | 修改文件 |
|------|------|---------|
| 方案 1：Player 遮挡修复 | ✅ 已完成 | `App.tsx`, `App.css` |
| 方案 2：移动端 Tab 导航 | ✅ 已完成 | `MobileTabBar.tsx`(新), `MobileTabBar.css`(新), `App.tsx`, `App.css` |
| 方案 3：暗色主题硬编码修复 | ✅ 已完成 | `AlbumDetail.css`, `GameDetail.css`, `GameDetail.tsx`, `AlbumDetail.tsx`, `Albums.tsx`, `ArtistDetail.tsx`, `PublicLibrary.tsx`, `Library.tsx`, `Admin.tsx` |
| 方案 4：统一 Header 组件 | 🔲 待执行 | — |
| 方案 5：Player 无障碍增强 | ✅ 已完成 | `Player.tsx`, `Player.css`, `SideNav.tsx` |
| 方案 6：Home 卡片布局修复 | ✅ 已完成 | `Home.tsx`, `Home.css` |
| 移动端响应式修复 | ✅ 已完成 | `Player.css`, `PlayQueue.tsx`, `App.css` |
| 歌词对比度修复 | ✅ 已完成 | `Player.css` |

---

### 一、问题诊断（8 条）

| # | 问题 | 原因（Nielsen原则） | 影响 |
|---|------|---------------------|------|
| 1 | **SideNav 移动端完全隐藏**（`@media max-width:768px display:none`），无替代导航 | 违反「系统可见性」—用户在移动端无法访问搜索/标签/艺术家等核心路由 | **高** |
| 2 | **底部 Player 遮挡页面内容**—fixed 定位高度约 88px，但页面内容未预留 `padding-bottom` | 违反「灵活性与效率」—列表末尾被播放器遮住，最后一首歌无法点击 | **高** |
| 3 | **AlbumDetail/GameDetail 等页面硬编码 `rgba(255,255,255,...)` 背景**（AlbumDetail.css `.album-hero`、GameDetail.css `.album-card`），暗色主题下文字与背景对比度不足 | 违反「一致性」与 WCAG 对比度要求 | **高** |
| 4 | **Player 无 ARIA 属性**—播放/暂停/进度条/音量滑块全部缺少 `role`/`aria-label`，键盘焦点顺序不受控 | 违反「无障碍」原则 | **中** |
| 5 | **搜索页 706 行单组件**（Search.tsx）包含筛选逻辑、tag 选择、结果表格、分页，认知负担重且无搜索历史/空状态引导 | 违反「识别优于回忆」 | **中** |
| 6 | **各页面 Header 重复实现**（Home、Albums、Artists、Tags、Search 各自有独立 header + ThemeToggle），样式不一致 | 违反「一致性与标准」 | **中** |
| 7 | **Home 游戏卡片用 ResizeObserver 强制正方形**但 CSS 同时设 `height:300px`，两者冲突导致潜在布局抖动 | 违反「错误预防」 | **低** |
| 8 | **PlayQueue Drawer 列表项操作按钮过多**（上移/下移/播放/删除 4 个），每首歌 4 个平铺按钮造成信息过载 | 违反「简约设计」 | **低** |

---

### 二、优先级排序后的改进方案

#### 方案 1：修复 Player 遮挡页面底部内容

1. **问题**：`Player` 使用 `position:fixed; bottom:0`，高度约 88px，但全局 `.app` 和各页面 Content 均无 `padding-bottom` 补偿
2. **具体改动**：在 App.css 的 `.app` 选择器中，当 `currentTrack` 存在时添加 `padding-bottom: 96px`；通过在 App.tsx 中给 `.app` div 动态添加 class `has-player`，CSS 中 `.app.has-player { padding-bottom: 96px; }` 
3. **交互变化**：所有页面底部内容始终可见可点击，不再被播放器遮挡
4. **验收标准**：在任意列表页滚动到底部，最后一个元素完整可见且可交互
5. **复杂度**：低
6. **示例代码**：

```tsx
// App.tsx
const App: React.FC = () => {
  const { currentTrack } = usePlayerStore();
  // ...existing code...
  return (
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme} locale={zhCN}>
      <AntApp>
        <Router>
          <div className={`app ${currentTrack ? 'has-player' : ''}`}>
            {/* ...existing code... */}
          </div>
        </Router>
      </AntApp>
    </ConfigProvider>
  );
};
```

```css
/* App.css */
.app.has-player {
  padding-bottom: 96px;
}
```

#### 方案 2：添加移动端底部 Tab 导航

1. **问题**：SideNav 在 ≤768px 隐藏，移动端用户无导航入口
2. **具体改动**：新建 MobileTabBar.tsx，包含主页/搜索/曲库/专辑/更多 5 个 tab icon；用 `position: fixed; bottom: 0`（有 Player 时 `bottom: 88px`）；在 App.tsx 中 `<SideNav />` 旁条件渲染 `<MobileTabBar />`；对应 MobileTabBar.css 中 `@media (min-width: 769px) { display: none }`
3. **交互变化**：移动端用户通过底部固定 tab 切换页面，激活项高亮
4. **验收标准**：≤768px 屏幕下底部出现 5 个导航图标，点击跳转对应路由
5. **复杂度**：中
6. **示例代码**：

```tsx
// components/MobileTabBar.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined, SearchOutlined, UnorderedListOutlined,
  AppstoreOutlined, EllipsisOutlined,
} from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';
import './MobileTabBar.css';

const tabs = [
  { icon: <HomeOutlined />, label: '主页', path: '/' },
  { icon: <SearchOutlined />, label: '搜索', path: '/search' },
  { icon: <UnorderedListOutlined />, label: '曲库', path: '/library' },
  { icon: <AppstoreOutlined />, label: '专辑', path: '/albums' },
  { icon: <EllipsisOutlined />, label: '更多', path: '/tags' },
];

const MobileTabBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTrack } = usePlayerStore();

  return (
    <nav
      className={`mobile-tab-bar ${currentTrack ? 'with-player' : ''}`}
      role="navigation"
      aria-label="移动端导航"
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            className={`mobile-tab-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="mobile-tab-icon">{tab.icon}</span>
            <span className="mobile-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileTabBar;
```

```css
/* components/MobileTabBar.css */
.mobile-tab-bar {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-top: 1px solid var(--glass-border);
  z-index: 999;
  justify-content: space-around;
  align-items: center;
  padding: 0 8px;
}

.mobile-tab-bar.with-player {
  bottom: 88px;
}

.mobile-tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 10px;
  cursor: pointer;
  padding: 6px 12px;
  transition: color 0.2s;
}

.mobile-tab-item.active {
  color: var(--aurora-1);
}

.mobile-tab-icon {
  font-size: 20px;
}

@media (max-width: 768px) {
  .mobile-tab-bar {
    display: flex;
  }
}
```

#### 方案 3：修复暗色主题下硬编码白色背景

1. **问题**：AlbumDetail.css `.album-hero` 和 `.album-tracks` 使用 `rgba(255,255,255,0.65)` 和 `border: 1px solid rgba(255,255,255,0.8)`，暗色下与深色文字对比差；GameDetail.css `.album-card` 同样写死 `rgba(255,255,255,0.15)`、`.album-cover-wrapper` `background: #f0f0f0`、`.album-info` `color: rgba(255,255,255,0.75)`
2. **具体改动**：将这些硬编码值替换为 CSS 变量引用（`var(--glass-bg)`、`var(--glass-border)`），或添加 `[data-theme='dark']` 和 `[data-theme='light']` 前缀分别定义；AlbumDetail.css 的 `.album-hero` / `.album-tracks` 已有 publicPages.css 中的主题覆盖，但 CSS 特异性不足——需将 `.album-hero` 和 `.album-tracks` 的 `background` 声明从 AlbumDetail.css 中移除或降低特异性，让 publicPages.css 生效
3. **交互变化**：暗色主题下所有卡片和 Hero 区域背景透明度、边框颜色正确
4. **验收标准**：切换暗色主题后，AlbumDetail 页面 hero 区文字与背景对比度 ≥ 4.5:1
5. **复杂度**：低
6. **示例代码**：

```css
/* AlbumDetail.css — 移除硬编码，改用变量 */
.album-hero {
  display: flex;
  gap: 32px;
  margin-bottom: 48px;
  padding: 32px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  box-shadow: var(--glass-shadow);
}

.album-tracks {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--glass-shadow);
}
```

```css
/* GameDetail.css — 修复硬编码 */
.album-cover-wrapper {
  /* 替换 background: #f0f0f0 */
  background: var(--bg-tertiary);
}

.album-info {
  /* 替换 color: rgba(255,255,255,0.75) */
  color: var(--text-secondary);
}
```

#### 方案 4：统一页面 Header 为共享组件

1. **问题**：Home、Albums、Artists、Tags、Search 各自重复实现 header（logo + ThemeToggle + 搜索框），样式和行为不一致
2. **具体改动**：新建 PageHeader.tsx，接受 `title`、`extra`（搜索框等额外 slot）props；内部包含 logo 点击跳转首页 + `<ThemeToggle />`；各页面替换各自 `<Header>` 为 `<PageHeader extra={...} />`；移除各页面 CSS 中重复的 `.header-content` 样式，统一到 PageHeader.css
3. **交互变化**：所有页面顶部导航外观和交互完全一致
4. **验收标准**：所有前台页面共用同一 Header 组件，主题切换按钮位置一致
5. **复杂度**：中
6. **示例代码**：

```tsx
// components/PageHeader.tsx
import React from 'react';
import { Layout } from 'antd';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import './PageHeader.css';

const { Header } = Layout;

interface PageHeaderProps {
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ extra }) => {
  const navigate = useNavigate();

  return (
    <Header className="page-header">
      <div className="page-header-content">
        <h1 className="page-header-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          🎵 HoYoMusic
        </h1>
        <div className="page-header-actions">
          {extra}
          <ThemeToggle />
        </div>
      </div>
    </Header>
  );
};

export default PageHeader;
```

```css
/* components/PageHeader.css */
.page-header {
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-border);
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

[data-theme='light'] .page-header {
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 4px 24px rgba(102, 126, 234, 0.12);
}

[data-theme='dark'] .page-header {
  background: rgba(10, 8, 30, 0.72);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.page-header-content {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header-logo {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (max-width: 768px) {
  .page-header-logo {
    font-size: 20px;
  }
  .page-header-actions {
    gap: 8px;
  }
}
```

#### 方案 5：Player 组件无障碍增强

1. **问题**：播放/暂停按钮无 `aria-label`，进度 Slider 无 `role="slider"` 和 `aria-valuetext`，快捷键无屏幕提示
2. **具体改动**：在 Player.tsx 中，给播放/暂停 `<Button>` 添加 `aria-label={isPlaying ? '暂停' : '播放'}`；给进度 `<Slider>` 添加 `aria-label="播放进度"`；给音量 `<Slider>` 添加 `aria-label="音量"`；给整个 `.player-container` 添加 `role="region" aria-label="音乐播放器"`；添加 `tabIndex` 管理确保焦点从左到右合理流动
3. **交互变化**：屏幕阅读器能朗读播放器状态；Tab 键可按序聚焦所有控件
4. **验收标准**：使用 NVDA/VoiceOver 能正确朗读当前曲目名、播放状态、进度
5. **复杂度**：低
6. **示例代码**：

```tsx
// Player.tsx — collapsed mini bar 部分
<div className="player-container" role="region" aria-label="音乐播放器">
  <div
    className="player-expand-hint"
    onClick={() => setExpanded(true)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); } }}
    tabIndex={0}
    role="button"
    aria-label="展开播放器查看歌词"
    title="点击展开查看歌词"
  />
  {/* ...existing code... */}
  <Button
    type="primary"
    shape="circle"
    icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
    onClick={handleTogglePlay}
    size="large"
    aria-label={isPlaying ? '暂停' : '播放'}
  />
  {/* ...existing code... */}
  <Slider
    value={progress}
    max={duration}
    onChange={handleSeek}
    tooltip={{ formatter: (value) => formatTime(value || 0) }}
    className="player-slider"
    aria-label="播放进度"
  />
  {/* ...existing code... */}
  <Slider
    value={volume}
    min={0} max={1} step={0.01}
    onChange={handleVolumeChange}
    style={{ width: 100, marginLeft: 12 }}
    aria-label="音量"
  />
</div>
```

#### 方案 6：Home 游戏卡片布局修复

1. **问题**：Home.tsx `GameCard` 用 `ResizeObserver` 设 `el.style.height = el.offsetWidth + 'px'` 强制正方形，但 Home.css `.game-cover` 同时设 `height: 300px`，二者冲突导致初始渲染闪烁
2. **具体改动**：移除 GameCard 中整个 `ResizeObserver` 逻辑；在 `.game-cover` CSS 中改为 `padding-top: 100%; height: auto;` 配合 `position: relative`，图片使用 `position: absolute; inset: 0` 实现纯 CSS 正方形
3. **交互变化**：卡片初始加载无布局跳动
4. **验收标准**：刷新 Home 页，卡片封面无抖动/高度突变
5. **复杂度**：低
6. **示例代码**：

```tsx
// Home.tsx — GameCard 组件，移除 ResizeObserver
const GameCard: React.FC<{
  game: Game;
  status: 'maintenance' | 'unreleased' | 'active';
  onClick: () => void;
}> = ({ game, status, onClick }) => {
  const isDisabled = status !== 'active';
  // 移除 coverRef、useEffect(ResizeObserver) 整块逻辑

  return (
    <Card
      className={`game-card${isDisabled ? ' game-card-disabled' : ''}`}
      onClick={onClick}
      cover={
        <div className="game-cover">
          {/* ...existing cover content... */}
        </div>
      }
    >
    </Card>
  );
};
```

```css
/* Home.css — 纯 CSS 正方形 */
.game-cover {
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 aspect ratio */
  overflow: hidden;
  /* 移除 height: 300px */
}

.game-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

---

### 三、关键用户路径优化

#### 路径 1：「从首页找到某首歌并播放」

**当前路径（6 步）：**
1. 进入首页 → 点击游戏卡片
2. 进入 GameDetail → 浏览专辑卡片 → 点击某专辑
3. 进入 AlbumDetail → 在表格中找到目标歌曲
4. 点击「播放」按钮
5. 歌曲开始播放
6. 若想听歌词 → 需手动点击 Player 展开按钮

**优化后路径（4 步）：**
1. 进入首页 → 点击游戏卡片
2. 进入 GameDetail → 点击专辑卡片（卡片悬浮显示「播放全部」快捷按钮）
3. 全部歌曲加入队列并自动播放第一首
4. Player 自动展开为全屏模式（如有歌词）

**减少 2 步**。具体改动：在 GameDetail.tsx 专辑卡片 hover 时叠加 `PlayCircleOutlined` 按钮，点击时调用 `setPlaylist(albumTracks) + play(tracks[0])`；在 `playerStore` 中增加 `autoExpandOnLyrics` 选项。

#### 路径 2：「搜索特定歌曲」

**当前路径（4 步）：**
1. 点击 SideNav 搜索 → 进入 Search 页
2. 在搜索框输入关键词
3. 点击搜索按钮
4. 在结果表格中找到目标

**优化后路径（3 步）：**
1. 按 `Ctrl+K` 全局快捷键弹出搜索框（不离开当前页面）
2. 输入关键词，实时显示前 5 条结果
3. 点击结果直接播放或跳转

**减少 1 步**。具体改动：新建 `QuickSearchModal` 组件，注册全局 `Ctrl+K` 快捷键，调用 `trackService.searchTracksPublic` 实时搜索。

---

### 四、视觉层改进建议

| 维度 | 当前问题 | 修正 |
|------|---------|------|
| **信息层级** | Home 游戏卡片只有封面 + 底部专辑数 badge，无游戏名文字标签，新用户无法识别不熟悉的游戏 | 在卡片底部 badge 上方添加 `game.name` 文字标签，字号 16px/600 weight |
| **字体大小体系** | 页面标题使用范围散乱：Home h1 24px、AlbumDetail h1 36px、TrackDetail h1 32px、Search hero 36px | 统一标题层级：h1=32px、h2=24px、h3=18px、body=14px、caption=12px，写入 CSS 变量 `--font-h1` 到 `--font-caption` |
| **间距体系** | 内容区 padding 不一致：Home `40px 24px`、Albums `32px 24px`、Search `40px 24px 80px`、TrackDetail `24px` | 统一为 `--page-padding: 32px 24px; --page-padding-mobile: 16px` |
| **颜色使用** | `#999`、`#888`、`rgba(255,255,255,0.75)` 等硬编码灰色散布于各 TSX 内联 style（如 AlbumDetail columns、GameDetail album-info） | 全部替换为 `var(--text-secondary)` 或 `var(--text-tertiary)` |
| **认知负担** | Search 页同时展示关键词输入 + 排序 + 筛选按钮 + 快捷标签 + 结果表格 + 分页，首屏信息过多 | 将筛选面板默认折叠（已是 Drawer 实现），搜索前只显示搜索框 + 快捷标签；搜索后才显示排序和结果区 |

---

### 五、移动端适配检查

| # | 问题 | 修正方式 |
|---|------|---------|
| 1 | **SideNav 隐藏无替代** | 添加 `<MobileTabBar />`（方案 2） |
| 2 | **Player expanded 全屏模式左右布局**（`.player-expanded-body` flex 横向）在窄屏下左侧封面 `flex: 0 0 300px` 溢出 | 添加 `@media (max-width: 768px)` 将 `.player-expanded-body` 改为 `flex-direction: column`，封面区 `flex: none; max-width: 200px; margin: 0 auto` |
| 3 | **Albums 页搜索框**在 header-actions 中 `width: 300px` 在小屏溢出，虽有 media query 但只缩到 200px | 将 Search 组件改为 `width: 100%`，header-actions `flex-wrap: wrap` |
| 4 | **PlayQueue Drawer** `width={400}` 固定值在小屏超出视口 | 改为 `width={window.innerWidth < 480 ? '100%' : 400}` 或使用 Ant Design Drawer `width="85vw"` 配合 `max-width: 400px` |
| 5 | **AlbumDetail 操作列** Table columns 操作区 `width: 180` 在小屏被压缩，按钮文字溢出 | 在 ≤768px 下隐藏按钮文字只保留 icon；或将 Table 改为 List 展示 |
| 6 | **Player mini bar 三栏布局**（track-info / controls / volume）在小屏下 volume 区被挤压不可见 | 添加 `@media (max-width: 768px)` 隐藏 `.player-volume` 的 Slider，只保留音量 icon 和队列按钮 |

---

### 六、无障碍优化（Accessibility）

| 维度 | 当前问题 | 修正 |
|------|---------|------|
| **ARIA 属性** | `Player` 整体无 `role="region"`；播放/暂停按钮无 `aria-label`；SideNav 无 `role="navigation"` `aria-label="主导航"` | 在 Player.tsx `.player-container` div 添加 `role="region" aria-label="音乐播放器"`；播放按钮添加 `aria-label={isPlaying ? '暂停' : '播放'}`；SideNav.tsx `<nav>` 已用语义标签但缺少 `aria-label="主导航"` |
| **键盘操作** | Player 已支持空格/方向键，但 `player-expand-hint` div（点击展开）无 `tabIndex` 无 `onKeyDown`，键盘用户无法展开全屏播放器 | 给 `.player-expand-hint` 添加 `tabIndex={0} role="button" aria-label="展开播放器"` 和 `onKeyDown` 监听 Enter/Space |
| **对比度** | 暗色主题下 `.player-artist` 颜色为 `var(--text-secondary)` = `rgba(255,255,255,0.65)`，在 `#1f1f1f` 背景上对比度仅 ~5.6:1（通过）；但 `.player-lyric-line` 非活动歌词 `rgba(255,255,255,0.45)` 对比度约 3.7:1（不通过 WCAG AA） | 将 `.player-lyric-line` 默认颜色从 `0.45` 提升到 `0.55` |
| **焦点管理** | Player 展开全屏时焦点不被困在模态内，可 Tab 到背后被遮挡的页面元素 | 展开时用 `focus-trap` 或手动实现焦点锁定（`inert` attribute on `.app` or a focus-trap wrapper） |


