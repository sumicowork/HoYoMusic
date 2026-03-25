import React, { useEffect, Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, message, notification, Skeleton } from 'antd';
import zhCN from 'antd/locale/zh_CN';

// Eager load essential components
import ProtectedRoute from './components/ProtectedRoute';
import Player from './components/Player';
import PageHeader from './components/PageHeader';
import MobileTabBar from './components/MobileTabBar';
import AuthModal from './components/AuthModal';
import FeedbackModal from './components/FeedbackModal';
import FirstVisitModal from './components/FirstVisitModal';
import SiteComplianceFooter from './components/SiteComplianceFooter';
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
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
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
  const navigate = useNavigate();
  const { currentTrack } = usePlayerStore();
  const { isAuthenticated, isInitialized, user } = useAuthStore();
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
      } catch (error: any) {
        // Fallback: if API already reports maintenance, still force maintenance UI.
        if (active && error?.response?.status === 503 && error?.response?.data?.error?.code === 'MAINTENANCE_MODE') {
          setMaintenanceConfig((prev) => ({
            ...prev,
            enabled: true,
            expected_end_time: error?.response?.data?.data?.expected_end_time ?? null,
            version: error?.response?.data?.data?.version ?? prev.version,
          }));
        } else {
          console.error('Failed to load maintenance config:', error);
        }
      } finally {
        if (active) {
          setMaintenanceLoaded(true);
        }
      }
    };

    const refreshMaintenanceOnActive = () => {
      if (document.hidden) {
        return;
      }
      void loadMaintenanceConfig();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadMaintenanceConfig();
      }
    };

    loadMaintenanceConfig();
    window.addEventListener('focus', refreshMaintenanceOnActive);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener('focus', refreshMaintenanceOnActive);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    if (!params.has('test_debug')) {
      return;
    }

    params.delete('test_debug');
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
        hash: location.hash,
      },
      { replace: true }
    );
  }, [location.pathname, location.search, location.hash, navigate]);

  const canBypassMaintenance = !IS_STATIC && isInitialized && isAuthenticated && !!user?.is_admin;
  const canEvaluateMaintenance = maintenanceLoaded && (IS_STATIC || isInitialized);
  const forceMaintenancePage = canEvaluateMaintenance
    && maintenanceConfig.enabled
    && !canBypassMaintenance
    && location.pathname !== '/admin';

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

          {/* 用户中心相关路由 - 需要登录 */}
          {!IS_STATIC && (
            <>
              <Route
                path="/playlists/:id"
                element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>}
              />
              <Route
                path="/me"
                element={<ProtectedRoute><Profile /></ProtectedRoute>}
              />
            </>
          )}

          {/* 管理后台路由 - 需要登录（静态模式下不渲染） */}
          {!IS_STATIC && (
            <>
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/albums"
                element={
                  <ProtectedRoute requireAdmin>
                    <AlbumManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tags"
                element={
                  <ProtectedRoute requireAdmin>
                    <TagManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/games"
                element={
                  <ProtectedRoute requireAdmin>
                    <GameManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/artists"
                element={
                  <ProtectedRoute requireAdmin>
                    <ArtistManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requireAdmin>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute requireAdmin>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute requireAdmin>
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
      <AuthModal />
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

