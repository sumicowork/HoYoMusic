import { ThemeConfig } from 'antd';

// 深色主题配置
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorBgBase: '#141414',
    colorBgContainer: '#1f1f1f',
    colorBgElevated: '#262626',
    colorBorder: '#434343',
    colorBorderSecondary: '#303030',
    colorText: 'rgba(255, 255, 255, 0.85)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
    colorTextQuaternary: 'rgba(255, 255, 255, 0.25)',
    colorFill: 'rgba(255, 255, 255, 0.18)',
    colorFillSecondary: 'rgba(255, 255, 255, 0.12)',
    colorFillTertiary: 'rgba(255, 255, 255, 0.08)',
    colorFillQuaternary: 'rgba(255, 255, 255, 0.04)',
    colorBgLayout: '#141414',
    colorBgSpotlight: '#424242',
    colorSplit: 'rgba(255, 255, 255, 0.12)',
  },
  algorithm: undefined, // 不使用内置算法，使用自定义token
};

// 浅色主题配置
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',
    colorText: 'rgba(0, 0, 0, 0.88)',
    colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
    colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
    colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',
    colorFill: 'rgba(0, 0, 0, 0.15)',
    colorFillSecondary: 'rgba(0, 0, 0, 0.06)',
    colorFillTertiary: 'rgba(0, 0, 0, 0.04)',
    colorFillQuaternary: 'rgba(0, 0, 0, 0.02)',
    colorBgLayout: '#f5f5f5',
    colorBgSpotlight: '#f0f0f0',
    colorSplit: 'rgba(5, 5, 5, 0.06)',
  },
  algorithm: undefined,
};

export type ThemeMode = 'light' | 'dark';

// 主题对应的CSS类名
export const themeClassNames = {
  light: 'theme-light',
  dark: 'theme-dark',
};

// 主题对应的背景色
export const themeBackgrounds = {
  light: '#f5f5f5',
  dark: '#141414',
};

