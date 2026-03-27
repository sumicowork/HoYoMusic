// Placeholder image utilities
// 使用 data URL 避免额外的 HTTP 请求和无限循环

// 简洁的占位符 SVG - 确保正确显示
export const MUSIC_ICON_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23f5f5f5"/%3E%3Cg transform="translate(100,100)"%3E%3Ccircle cx="0" cy="0" r="40" fill="%23ddd" stroke="%23999" stroke-width="2"/%3E%3Cpath d="M-10,10 L-10,-20 L15,-23 L15,7" fill="none" stroke="%23666" stroke-width="3" stroke-linecap="round"/%3E%3Ccircle cx="-10" cy="10" r="6" fill="%23666"/%3E%3Ccircle cx="15" cy="7" r="6" fill="%23666"/%3E%3C/g%3E%3Ctext x="100" y="170" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="%23999"%3ENo Cover%3C/text%3E%3C/svg%3E';

// 优先用环境变量，否则用当前页面 origin（适配任意 IP/域名部署，无需修改 .env）
const defaultApiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin;

// 获取封面 URL，如果没有则返回占位符
// OSS 模式下封面 URL 为完整 http(s) 地址，需要通过服务器代理中转（与 FLAC 流式传输保持一致）
// thumb: true → 返回缩略图 URL (1000x1000 webp)
export const getCoverUrl = (coverPath: string | null, apiBaseUrl?: string, thumb?: boolean): string => {
  if (!coverPath) return MUSIC_ICON_PLACEHOLDER;
  const base = apiBaseUrl || defaultApiBase;
  const sizeParam = thumb ? '&size=thumb' : '';
  // OSS / 外部存储：cover_path 是完整 http(s) URL，通过服务器代理中转，避免前端直连 OSS
  if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) {
    return `${base}/api/public/covers/proxy?path=${encodeURIComponent(coverPath)}${sizeParam}`;
  }
  // 前端 public 目录下的静态资源（如游戏封面 /games/xxx.png），直接使用相对路径
  if (coverPath.startsWith('/') && !coverPath.startsWith('/uploads/')) {
    return coverPath;
  }
  // 后端本地上传文件: /uploads/... (new) or covers/... (legacy)
  const normalized = coverPath.startsWith('/') ? coverPath : `/uploads/${coverPath}`;
  if (thumb) {
    return `${base}/api/public/covers/proxy?path=${encodeURIComponent(normalized)}${sizeParam}`;
  }
  return `${base}${normalized}`;
};

// 处理图片加载错误，防止无限循环
export const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const img = e.currentTarget;
  // 只在第一次失败时设置占位符
  if (img.src !== MUSIC_ICON_PLACEHOLDER) {
    img.src = MUSIC_ICON_PLACEHOLDER;
  }
};

