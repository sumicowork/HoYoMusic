export interface AdminNavSection {
  key: string;
  label: string;
}

export interface AdminNavItem {
  path: string;
  label: string;
  sectionKey: string;
}

export const ADMIN_DEFAULT_PATH = '/admin';

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  { key: 'content', label: '内容资产' },
  { key: 'taxonomy', label: '分类与关系' },
  { key: 'operations', label: '运营与分析' },
  { key: 'system', label: '系统与配置' },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { path: '/admin', label: '曲目管理', sectionKey: 'content' },
  { path: '/admin/albums', label: '专辑管理', sectionKey: 'content' },
  { path: '/admin/music-sources/library', label: 'Music Source 库', sectionKey: 'content' },

  { path: '/admin/artists', label: '艺术家管理', sectionKey: 'taxonomy' },
  { path: '/admin/tags', label: '标签管理', sectionKey: 'taxonomy' },
  { path: '/admin/games', label: '游戏管理', sectionKey: 'taxonomy' },

  { path: '/admin/users', label: '用户管理', sectionKey: 'operations' },
  { path: '/admin/analytics', label: '访问统计', sectionKey: 'operations' },

  { path: '/admin/settings', label: '系统设置', sectionKey: 'system' },
];

const pathMatches = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

export const resolveAdminMenuPath = (pathname: string): string => {
  const sortedPaths = [...ADMIN_NAV_ITEMS].sort((a, b) => b.path.length - a.path.length);
  const matched = sortedPaths.find((item) => pathMatches(pathname, item.path));
  return matched?.path || ADMIN_DEFAULT_PATH;
};

