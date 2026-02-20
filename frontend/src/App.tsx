import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, message, notification } from 'antd';
import Login from './pages/Login';
import Home from './pages/Home';
import GameDetail from './pages/GameDetail';
import PublicLibrary from './pages/PublicLibrary';
import TrackDetail from './pages/TrackDetail';
import Albums from './pages/Albums';
import AlbumDetail from './pages/AlbumDetail';
import Artists from './pages/Artists';
import ArtistDetail from './pages/ArtistDetail';
import Tags from './pages/Tags';
import TagDetail from './pages/TagDetail';
import Admin from './pages/Admin';
import AlbumManagement from './pages/AlbumManagement';
import TagManagement from './pages/TagManagement';
import Search from './pages/Search';
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

// 绑定静态实例，使 toast 工具在组件树外也能调用
message.config({ maxCount: 5, top: 64 });
notification.config({ placement: 'topRight', top: 64 });

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
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <AntApp>
        <Router>
          <div className="app">
            <SideNav />
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
            {currentTrack && <Player />}
          </div>
        </Router>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;

