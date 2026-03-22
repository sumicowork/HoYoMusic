import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { canUseDebugUserFeatures } from '../utils/debugFeature';

interface DebugUserFeatureGateProps {
  children: React.ReactNode;
}

const DebugUserFeatureGate: React.FC<DebugUserFeatureGateProps> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  const allowed = canUseDebugUserFeatures({
    search: location.search,
    isAuthenticated,
    username: user?.username,
  });

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default DebugUserFeatureGate;

