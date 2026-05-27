# Windows Client UI/UX Defects and Refactoring Plan

## 1. 问题分析 (UI/UX Defects Analysis)

通过对 `client-desktop/src/HoYoMusic.Desktop.App/` 目录下的 XAML 文件进行深度遍历，发现以下核心 UI/UX 问题：

### 1.1 严重的按钮堆叠 (Excessive Button Stacking)
- **主内容导航区 (`HoYoMainContent.xaml`)**：顶部连续并排了 13 个功能导航按钮（发现、游戏、专辑、艺人等），缺乏合理的层级划分分类或 Pivot/NavigationView 容器，视觉极其拥挤。
- **列表项控制区**：在各种曲目列表（如热门曲目、推荐曲目、歌单、搜索结果）中，每一行数据后都跟随了大量平铺的按钮（如“播放”、“详情”、“收藏”、“队列”、“下首”、“下载”）。由于缺乏收纳（例如“更多”菜单或悬浮显示），导致单行视觉噪音极大。
- **功能栏平铺**：如 `LibrarySectionPanel` 搜索区、歌单区顶部，输入框、下拉框、筛选操作按钮杂乱无章地挤在同一个 `Grid` 中。

### 1.2 粗糙的弹出容器 (Overcrowded Flyouts)
- **播放条 (`HoYoPlayerBar.xaml`)**：将“曲目详情”、“播放队列”、“AB循环”、“播放器增强（EQ）”等极重的内容全部塞入 `Button.Flyout`。而且 Flyout 中又堆叠了繁多的按钮、TextBox、ToggleSwitch。缺乏合理的独立页面或专业面板。
- **标题栏 (`HoYoTitleBar.xaml`)**：账户中心、收件箱、快捷键帮助都被草率地塞在右侧的顶部 Flyout 里，甚至账户中心内堆叠了登录、注册、修改密码等三重 `Expander`，操作空间极其闭塞，不符合直觉。

### 1.3 样式、布局与排版 (Poor Aesthetics & Typography)
- **容器层级**：全量滥用 `Border` 配合 `GlassCardStyle`，使得层级不明确，整个画面可能出现“玻璃卡片套玻璃卡片”的视觉疲劳。
- **Icon 的缺失**：按钮绝大多数只有纯文本填充（如 `Content="上一首"`, `Content="队列"` 等），缺少现代化界面的 SymbolIcon 或 FontIcon，显得非常简陋（像调试用的临时界面）。
- **空间利用**：没有有效地利用宽屏桌面环境，元素不是挤在一起就是生硬地拉伸。

## 2. 整改方案 (Refactoring Plan)

本次大批量重构的目标是：**简化视觉、收纳操作、引入现代 WinUI 控件范式。**

### 2.1 整体导航与路由层级优化
- 将 `HoYoMainContent.xaml` 中顶部的杂乱导航按钮，合并转换为基于 WinUI `NavigationView` 或更整洁的 Top `Pivot`/`Tab` 式分销样式（如果当前基于 Grid 切换不变，则可采用带有水平滑动的 `RadioButtons` 或带有统一 Icon 的 `ListView` 水平模式）。
- 为视觉留白，在不必要的地方去除外层嵌套的玻璃卡片边框。

### 2.2 列表单项操作“收纳化”
- 针对曲目列表项的繁多按钮：“播放”保留为悬浮/左侧状态、“收藏”作为基础图标保留；其余（详情、队列、下首、下载等）统统收纳为带 `FontIcon` 的“更多”操作按钮 (`MenuFlyout`或 `Button.Flyout`) 中隐藏。
- 替换纯文字的“播放”、“收藏”、“详情”，改用 `Button` 包裹 `FontIcon` 实现图标化按钮。

### 2.3 Flyout 面板轻量化
- **HoYoPlayerBar**：精简 Flyout，如“增强”、“AB循环”，将其中的纯文字按钮改用 Icon，或将操作精简。播放队列改用更清晰的结构。
- **HoYoTitleBar**：简化账户中心和收件箱面板布局；使用统一的图标按钮代替文字按钮。

### 2.4 其他细节控件
- 将 `HoYoPlayerBar.xaml` 里的播放控制（上一首/暂停/下一首）进行比例协调，增加明确的视觉重心。
- 全局增加间距（Spacing）和适当对齐（Alignment）。

---

**（文档在此建立，下文将基于此展开自动化 XAML 修改操作。）**

## 3. UI/UX 深度整改与现代化 (Deep UI/UX Refactoring - Stage 3)

### 3.1 MainWindow 模态层与覆盖层优化
- **维护模式 & 首次访问弹窗**：`MainWindow.xaml` 中使用了硬编码的暗色背景 (`#88000000`, `#6B101522`) 和复杂的嵌套 `GlassCardStyle`。
- **现代化方案**：应该采用更加现代的圆角弹出层，使用 `ThemeResource` 替代硬编码颜色，减少 `Border` 的层级嵌套。增加适当的 `FontIcon` 引导，使系统级提示更显优雅。

### 3.2 TitleBar 账户中心 (Account Center) 结构重构
- **多重 Expander 层叠问题**：`HoYoTitleBar.xaml` 中的账户中心 Flyout 包含了“登录”、“安全设置”、“新用户注册”三个 `Expander`，展开时极其冗长且操作空间狭窄。
- **现代化方案**：将 `Expander` 替换为分步/分块视图，例如使用 `Pivot` 或顶部 `StackPanel` 搭配底部状态切换按钮，让用户在单一视口下只看到“登录”、“注册”或“信息”其中一页，极大地提升体验和排版美感。

### 3.3 侧边栏 (SideBar) 视觉减负
- **图标强嵌套**：`HoYoSideBar.xaml` 中每个游戏 Icon 外层都被多层 `Border` 包含（`GlassCardStyle` 嵌套 `PrimaryGradientBrush`）。
- **现代化方案**：精简侧边导航 ListViewItem 的模板，使得未选中时仅为透明背景或轻微的 Hover 响应，选中时才展示高光选区，去除笨重的外边框。

### 3.4 整体排版细节与 Typography
- 改善了 Flyout、模态框的 Spacing。
- 对表单输入框 (`TextBox`, `PasswordBox`) 的宽高比例和布局流进行对齐。

---

## 4. 执行日志 (Execution Log)

### HoYoPlayerBar.xaml Improvements
1. **Track Details Flyout**: Converted inline buttons into a primary Row and an elegant "More" MenuFlyout, removing horizontal clutter.
2. **Queue Flyout**: Implemented a Header/Search section, simplified ItemTemplate with MenuFlyout operations (up, down, remove), and aligned large actions (reverse, shuffle, clear) into a clean Footer grid.
3. **Enhancement Flyout**: Categorized into isolated SubtleGlassCards (EQ, Crossfade, Visualizer).

### HoYoMainContent.xaml Improvements
1. **Playlists Section**: completely scrapped the overlapping horizontal stack layout. Designed a modern two-pane UI.
   - Left Pane: My Playlists list, Search, Inline Add Button.
   - Right Pane: Name/Description editor, actions MenuFlyout, Track count/search, and customized track list view with inline actions.
2. **Library Section**: Discarded massive raw horizontal inputs. Built a clean Advanced Form Panel containing filters for 'Year', 'Duration' and 'Sorting'. Updated ListView cards to match discovery aesthetics.

All fixes natively written in XAML without automated scripts. Project compiles perfectly.
