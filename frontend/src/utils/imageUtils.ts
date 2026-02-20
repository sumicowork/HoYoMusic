// Placeholder image utilities
// 使用 data URL 避免额外的 HTTP 请求和无限循环

// 简洁的占位符 SVG - 确保正确显示
export const MUSIC_ICON_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23f5f5f5"/%3E%3Cg transform="translate(100,100)"%3E%3Ccircle cx="0" cy="0" r="40" fill="%23ddd" stroke="%23999" stroke-width="2"/%3E%3Cpath d="M-10,10 L-10,-20 L15,-23 L15,7" fill="none" stroke="%23666" stroke-width="3" stroke-linecap="round"/%3E%3Ccircle cx="-10" cy="10" r="6" fill="%23666"/%3E%3Ccircle cx="15" cy="7" r="6" fill="%23666"/%3E%3C/g%3E%3Ctext x="100" y="170" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="%23999"%3ENo Cover%3C/text%3E%3C/svg%3E';

// 获取封面 URL，如果没有则返回占位符
export const getCoverUrl = (coverPath: string | null, apiBaseUrl: string = 'http://localhost:3000'): string => {
  if (!coverPath) return MUSIC_ICON_PLACEHOLDER;
  // WebDAV mode: already a full URL
  if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) return coverPath;
  // Local mode: /uploads/... (new) or covers/... (legacy)
  const normalized = coverPath.startsWith('/') ? coverPath : `/uploads/${coverPath}`;
  return `${apiBaseUrl}${normalized}`;
};

// 处理图片加载错误，防止无限循环
export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = e.currentTarget;
  // 只在第一次失败时设置占位符
  if (img.src !== MUSIC_ICON_PLACEHOLDER) {
    img.src = MUSIC_ICON_PLACEHOLDER;
  }
};

