import { useAuthStore } from '../store/authStore';
import { IS_STATIC } from '../services/api';

export const canUseDebugUserFeatures = (opts: { isAuthenticated: boolean }): boolean => {
  if (IS_STATIC) return false;
  return opts.isAuthenticated;
};

export const useDebugUserFeatures = (): boolean => {
  const { isAuthenticated } = useAuthStore();

  return canUseDebugUserFeatures({ isAuthenticated });
};

