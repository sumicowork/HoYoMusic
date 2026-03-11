import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HoYoMusic API',
      version: '3.5.0',
      description: 'HoYoverse 游戏音乐管理平台 RESTful API',
      contact: {
        name: 'HoYoMusic',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Track: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            album_id: { type: 'integer' },
            album_title: { type: 'string' },
            duration: { type: 'number' },
            file_size: { type: 'integer' },
            sample_rate: { type: 'integer' },
            bit_depth: { type: 'integer' },
            cover_path: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Album: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            game_id: { type: 'integer', nullable: true },
            cover_path: { type: 'string', nullable: true },
            release_date: { type: 'string', format: 'date', nullable: true },
            track_count: { type: 'integer' },
          },
        },
        Game: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            cover_path: { type: 'string', nullable: true },
            display_order: { type: 'integer' },
            status: { type: 'string', enum: ['active', 'inactive'] },
          },
        },
        Playlist: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            is_public: { type: 'boolean' },
            track_count: { type: 'integer' },
            total_duration: { type: 'integer' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: '认证相关接口' },
      { name: 'Tracks', description: '曲目管理' },
      { name: 'Albums', description: '专辑管理' },
      { name: 'Games', description: '游戏管理' },
      { name: 'Tags', description: '标签管理' },
      { name: 'Credits', description: '制作人员信息' },
      { name: 'Lyrics', description: '歌词管理' },
      { name: 'Artists', description: '艺术家查询' },
      { name: 'Playlists', description: '播放列表' },
      { name: 'Favorites', description: '收藏功能' },
      { name: 'Analytics', description: '访问分析' },
      { name: 'Public', description: '公共接口（无需认证）' },
    ],
  },
  apis: [], // We'll manually define paths below since we don't use JSDoc comments
};

// Add basic path definitions
options.definition!.paths = {
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: '用户登录',
      requestBody: {
        content: { 'application/json': { schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } }, required: ['username', 'password'] } } },
      },
      responses: { '200': { description: '登录成功，返回 JWT Token' }, '401': { description: '凭证无效' } },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'], summary: '获取当前用户信息', security: [{ bearerAuth: [] }],
      responses: { '200': { description: '当前用户' } },
    },
  },
  '/auth/change-password': {
    post: {
      tags: ['Auth'], summary: '修改密码', security: [{ bearerAuth: [] }],
      requestBody: {
        content: { 'application/json': { schema: { type: 'object', properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } }, required: ['currentPassword', 'newPassword'] } } },
      },
      responses: { '200': { description: '修改成功' }, '401': { description: '原密码错误' } },
    },
  },
  '/games': {
    get: { tags: ['Games'], summary: '获取所有游戏', responses: { '200': { description: '游戏列表' } } },
    post: { tags: ['Games'], summary: '创建游戏', security: [{ bearerAuth: [] }], responses: { '201': { description: '创建成功' } } },
  },
  '/albums': {
    get: { tags: ['Albums'], summary: '获取所有专辑', parameters: [{ in: 'query', name: 'game_id', schema: { type: 'integer' } }], responses: { '200': { description: '专辑列表' } } },
  },
  '/albums/{id}': {
    get: { tags: ['Albums'], summary: '获取专辑详情', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: '专辑详情' } } },
  },
  '/tracks': {
    get: { tags: ['Tracks'], summary: '获取曲目列表', security: [{ bearerAuth: [] }], responses: { '200': { description: '曲目列表' } } },
    post: { tags: ['Tracks'], summary: '上传曲目', security: [{ bearerAuth: [] }], responses: { '201': { description: '上传成功' } } },
  },
  '/tags': {
    get: { tags: ['Tags'], summary: '获取所有标签', responses: { '200': { description: '标签列表' } } },
  },
  '/playlists': {
    get: { tags: ['Playlists'], summary: '获取播放列表', security: [{ bearerAuth: [] }], responses: { '200': { description: '播放列表' } } },
    post: { tags: ['Playlists'], summary: '创建播放列表', security: [{ bearerAuth: [] }], responses: { '201': { description: '创建成功' } } },
  },
  '/favorites': {
    get: { tags: ['Favorites'], summary: '获取收藏列表', security: [{ bearerAuth: [] }], responses: { '200': { description: '收藏列表' } } },
  },
  '/favorites/toggle': {
    post: { tags: ['Favorites'], summary: '切换收藏状态', security: [{ bearerAuth: [] }], responses: { '200': { description: '切换成功' } } },
  },
  '/public/tracks': {
    get: { tags: ['Public'], summary: '公开曲目搜索', parameters: [{ in: 'query', name: 'search', schema: { type: 'string' } }], responses: { '200': { description: '搜索结果' } } },
  },
  '/analytics/overview': {
    get: { tags: ['Analytics'], summary: '访问概览', security: [{ bearerAuth: [] }], responses: { '200': { description: '概览数据' } } },
  },
  '/analytics/storage': {
    get: { tags: ['Analytics'], summary: '存储分析', security: [{ bearerAuth: [] }], responses: { '200': { description: '存储数据' } } },
  },
  '/health': {
    get: { tags: ['Public'], summary: '健康检查', responses: { '200': { description: '服务正常' } } },
  },
};

export const swaggerSpec = swaggerJsdoc(options);

