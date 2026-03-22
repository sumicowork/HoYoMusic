import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { IS_STATIC } from '../services/api';

export const TEST_DEBUG_QUERY_KEY = 'test_debug';

export const isTestDebugEnabled = (search: string): boolean => {
  const params = new URLSearchParams(search || '');
  return params.get(TEST_DEBUG_QUERY_KEY) === '1';
};

export const isAdminUser = (username?: string | null): boolean => username === 'admin';

export const canUseDebugUserFeatures = (opts: {
  search: string;
  isAuthenticated: boolean;
  username?: string | null;
}): boolean => {
  if (IS_STATIC) return false;
  return opts.isAuthenticated;
};

export const useDebugUserFeatures = (): boolean => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  return canUseDebugUserFeatures({
    search: location.search,
    isAuthenticated,
    username: user?.username,
  });
};

