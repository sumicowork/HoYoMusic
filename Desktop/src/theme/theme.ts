/**
 * Theme color tokens for the HoYoMusic desktop app.
 * Light, polished music-app aesthetic (Apple Music / QQ Music light inspired).
 *
 * Values mirror the CSS custom properties defined in styles/global.css so that
 * `useTheme()` and raw CSS stay in sync.
 */

export interface ThemeTokens {
  color: {
    /** App base background (deepest layer). */
    backgroundBase: string;
    /** Slightly elevated base used behind the whole window. */
    backgroundBaseAlt: string;
    /** Raised surface (cards, panels). */
    surface: string;
    /** Surface on hover / active. */
    surfaceHover: string;
    /** Brand accent — HoYo-ish purple. */
    accent: string;
    /** Secondary accent — HoYo-ish cyan. */
    accentSecondary: string;
    /** Primary text. */
    textPrimary: string;
    /** Secondary / muted text. */
    textSecondary: string;
    /** Hairline borders. */
    border: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

export const theme: ThemeTokens = {
  color: {
    backgroundBase: '#f4f4f7',
    backgroundBaseAlt: '#ffffff',
    surface: '#ffffff',
    surfaceHover: '#ececf2',
    accent: '#7F77DD',
    accentSecondary: '#37C6D9',
    textPrimary: '#1a1a22',
    textSecondary: '#6b6b78',
    border: 'rgba(0,0,0,0.08)',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
  },
};

export type ThemeMode = 'light';

/** Resolve a token path to its value (e.g. `useThemeValue('color.accent')`). */
export function resolveToken(path: string): string {
  return path
    .split('.')
    .reduce<any>((acc, key) => acc?.[key], theme) as string;
}
