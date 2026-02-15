import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
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
import ProtectedRoute from './components/ProtectedRoute';
import Player from './components/Player';
import { usePlayerStore } from './store/playerStore';
import { useThemeStore } from './store/themeStore';
import { darkTheme, lightTheme } from './theme/themeConfig';
import './theme/theme.css';
import './theme/publicPages.css';
import './App.css';

const App: React.FC = () => {
  const { currentTrack } = usePlayerStore();
  const { mode } = useThemeStore();

  // 初始化主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <Router>
        <div className="app">
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
    </ConfigProvider>
  );
};

export default App;

