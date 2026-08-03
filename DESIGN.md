# HoYoMusic Design System

> Aurora Glass — 极光玻璃设计语言。融合 HoYoVerse 绚烂色彩与百科型平台的清晰层次。

**Keywords**: `Aurora` `Glassmorphism` `Gradient` `Atmospheric Depth` `Precision`


## 1. Visual Theme & Atmosphere

| Principle | Description |
|-----------|-------------|
| **Aurora Depth** | 多层极光光晕叠加（`body::before` + `body::after`），3 组 radial-gradient + 18s 循环动画 |
| **Glass Clarity** | 三级 blur：`light`(10px) / `standard`(18px) / `heavy`(28px)，均 `saturate()` 保持色彩 |
| **Film Grain** | `body::before` SVG feTurbulence noise（opacity 0.03）模拟胶片质感 |
| **Reduced Motion** | `prefers-reduced-motion: reduce` 关闭 auroraShift + login 动画 |

Light: 冰白 + 蓝紫极光 diffuse；Dark: `#0f0c29` → `#302b63` → `#24243e` 渐变

## 2. Color Palette & Roles

### 2.1 Aurora Palette

| Token | HEX | rgba | Role |
|-------|-----|------|------|
| `--aurora-1` | `#667eea` | `rgba(102,126,234,1)` | Primary Brand |
| `--aurora-2` | `#764ba2` | `rgba(118,75,162,1)` | Primary Dark |
| `--aurora-3` | `#f093fb` | `rgba(240,147,251,1)` | Accent Pink |
| `--aurora-4` | `#4facfe` | `rgba(79,172,254,1)` | Info Tone |
| `--aurora-5` | `#43e97b` | `rgba(67,233,123,1)` | Success |
| `--aurora-6` | `#fa709a` | `rgba(250,112,154,1)` | Danger |
| `--aurora-7` | `#a18cd1` | `rgba(161,140,209,1)` | Soft Accent |
| `--aurora-warm` | `#FFB347` | `rgba(255,179,71,1)` | Warning |

### 2.2 Semantic Tokens

```css
:root {
  --color-primary: #667eea; --color-primary-hover: #7b93ff; --color-primary-active: #5a6fd6;
  --color-success: #52c41a; --color-warning: #faad14; --color-danger: #ff4d4f; --color-info: #4facfe;
  --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-primary-hover: linear-gradient(135deg, #7b93ff 0%, #8c5fb5 100%);
  --gradient-header: linear-gradient(90deg, var(--aurora-1), var(--aurora-3), var(--aurora-4), var(--aurora-2));
  --gradient-text: linear-gradient(135deg, #a8c0ff, #e0aaff, #ffd6ff);
}
```

### 2.3 Theme Variables

| Token | Light | Dark |
|-------|-------|------|
| `--bg-primary` | `#ffffff` | `#141414` |
| `--bg-secondary` | `#fafafa` | `#1f1f1f` |
| `--bg-tertiary` | `#f5f5f5` | `#262626` |
| `--bg-elevated` | `#ffffff` | `#1f1f1f` |
| `--bg-overlay` | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.65)` |
| `--text-primary` | `rgba(0,0,0,0.88)` | `rgba(255,255,255,0.85)` |
| `--text-secondary` | `rgba(0,0,0,0.65)` | `rgba(255,255,255,0.65)` |
| `--text-tertiary` | `rgba(0,0,0,0.45)` | `rgba(255,255,255,0.45)` |
| `--text-disabled` | `rgba(0,0,0,0.25)` | `rgba(255,255,255,0.25)` |
| `--border-primary` | `#d9d9d9` | `#434343` |
| `--border-secondary` | `#f0f0f0` | `#303030` |
| `--divider` | `rgba(5,5,5,0.06)` | `rgba(255,255,255,0.12)` |

### 2.4 Glass Surface Tokens

```css
:root {
  --glass-bg-light: rgba(255,255,255,0.6);       --glass-bg-dark: rgba(20,20,40,0.55);
  --glass-border-light: rgba(255,255,255,0.7);     --glass-border-dark: rgba(255,255,255,0.12);
  --glass-shadow-light: 0 8px 32px rgba(102,126,234,0.18), 0 2px 8px rgba(0,0,0,0.08);
  --glass-shadow-dark: 0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3);
  --glass-blur: blur(18px) saturate(180%);         --glass-blur-heavy: blur(28px) saturate(200%);
  --glass-blur-light: blur(10px) saturate(150%);
}
[data-theme='dark']  { --glass-bg: var(--glass-bg-dark); --glass-border: var(--glass-border-dark); --glass-shadow: var(--glass-shadow-dark); }
[data-theme='light'] { --glass-bg: var(--glass-bg-light); --glass-border: var(--glass-border-light); --glass-shadow: var(--glass-shadow-light); }
```

