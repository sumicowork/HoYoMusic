import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, message, notification, Skeleton } from 'antd';
import zhCN from 'antd/locale/zh_CN';

// Eager load essential components
import ProtectedRoute from './components/ProtectedRoute';
import Player from './components/Player';
import SideNav from './components/SideNav';
import { usePlayerStore } from './store/playerStore';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { darkTheme, lightTheme } from './theme/themeConfig';
import './theme/theme.css';
import './theme/publicPages.css';
import './theme/aurora-glass.css';
import './App.css';

// Lazy load all pages for performance
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const GameDetail = lazy(() => import('./pages/GameDetail'));
const PublicLibrary = lazy(() => import('./pages/PublicLibrary'));
const TrackDetail = lazy(() => import('./pages/TrackDetail'));
const Albums = lazy(() => import('./pages/Albums'));
const AlbumDetail = lazy(() => import('./pages/AlbumDetail'));
const Artists = lazy(() => import('./pages/Artists'));
const ArtistDetail = lazy(() => import('./pages/ArtistDetail'));
const Tags = lazy(() => import('./pages/Tags'));
const TagDetail = lazy(() => import('./pages/TagDetail'));
const Admin = lazy(() => import('./pages/Admin'));
const AlbumManagement = lazy(() => import('./pages/AlbumManagement'));
const TagManagement = lazy(() => import('./pages/TagManagement'));
const Search = lazy(() => import('./pages/Search'));

// 绑定静态实例，使 toast 工具在组件树外也能调用
message.config({ maxCount: 5, top: 64 });
notification.config({ placement: 'topRight', top: 64 });

const PageFallback = () => (
  <div style={{ padding: '40px 24px' }}>
    <Skeleton active paragraph={{ rows: 8 }} />
  </div>
);

const App: React.FC = () => {
  const { currentTrack } = usePlayerStore();
  const { mode } = useThemeStore();
  const { initializeAuth } = useAuthStore();

  // Initialize authentication and theme on app startup
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme} locale={zhCN}>
      <AntApp>
        <Router>
          <div className="app">
            <SideNav />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* 公开路由 - 无需登录 */}
                <Route path="/" element={<Home />} />
                <Route path="/games/:id" element={<GameDetail />} />
                <Route path="/library" element={<PublicLibrary />} />
                <Route path="/track/:id" element={<TrackDetail />} />
                <Route path="/albums" element={<Albums />} />
                <Route path="/albums/:id" element={<AlbumDetail />} />
                <Route path="/artists" element={<Artists />} />
                <Route path="/artists/:id" element={<ArtistDetail />} />
                <Route path="/tags" element={<Tags />} />
                <Route path="/tags/:id" element={<TagDetail />} />
                <Route path="/search" element={<Search />} />

                {/* 管理后台路由 - 需要登录 */}
                <Route path="/admin/login" element={<Login />} />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/albums"
                  element={
                    <ProtectedRoute>
                      <AlbumManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/tags"
                  element={
                    <ProtectedRoute>
                      <TagManagement />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            {currentTrack && <Player />}
          </div>
        </Router>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;

