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
const ARTIST_DETAIL_RE = /^\/api\/public\/artists\/(\d+)(?:$|\?|\/)/i;
const TAG_DETAIL_RE = /^\/api\/public\/tags\/(\d+)(?:$|\?|\/)/i;
const PLAYLIST_DETAIL_RE = /^\/api\/playlists\/(\d+)(?:$|\?|\/)/i;
const USER_DETAIL_ADMIN_RE = /^\/api\/users\/(\d+)(?:$|\?|\/)/i;

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
  } else if (normalizedMethod === 'GET' && normalizedPath === '/api/auth/me') {
    actionKey = 'auth.me';
    actionLabel = '读取当前用户';
    module = '账户';
  } else if (normalizedMethod === 'POST' && normalizedPath === '/api/auth/change-password') {
    actionKey = 'auth.change_password';
    actionLabel = '修改密码';
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
  } else if (ARTIST_DETAIL_RE.test(normalizedPath) && normalizedMethod === 'GET') {
    actionKey = 'artist.detail';
    actionLabel = '查看创作者详情';
    module = '内容浏览';
    resourceType = 'artist';
    resourceId = extractId(normalizedPath, ARTIST_DETAIL_RE);
  } else if (TAG_DETAIL_RE.test(normalizedPath) && normalizedMethod === 'GET') {
    actionKey = 'tag.detail';
    actionLabel = '查看标签详情';
    module = '内容浏览';
    resourceType = 'tag';
    resourceId = extractId(normalizedPath, TAG_DETAIL_RE);
  } else if (normalizedMethod === 'POST' && normalizedPath === '/api/tracks/upload') {
    actionKey = 'track.upload';
    actionLabel = '上传曲目';
    module = '后台管理';
  } else if (normalizedPath === '/api/favorites' && normalizedMethod === 'GET') {
    actionKey = 'favorite.list';
    actionLabel = '查看收藏列表';
    module = '收藏';
  } else if (normalizedPath === '/api/favorites/toggle' && normalizedMethod === 'POST') {
    actionKey = 'favorite.toggle';
    actionLabel = '切换收藏状态';
    module = '收藏';
  } else if (normalizedPath === '/api/favorites/check' && normalizedMethod === 'POST') {
    actionKey = 'favorite.check';
    actionLabel = '批量检查收藏';
    module = '收藏';
  } else if (normalizedPath.startsWith('/api/favorites')) {
    actionKey = 'favorite.manage';
    actionLabel = normalizedMethod === 'GET' ? '查看收藏' : '管理收藏';
    module = '收藏';
  } else if (normalizedPath === '/api/playlists' && normalizedMethod === 'GET') {
    actionKey = 'playlist.list';
    actionLabel = '查看我的歌单';
    module = '歌单';
  } else if (normalizedPath === '/api/playlists' && normalizedMethod === 'POST') {
    actionKey = 'playlist.create';
    actionLabel = '创建歌单';
    module = '歌单';
  } else if (PLAYLIST_DETAIL_RE.test(normalizedPath) && normalizedMethod === 'GET') {
    actionKey = 'playlist.detail';
    actionLabel = '查看歌单详情';
    module = '歌单';
    resourceType = 'playlist';
    resourceId = extractId(normalizedPath, PLAYLIST_DETAIL_RE);
  } else if (PLAYLIST_DETAIL_RE.test(normalizedPath) && normalizedMethod === 'PUT') {
    actionKey = 'playlist.update';
    actionLabel = '编辑歌单';
    module = '歌单';
    resourceType = 'playlist';
    resourceId = extractId(normalizedPath, PLAYLIST_DETAIL_RE);
  } else if (PLAYLIST_DETAIL_RE.test(normalizedPath) && normalizedMethod === 'DELETE') {
    actionKey = 'playlist.delete';
    actionLabel = '删除歌单';
    module = '歌单';
    resourceType = 'playlist';
    resourceId = extractId(normalizedPath, PLAYLIST_DETAIL_RE);
  } else if (normalizedPath.startsWith('/api/playlists')) {
    actionKey = 'playlist.manage';
    actionLabel = normalizedMethod === 'GET' ? '查看歌单' : '管理歌单';
    module = '歌单';
  } else if (normalizedPath === '/api/messages/inbox' && normalizedMethod === 'GET') {
    actionKey = 'message.inbox';
    actionLabel = '查看站内信';
    module = '站内信';
  } else if (normalizedPath === '/api/messages/unread-count' && normalizedMethod === 'GET') {
    actionKey = 'message.unread_count';
    actionLabel = '读取站内信未读数';
    module = '站内信';
  } else if (normalizedPath === '/api/messages/read-all' && normalizedMethod === 'POST') {
    actionKey = 'message.read_all';
    actionLabel = '全部站内信标记已读';
    module = '站内信';
  } else if (normalizedPath.startsWith('/api/messages/admin/send') && normalizedMethod === 'POST') {
    actionKey = 'message.admin_send';
    actionLabel = '发送站内信';
    module = '后台管理';
  } else if (normalizedPath.startsWith('/api/messages/admin/sent') && normalizedMethod === 'GET') {
    actionKey = 'message.admin_sent';
    actionLabel = '查看站内信发送记录';
    module = '后台管理';
  } else if (normalizedPath.startsWith('/api/messages/')) {
    actionKey = 'message.manage';
    actionLabel = '处理站内信';
    module = '站内信';
  } else if (normalizedPath.startsWith('/api/analytics')) {
    actionKey = 'admin.analytics';
    actionLabel = '查看统计看板';
    module = '后台管理';
  } else if (normalizedPath === '/api/users' && normalizedMethod === 'GET') {
    actionKey = 'admin.user_list';
    actionLabel = '查看用户列表';
    module = '后台管理';
  } else if (USER_DETAIL_ADMIN_RE.test(normalizedPath) && normalizedMethod === 'GET') {
    actionKey = 'admin.user_detail';
    actionLabel = '查看用户详情';
    module = '后台管理';
    resourceType = 'user';
    resourceId = extractId(normalizedPath, USER_DETAIL_ADMIN_RE);
  } else if (normalizedPath.startsWith('/api/users') && (normalizedMethod === 'PATCH' || normalizedMethod === 'POST')) {
    actionKey = 'admin.user_update';
    actionLabel = '更新用户状态';
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