| Level | Variable | Usage |
|-------|----------|-------|
| Heavy (28px) | `--glass-blur-heavy` | Player, Login Card, Modals |
| Standard (18px) | `--glass-blur` | Headers, Cards, Drawers, Dropdowns |
| Light (10px) | `--glass-blur-light` | Tables, Tags, Inputs, Buttons |

## 3. Typography Rules

### 3.1 Font Stacks

```css
--font-display: 'Noto Serif SC', Georgia, 'Times New Roman', serif;
--font-body:    'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### 3.2 Type Scale

| Token | Size | Weight | LineH | LS | Usage |
|-------|------|--------|-------|-----|-------|
| `--text-display-hero` | `48px` | `800` | `1.1` | `-0.03em` | Hero title |
| `--text-display-xl` | `36px` | `700` | `1.15` | `-0.025em` | Detail hero |
| `--text-display-lg` | `28px` | `700` | `1.2` | `-0.02em` | Section header |
| `--text-display-md` | `22px` | `700` | `1.3` | `-0.02em` | Player expanded |
| `--text-heading-xl` | `20px` | `600` | `1.4` | `-0.015em` | Card title |
| `--text-heading-lg` | `18px` | `600` | `1.5` | `-0.015em` | Modal / Active lyric |
| `--text-heading-md` | `16px` | `600` | `1.5` | `-0.01em` | List header |
| `--text-body-lg` | `16px` | `400` | `1.6` | `0` | Long-form text |
| `--text-body-md` | `14px` | `400` | `1.6` | `0` | Default body |
| `--text-body-sm` | `13px` | `400` | `1.55` | `0` | Secondary info |
| `--text-caption` | `12px` | `400` | `1.5` | `0` | Caption / Time |
| `--text-nano` | `10px` | `500` | `1.4` | `0.03em` | Badge / Overline |

```css
.text-gradient { background: var(--gradient-text); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
```


## 4. Component Stylings

### 4.1 Buttons

```css
.ant-btn-primary {
  background: var(--gradient-primary); border: none; border-radius: 8px;
  box-shadow: 0 4px 16px rgba(102,126,234,0.4); padding: 8px 24px; height: 40px; font-weight: 500;
}
.ant-btn-primary:hover { background: var(--gradient-primary-hover); box-shadow: 0 6px 24px rgba(102,126,234,0.55); transform: translateY(-1px); }
.ant-btn-primary:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(102,126,234,0.4); }
[data-theme='light'] .ant-btn-default { background: rgba(255,255,255,0.7); border: 1px solid rgba(102,126,234,0.3); border-radius: 8px; }
[data-theme='dark'] .ant-btn-default { background: rgba(20,18,50,0.6); border: 1px solid rgba(102,126,234,0.35); color: rgba(255,255,255,0.85); border-radius: 8px; }
```

### 4.2 Cards

```css
.album-card, .artist-card, .tag-card, .track-card, .game-card {
  border-radius: 16px; backdrop-filter: var(--glass-blur); overflow: hidden;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
[data-theme='light'] .album-card { background: rgba(255,255,255,0.65); border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 4px 24px rgba(102,126,234,0.12), 0 1px 0 rgba(255,255,255,0.9); }
[data-theme='light'] .album-card:hover { background: rgba(255,255,255,0.85); transform: translateY(-4px) scale(1.015); box-shadow: 0 16px 48px rgba(102,126,234,0.25), 0 4px 16px rgba(240,147,251,0.15); }
[data-theme='dark'] .album-card { background: rgba(20,18,50,0.6); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04); }
[data-theme='dark'] .album-card:hover { background: rgba(30,25,70,0.75); box-shadow: 0 16px 48px rgba(102,126,234,0.3), 0 4px 16px rgba(0,0,0,0.5); }
/* Aurora border glow (pseudo-element, hover-revealed) */
.album-card::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px; background: linear-gradient(135deg, rgba(102,126,234,0.5), rgba(240,147,251,0.3), rgba(79,172,254,0.4), rgba(102,126,234,0.3)); mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude; opacity: 0; transition: opacity 0.35s ease; pointer-events: none; }
.album-card:hover::before { opacity: 1; }
```

### 4.3 Inputs

```css
[data-theme='light'] .ant-input { background: rgba(255,255,255,0.7); border: 1px solid rgba(102,126,234,0.25); border-radius: 8px; height: 40px; }
[data-theme='light'] .ant-input:focus { background: rgba(255,255,255,0.9); border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.18); }
[data-theme='dark'] .ant-input { background: rgba(15,12,41,0.6); border: 1px solid rgba(102,126,234,0.3); color: rgba(255,255,255,0.85); border-radius: 8px; height: 40px; }
[data-theme='dark'] .ant-input:focus { background: rgba(20,16,55,0.8); border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.25); }
```

### 4.4 Player

```css
.player-container { position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000; backdrop-filter: var(--glass-blur-heavy); }
.player-container::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--gradient-header); background-size: 300% 100%; animation: gradientSlide 4s ease-in-out infinite; }
[data-theme='light'] .player-container { background: rgba(255,255,255,0.75); box-shadow: 0 -4px 32px rgba(102,126,234,0.15), 0 -1px 0 rgba(255,255,255,0.8); }
[data-theme='dark'] .player-container { background: rgba(10,8,30,0.8); box-shadow: 0 -4px 32px rgba(0,0,0,0.5), 0 -1px 0 rgba(255,255,255,0.05); }
.player-cover { box-shadow: 0 0 0 2px rgba(102,126,234,0.4), 0 4px 20px rgba(102,126,234,0.3), 0 0 40px rgba(240,147,251,0.15); }
```

### 4.5 Album Cover, Navigation, Modals

```css
.album-cover-wrapper img { border-radius: 8px; object-fit: cover; transition: transform 0.35s ease; }
.album-card:hover .album-cover-wrapper img { transform: scale(1.06); }

