import React, { useEffect, Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, App as AntApp, message, notification, Skeleton } from 'antd';
import zhCN from 'antd/locale/zh_CN';

// Eager load essential components
import ProtectedRoute from './components/ProtectedRoute';
import DebugUserFeatureGate from './components/DebugUserFeatureGate';
import Player from './components/Player';
import PageHeader from './components/PageHeader';
import MobileTabBar from './components/MobileTabBar';
import FeedbackModal from './components/FeedbackModal';
import FirstVisitModal from './components/FirstVisitModal';
import SiteComplianceFooter from './components/SiteComplianceFooter';
import TestDebugParamSync from './components/TestDebugParamSync';
import { usePlayerStore } from './store/playerStore';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { IS_STATIC } from './services/api';
import { siteConfigService, DEFAULT_MAINTENANCE_MODE_CONFIG, type MaintenanceModeConfig } from './services/siteConfigService';
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
const GameManagement = lazy(() => import('./pages/GameManagement'));
const ArtistManagement = lazy(() => import('./pages/ArtistManagement'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Search = lazy(() => import('./pages/Search'));
const Playlists = lazy(() => import('./pages/Playlists'));
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const Maintenance = lazy(() => import('./pages/Maintenance'));

// 绑定静态实例，使 toast 工具在组件树外也能调用
message.config({ maxCount: 5, top: 64 });
notification.config({ placement: 'topRight', top: 64 });

const PageFallback = () => (
  <div style={{ padding: '40px 24px' }}>
    <Skeleton active paragraph={{ rows: 8 }} />
  </div>
);

interface AppRoutesProps {
  feedbackOpen: boolean;
  onOpenFeedback: () => void;
  onCloseFeedback: () => void;
}

const AppRoutes: React.FC<AppRoutesProps> = ({ feedbackOpen, onOpenFeedback, onCloseFeedback }) => {
  const location = useLocation();
  const { currentTrack } = usePlayerStore();
  const { isAuthenticated, isInitialized } = useAuthStore();
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceModeConfig>(DEFAULT_MAINTENANCE_MODE_CONFIG);
  const [maintenanceLoaded, setMaintenanceLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const loadMaintenanceConfig = async () => {
      try {
        const config = await siteConfigService.getPublicMaintenanceMode();
        if (active) {
          setMaintenanceConfig(config);
        }
      } catch (error) {
        console.error('Failed to load maintenance config:', error);
      } finally {
        if (active) {
          setMaintenanceLoaded(true);
        }
      }
    };

    loadMaintenanceConfig();
    const timer = window.setInterval(loadMaintenanceConfig, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const canBypassMaintenance = !IS_STATIC && isInitialized && isAuthenticated;
  const canEvaluateMaintenance = maintenanceLoaded && (IS_STATIC || isInitialized);
  const maintenanceEntryToLogin = location.pathname === '/admin/login'
    && new URLSearchParams(location.search).get('maintenance_entry') === '1';
  const forceMaintenancePage = canEvaluateMaintenance
    && maintenanceConfig.enabled
    && !canBypassMaintenance
    && !maintenanceEntryToLogin;

  if (forceMaintenancePage) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/maintenance" element={<Maintenance config={maintenanceConfig} />} />
          <Route path="*" element={<Navigate to="/maintenance" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className={`app${currentTrack ? ' has-player' : ''}`}>
      <PageHeader onFeedbackClick={onOpenFeedback} />
      <MobileTabBar onFeedbackClick={onOpenFeedback} />
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

          {/* 播放列表和收藏 - 需要登录 */}
          {!IS_STATIC && (
            <>
              <Route
                path="/playlists"
                element={<ProtectedRoute><DebugUserFeatureGate><Playlists /></DebugUserFeatureGate></ProtectedRoute>}
              />
              <Route
                path="/playlists/:id"
                element={<ProtectedRoute><DebugUserFeatureGate><PlaylistDetail /></DebugUserFeatureGate></ProtectedRoute>}
              />
              <Route
                path="/favorites"
                element={<ProtectedRoute><DebugUserFeatureGate><Favorites /></DebugUserFeatureGate></ProtectedRoute>}
              />
              <Route
                path="/me"
                element={<ProtectedRoute><DebugUserFeatureGate><Profile /></DebugUserFeatureGate></ProtectedRoute>}
              />
            </>
          )}

          {/* 管理后台路由 - 需要登录（静态模式下不渲染） */}
          {!IS_STATIC && (
            <>
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
              <Route
                path="/admin/games"
                element={
                  <ProtectedRoute>
                    <GameManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/artists"
                element={
                  <ProtectedRoute>
                    <ArtistManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </>
          )}

          <Route
            path="/maintenance"
            element={
              maintenanceConfig.enabled && !canBypassMaintenance
                ? <Maintenance config={maintenanceConfig} />
                : <Navigate to={canBypassMaintenance ? '/admin' : '/'} replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <FirstVisitModal />
      <FeedbackModal open={feedbackOpen} onClose={onCloseFeedback} />
      <SiteComplianceFooter />
      {currentTrack && <Player />}
    </div>
  );
};

const App: React.FC = () => {
  const { mode } = useThemeStore();
  const { initializeAuth } = useAuthStore();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Initialize authentication and theme on app startup
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  useEffect(() => {
    if (!IS_STATIC) initializeAuth();
  }, [initializeAuth]);

  return (
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme} locale={zhCN}>
      <AntApp>
        <Router>
          <TestDebugParamSync />
          <AppRoutes
            feedbackOpen={feedbackOpen}
            onOpenFeedback={() => setFeedbackOpen(true)}
            onCloseFeedback={() => setFeedbackOpen(false)}
          />
        </Router>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;

