import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { ConfigProvider, Spin, theme as antdTheme } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import PlayerBar from '@/components/player/PlayerBar';
import { ScrollArea } from '@/components/ui';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useMediaSession } from '@/hooks/useMediaSession';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useTray } from '@/hooks/useTray';

/**
 * Theme tokens + slim-scrollbar / skeleton shimmer styles. `global.css` is not
 * imported by the entry, so we inject the tokens here (this layout is the app
 * root) to keep the shared UI components (Card, CoverArt, Skeleton, ScrollArea)
 * styled correctly.
 */
const shellCss = `
:root {
  --background-base: #f4f4f7;
  --background-base-alt: #ffffff;
  --surface: #ffffff;
  --surface-hover: #ececf2;
  --accent: #7f77dd;
  --accent-secondary: #37c6d9;
  --text-primary: #1a1a22;
  --text-secondary: #6b6b78;
  --border: rgba(0, 0, 0, 0.08);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  color-scheme: light;
}
.hym-shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 56px 1fr 88px;
  grid-template-areas:
    'sidebar topbar'
    'sidebar main'
    'sidebar player';
  height: 100vh;
  background: var(--background-base);
}
.hym-sidebar { grid-area: sidebar; min-height: 0; }
.hym-topbar { grid-area: topbar; min-height: 0; }
.hym-main { grid-area: main; min-height: 0; overflow: hidden; }
.hym-main-scroll { height: 100%; }
.hym-player { grid-area: player; min-height: 0; }

.hym-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.hym-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.hym-scroll::-webkit-scrollbar-track { background: transparent; }
.hym-scroll::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.hym-scroll:hover::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.18); }

.hym-skeleton { position: relative; overflow: hidden; }
.hym-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.05) 50%, transparent 100%);
  animation: hym-shimmer 1.4s ease-in-out infinite;
}
@keyframes hym-shimmer { 100% { transform: translateX(100%); } }
`;

function routeTitle(pathname: string): string {
  if (pathname.startsWith('/library')) return '乐库';
  if (pathname.startsWith('/search')) return '搜索';
  if (pathname.startsWith('/album')) return '专辑';
  if (pathname.startsWith('/artist')) return '艺术家';
  if (pathname.startsWith('/playlist')) return '歌单';
  return '首页';
}

export default function AppShell() {
  // Mount the integration hooks once at the app root so audio playback,
  // the OS media session, global/hardware shortcuts and the system tray all
  // actually work. Each hook is the single owner of its bridge and degrades
  // to a safe no-op when running in a plain browser (no window.__TAURI__).
  useAudioPlayer();
  useMediaSession();
  useGlobalShortcuts();
  useTray();

  const { pathname } = useLocation();
  const title = routeTitle(pathname);

  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#7F77DD',
          colorBgBase: '#f4f4f7',
          colorTextBase: '#1a1a22',
          borderRadius: 10,
        },
      }}
    >
      <style>{shellCss}</style>
      <div className="hym-shell">
        <aside className="hym-sidebar border-r border-[var(--border)] bg-[var(--background-base-alt)]">
          <Sidebar />
        </aside>
        <header className="hym-topbar border-b border-[var(--border)] bg-[var(--background-base-alt)]">
          <TopBar title={title} />
        </header>
        <main className="hym-main">
          <ScrollArea className="hym-main-scroll" orientation="vertical">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spin />
                </div>
              }
            >
              <div className="px-6 py-6">
                <Outlet />
              </div>
            </Suspense>
          </ScrollArea>
        </main>
        <footer className="hym-player border-t border-[var(--border)] bg-[var(--background-base-alt)]">
          <PlayerBar />
        </footer>
      </div>
    </ConfigProvider>
  );
}

export type { ReactNode };