/* Header — Glass */
[data-theme='light'] .home-header { background: rgba(255,255,255,0.72); backdrop-filter: var(--glass-blur); border-bottom: 1px solid var(--glass-border); box-shadow: 0 4px 24px rgba(102,126,234,0.12), 0 1px 0 rgba(255,255,255,0.6); }
[data-theme='dark'] .home-header { background: rgba(15,12,41,0.72); backdrop-filter: var(--glass-blur); border-bottom: 1px solid var(--glass-border); box-shadow: 0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06); }
.ant-tabs-ink-bar { background: var(--gradient-primary); height: 3px; border-radius: 2px; }

/* Badges */
.ant-tag { border-radius: 20px; backdrop-filter: var(--glass-blur-light); }
.badge-verified { background: rgba(79,172,254,0.15); color: #4facfe; }
.badge-new { background: rgba(67,233,123,0.15); color: #43e97b; }
.badge-hot { background: rgba(250,112,154,0.15); color: #fa709a; }

/* Modals */
[data-theme='light'] .ant-modal-content { background: rgba(255,255,255,0.82); border: 1px solid rgba(255,255,255,0.9); border-radius: 20px; backdrop-filter: var(--glass-blur); box-shadow: 0 24px 80px rgba(102,126,234,0.2), 0 8px 24px rgba(0,0,0,0.1); }
[data-theme='dark'] .ant-modal-content { background: rgba(15,12,41,0.88); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; backdrop-filter: var(--glass-blur); box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 8px 24px rgba(102,126,234,0.1); }
```


## 5. Layout Principles

### 5.1 Spacing Scale (8px Base)

```css
:root { --space-0:0; --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px; --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px; --space-20:80px; }
```

### 5.2 Grid & Container

```css
.grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-6); }
.detail-layout { display: grid; grid-template-columns: 280px 1fr; gap: var(--space-8); }
```

| Context | Max-Width | Padding |
|---------|-----------|---------|
| Content Area | `1400px` | `24px` |
| Detail Hero | `1200px` | `32px` |
| Modal | `520px` | `24px` |
| Auth Card | `420px` | `32px` |

### 5.3 Radius Scale

```css
--radius-sm:6px; --radius-md:8px; --radius-lg:12px; --radius-xl:16px; --radius-2xl:20px; --radius-3xl:24px;
```


## 6. Depth & Elevation

### 6.1 Shadow System

```css
:root {
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);   --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);    --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --shadow-xl: 0 12px 40px rgba(0,0,0,0.16);  --shadow-2xl: 0 24px 80px rgba(0,0,0,0.2);
  --shadow-aurora-sm: 0 4px 16px rgba(102,126,234,0.15);
  --shadow-aurora-md: 0 8px 32px rgba(102,126,234,0.18), 0 2px 8px rgba(0,0,0,0.08);
  --shadow-aurora-lg: 0 16px 48px rgba(102,126,234,0.25), 0 4px 16px rgba(240,147,251,0.15);
}
```
> `--shadow-sm/md/lg` are overridden per `[data-theme]` in `theme.css` with heavier opacity for dark mode.

### 6.2 Z-Index & Backdrop

```css
--z-base:0; --z-dropdown:1000; --z-sticky:1020; --z-fixed:1030; --z-modal-bg:1040; --z-modal:1050; --z-popover:1060; --z-tooltip:1070;
```

| Context | Blur | bg (Light) | bg (Dark) |
|---------|------|------------|-----------|
| Player | `28px/200%` | `rgba(255,255,255,0.75)` | `rgba(10,8,30,0.8)` |
| Header | `18px/180%` | `rgba(255,255,255,0.72)` | `rgba(15,12,41,0.72)` |
| Card | `18px/180%` | `rgba(255,255,255,0.65)` | `rgba(20,18,50,0.6)` |
| Modal/Drawer | `18px/180%` | `rgba(255,255,255,0.82)` | `rgba(15,12,41,0.88)` |
| Dropdown | `18px/180%` | `rgba(255,255,255,0.88)` | `rgba(15,12,41,0.92)` |
| Input/Button/Table | `10px/150%` | `rgba(255,255,255,0.7)` | `rgba(15,12,41,0.6)` |


## 7. Responsive Behavior

### 7.1 Breakpoints (Unified)

```css
--bp-xs:480px; --bp-sm:768px; --bp-md:1024px; --bp-lg:1400px;
```

| Breakpoint | Card Grid | Padding | Player | Sidebar |
|------------|-----------|---------|--------|---------|
| `<= 480px` | 1 col | `12px` | Compact 72px | Hidden |
| `481-768px` | 2 cols | `16px` | Compact 72px | Hidden |
| `769-1024px` | 3 cols | `20px` | Standard 88px | Collapsed |
| `1025-1400px` | 4 cols | `24px` | Standard 88px | Expanded |
| `>= 1400px` | 5 cols | `24px` | Standard 88px | Expanded |

### 7.2 Mobile Adaptations

```css
@media (max-width: 768px) {
  :root { --glass-blur: blur(12px) saturate(160%); --glass-blur-heavy: blur(20px) saturate(180%); }
  .ant-modal:not(.ant-modal-compact) { max-width: 100vw; margin: 0; top: 0; height: 100vh; }
  .ant-modal:not(.ant-modal-compact) .ant-modal-content { height: 100vh; border-radius: 0; }
}
```

### 7.3 Touch Targets

| Element | Min | Element | Min |
|---------|-----|---------|-----|
| Button | `44px` height | Tab bar item | `48px` |
| Input/Select | `40px` min-height (mobile) | Player control | `38px` |

### 7.4 Font Scaling (`<= 768px`)

| Desktop | Mobile | Desktop | Mobile |
|---------|--------|---------|--------|
| `display-hero 48px` | `28px` | `display-xl 36px` | `24px` |
| `display-lg 28px` | `22px` | `body-lg 16px` | `15px` |
| `body-md 14px` | `13px` | — | — |


## 8. Do's and Don'ts

| Do | Don't |
|----|-------|
| `--aurora-*` for gradient sources | Hardcode `#667eea` / `#764ba2` |
| `.glass` utilities (`light/standard/heavy`) | Raw `backdrop-filter: blur()` inline |
| `--text-primary` → `--text-disabled` chain | Hardcode text rgba/hex |
| `[data-theme='light']` / `[data-theme='dark']` scoping | `:root` only for theme-dependent colors |
| `--gradient-primary` for brand CTAs | Multiple gradient CSS on one element |
| `--space-*` tokens for all spacing | `5px`, `7px`, `11px` ad-hoc values |
| `--bp-xs/sm/md/lg` for media queries | `560px`, `900px`, `1200px` etc. |
| `prefers-reduced-motion: reduce` on animations | Unconditional animations |
| `--z-*` for stacking context | Arbitrary z-index (`999`, `2000`) |
| `--shadow-aurora-*` for card/panel | Mix aurora + standard on same element |
| `overflow: hidden` on gradient-border cards | Pseudo-element border bleed |
| `--font-display` for headings/hero | Display font on body/UI |


