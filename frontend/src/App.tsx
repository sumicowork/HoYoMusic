import React, { useEffect, Suspense, lazy, useState, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, message, notification, Skeleton } from 'antd';
import zhCN from 'antd/locale/zh_CN';

// Eager load essential components
import ProtectedRoute from './components/ProtectedRoute';
import Player from './components/Player';
import PageHeader from './components/PageHeader';
import MobileTabBar from './components/MobileTabBar';
import AuthModal from './components/AuthModal';
import ErrorBoundary from './components/ErrorBoundary';
import FeedbackModal from './components/FeedbackModal';
import FirstVisitModal from './components/FirstVisitModal';
import SiteComplianceFooter from './components/SiteComplianceFooter';
import { usePlayerStore } from './store/playerStore';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { useAuthModalStore } from './store/authModalStore';
import { siteConfigService, DEFAULT_MAINTENANCE_MODE_CONFIG, type MaintenanceModeConfig } from './services/siteConfigService';
import { authEvents } from './services/api';
import { ADMIN_NAV_ITEMS } from './config/adminNavigation';
import { darkTheme, lightTheme } from './theme/themeConfig';
import './theme/theme.css';
import './theme/publicPages.css';
import './theme/aurora-glass.css';
import './theme/mobile-all-pages.css';
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
const MusicSourceLibraryManagement = lazy(() => import('./pages/MusicSourceLibraryManagement'));
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
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const user = useAuthStore((state) => state.user);
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceModeConfig>(DEFAULT_MAINTENANCE_MODE_CONFIG);
  const [maintenanceLoaded, setMaintenanceLoaded] = useState(false);
  const maintenanceRequestRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;

    const loadMaintenanceConfig = async () => {
      if (maintenanceRequestRef.current) {
        return maintenanceRequestRef.current;
      }

      const request = (async () => {
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
            message: error?.response?.data?.data?.message ?? prev.message,
            version: error?.response?.data?.data?.version ?? prev.version,
          }));
        } else {
          console.error('Failed to load maintenance config:', error);
        }
      } finally {
        if (active) {
          setMaintenanceLoaded(true);
        }
        maintenanceRequestRef.current = null;
      }
      })();

      maintenanceRequestRef.current = request;
      return request;
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

  const canBypassMaintenance = isInitialized && isAuthenticated && !!user?.is_admin;
  const canEvaluateMaintenance = maintenanceLoaded && isInitialized;
  const forceMaintenancePage = canEvaluateMaintenance
    && maintenanceConfig.enabled
    && !canBypassMaintenance
    && location.pathname !== '/admin';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const adminRouteMap: Record<string, React.ReactNode> = {
    '/admin': <Admin />,
    '/admin/albums': <AlbumManagement />,
    '/admin/tags': <TagManagement />,
    '/admin/games': <GameManagement />,
    '/admin/artists': <ArtistManagement />,
    '/admin/users': <UserManagement />,
    '/admin/analytics': <Analytics />,
    '/admin/settings': <Settings />,
    '/admin/music-sources/library': <MusicSourceLibraryManagement />,
  };

  if (forceMaintenancePage) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <>
            <Routes>
              <Route
                path="/maintenance"
                element={<Maintenance config={maintenanceConfig} onOpenFeedback={onOpenFeedback} />}
              />
              <Route path="*" element={<Navigate to="/maintenance" replace />} />
            </Routes>
            <FeedbackModal open={feedbackOpen} onClose={onCloseFeedback} />
            <AuthModal />
          </>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className={`app${currentTrack ? ' has-player' : ''}${isAdminRoute ? ' admin-app' : ''}`}>
      {!isAdminRoute && <PageHeader onFeedbackClick={onOpenFeedback} />}
      {!isAdminRoute && <MobileTabBar onFeedbackClick={onOpenFeedback} />}
      <ErrorBoundary>
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
          <Route
            path="/playlists/:id"
            element={<ProtectedRoute><PlaylistDetail /></ProtectedRoute>}
          />
          <Route
            path="/me"
            element={<ProtectedRoute><Profile /></ProtectedRoute>}
          />

          {/* 管理后台路由 - 需要登录 */}
          {ADMIN_NAV_ITEMS.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <ProtectedRoute requireAdmin>
                  {adminRouteMap[item.path]}
                </ProtectedRoute>
              }
            />
          ))}

          <Route
            path="/maintenance"
            element={
              maintenanceConfig.enabled && !canBypassMaintenance
                ? <Maintenance config={maintenanceConfig} onOpenFeedback={onOpenFeedback} />
                : <Navigate to={canBypassMaintenance ? '/admin' : '/'} replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      {!isAdminRoute && <FirstVisitModal />}
      {!isAdminRoute && <FeedbackModal open={feedbackOpen} onClose={onCloseFeedback} />}
      {!isAdminRoute && <SiteComplianceFooter />}
      <AuthModal />
      {!isAdminRoute && currentTrack && <Player />}
    </div>
  );
};

const App: React.FC = () => {
  const mode = useThemeStore((state) => state.mode);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const handleOpenFeedback = useCallback(() => setFeedbackOpen(true), []);
  const handleCloseFeedback = useCallback(() => setFeedbackOpen(false), []);

  // Initialize authentication and theme on app startup
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const handleAuthExpired = (e: Event) => {
      const detail = (e as CustomEvent).detail as { redirectTo: string | null };
      useAuthModalStore.getState().openLogin(detail.redirectTo);
    };
    authEvents.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      authEvents.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  return (
    <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme} locale={zhCN}>
      <AntApp>
        <Router>
          <AppRoutes
            feedbackOpen={feedbackOpen}
            onOpenFeedback={handleOpenFeedback}
            onCloseFeedback={handleCloseFeedback}
          />
        </Router>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;

