import { useAuthStore } from '../store/authStore';

export const canUseDebugUserFeatures = (opts: { isAuthenticated: boolean }): boolean => {
  return opts.isAuthenticated;
};

export const useDebugUserFeatures = (): boolean => {
  const { isAuthenticated } = useAuthStore();

  return canUseDebugUserFeatures({ isAuthenticated });
};