## 9. Agent Prompt Guide

### New Component
```
Create [Component] per DESIGN.md:
- .glass utility bg, --gradient-primary for CTAs
- --text-primary/secondary/tertiary hierarchy
- [data-theme='light'] + [data-theme='dark'] scoping
- hover: translateY(-2px) + box-shadow transition
- @media (prefers-reduced-motion: reduce) guard
- --bp-xs/sm/md/lg responsive, --space-* spacing
```

### Theme Adaptation
```
Adapt [component] Light/Dark:
1. hardcoded colors → --text-*/--bg-*/--border-* variables
2. [data-theme='light'] block for light values
3. [data-theme='dark'] block for dark values
4. add transition: bg-color 0.3s ease, color 0.3s ease
5. hardcoded shadows → --shadow-*/--shadow-aurora-* tokens
```

### Responsive Redesign
```
Make [page] responsive:
- <= 768px: 1 col, 12px padding, 40px min interactive
- 769-1024px: 2-3 cols, 20px padding
- 1025px+: full grid, 24px padding
- --space-* only, --bp-* breakpoints only
```

### Color Audit
```
Audit [file] vs DESIGN.md:
1. Find hardcoded hex/rgba → nearest --aurora-*/--text-*/--bg-*/--border-* token
2. Flag --aurora-* in text/border context
3. Flag --glass-* outside glass surface context
```
