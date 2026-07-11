import { useMemo } from 'react';
import { theme, type ThemeTokens } from './theme';

/**
 * Returns the active theme tokens.
 *
 * The desktop app is dark-only by default. The hook is memoized and consumes the
 * module-level token object, so it is safe to call from any component without
 * causing re-renders.
 */
export function useTheme(): ThemeTokens {
  return useMemo(() => theme, []);
}

export default useTheme;
