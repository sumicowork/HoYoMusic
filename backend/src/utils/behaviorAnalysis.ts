export interface BehaviorMeta {
  action_key: string;
  action_label: string;
  module: string;
  resource_type: string | null;
  resource_id: number | null;
  summary: string;
}

const TRACK_STREAM_RE = /^\/api\/public\/tracks\/(\d+)\/stream(?:$|\?|\/)/i;
const TRACK_PLAY_REPORT_RE = /^\/api\/public\/tracks\/(\d+)\/play(?:$|\?|\/)/i;
const TRACK_DETAIL_RE = /^\/api\/public\/tracks\/(\d+)(?:$|\?|\/)/i;
const ALBUM_DETAIL_RE = /^\/api\/public\/albums\/(\d+)(?:$|\?|\/)/i;
const GAME_DETAIL_RE = /^\/api\/public\/games\/(\d+)(?:$|\?|\/)/i;

const sanitizePath = (path: string): string => {
  const raw = String(path || '');
  const q = raw.indexOf('?');
  return q >= 0 ? raw.slice(0, q) : raw;
};

const extractId = (path: string, regex: RegExp): number | null => {
  const match = path.match(regex);
  if (!match || !match[1]) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveBehaviorMeta = (method: string, path: string, status?: number): BehaviorMeta => {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const normalizedPath = sanitizePath(path);

  let actionKey = 'api.generic';
  let actionLabel = `${normalizedMethod} 请求`;
  let module = '系统接口';
  let resourceType: string | null = null;
  let resourceId: number | null = null;

  if (normalizedMethod === 'POST' && normalizedPath === '/api/auth/login') {
    actionKey = 'auth.login';
    actionLabel = '登录账号';
    module = '账户';
  } else if (normalizedMethod === 'POST' && normalizedPath === '/api/auth/register') {
    actionKey = 'auth.register';
    actionLabel = '注册账号';
    module = '账户';
  } else if (TRACK_STREAM_RE.test(normalizedPath) && normalizedMethod === 'GET') {
    actionKey = 'track.stream';
    actionLabel = '播放曲目';
    module = '播放';
    resourceType = 'track';
    resourceId = extractId(normalizedPath, TRACK_STREAM_RE);
  } else if (TRACK_PLAY_REPORT_RE.test(normalizedPath) && normalizedMethod === 'POST') {
    actionKey = 'track.play_report';
    actionLabel = '上报播放进度';
    module = '播放';
    resourceType = 'track';
    resourceId = extractId(normalizedPath, TRACK_PLAY_REPORT_RE);
  } else if (TRACK_DETAIL_RE.test(normalizedPath) && normalizedMethod === 'GET') {
    actionKey = 'track.detail';
    actionLabel = '查看曲目详情';
    module = '内容浏览';
    resourceType = 'track';
    resourceId = extractId(normalizedPath, TRACK_DETAIL_RE);
  } else if (ALBUM_DETAIL_RE.test(normalizedPath) && normalizedMethod === 'GET') {
    actionKey = 'album.detail';
    actionLabel = '查看专辑详情';
    module = '内容浏览';
    resourceType = 'album';
    resourceId = extractId(normalizedPath, ALBUM_DETAIL_RE);
  } else if (GAME_DETAIL_RE.test(normalizedPath) && normalizedMethod === 'GET') {
    actionKey = 'game.detail';
    actionLabel = '查看游戏页';
    module = '内容浏览';
    resourceType = 'game';
    resourceId = extractId(normalizedPath, GAME_DETAIL_RE);
  } else if (normalizedMethod === 'POST' && normalizedPath === '/api/tracks/upload') {
    actionKey = 'track.upload';
    actionLabel = '上传曲目';
    module = '后台管理';
  } else if (normalizedPath.startsWith('/api/favorites')) {
    actionKey = 'favorite.manage';
    actionLabel = normalizedMethod === 'GET' ? '查看收藏' : '管理收藏';
    module = '收藏';
  } else if (normalizedPath.startsWith('/api/playlists')) {
    actionKey = 'playlist.manage';
    actionLabel = normalizedMethod === 'GET' ? '查看歌单' : '管理歌单';
    module = '歌单';
  } else if (normalizedPath.startsWith('/api/analytics')) {
    actionKey = 'admin.analytics';
    actionLabel = '查看统计看板';
    module = '后台管理';
  } else if (normalizedPath.startsWith('/api/public/')) {
    actionKey = 'public.browse';
    actionLabel = '浏览公开内容';
    module = '内容浏览';
  } else if (normalizedPath.startsWith('/api/tracks') || normalizedPath.startsWith('/api/albums')) {
    actionKey = 'catalog.manage';
    actionLabel = normalizedMethod === 'GET' ? '查看曲库管理' : '编辑曲库内容';
    module = '后台管理';
  }

  const targetSegment = resourceType && resourceId ? `（${resourceType} #${resourceId}）` : '';
  const failSegment = typeof status === 'number' && status >= 400 ? '（失败）' : '';

  return {
    action_key: actionKey,
    action_label: actionLabel,
    module,
    resource_type: resourceType,
    resource_id: resourceId,
    summary: `${actionLabel}${targetSegment}${failSegment}`,
  };
};

export const withReadableBehavior = <T extends { method: string; path: string; status?: number }>(row: T) => {
  return {
    ...row,
    ...resolveBehaviorMeta(row.method, row.path, row.status),
  };
};

