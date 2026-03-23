import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Spin } from 'antd';
import { useAuthModalStore } from '../store/authModalStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isInitialized, user } = useAuthStore();
  const { openLogin } = useAuthModalStore();
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized || isAuthenticated) {
      return;
    }
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    openLogin(redirectTo);
  }, [isInitialized, isAuthenticated, location.pathname, location.search, location.hash, openLogin]);

  // Wait for auth initialization to complete
  if (!isInitialized) {
    return <Spin fullscreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

