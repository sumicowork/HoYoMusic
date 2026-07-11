import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticateAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  firstVisitModalSchema,
  siteComplianceSchema,
  feedbackSubmitSchema,
  testEmailSchema,
  maintenanceModeSchema,
} from '../validators/schemas';
import { getMailConfigurationError, sendTestEmail } from '../services/emailService';
import { cacheControl, CACHE_TTL, noStore } from '../middleware/cacheHeaders';

const router = Router();

interface FirstVisitModalConfig {
  enabled: boolean;
  title: string;
  content: string;
  min_stay_seconds: number;
  version: string;
}

interface SiteComplianceConfig {
  enabled: boolean;
  icp_number: string;
  public_security_number: string;
}

interface MaintenanceModeConfig {
  enabled: boolean;
  expected_end_time: string | null;
  message: string;
  version: string;
}

interface FeedbackRow {
  id: number;
  content: string;
  contact: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

const DEFAULT_FIRST_VISIT_MODAL: FirstVisitModalConfig = {
  enabled: false,
  title: '欢迎来到 HoYoMusic',
  content: '本站仅用于音乐欣赏与资料整理。请遵守相关法律法规。',
  min_stay_seconds: 5,
  version: '1',
};

const DEFAULT_SITE_COMPLIANCE: SiteComplianceConfig = {
  enabled: false,
  icp_number: '',
  public_security_number: '',
};

const DEFAULT_MAINTENANCE_MODE: MaintenanceModeConfig = {
  enabled: false,
  expected_end_time: null,
  message: '',
  version: '1',
};

const normalizeFirstVisitModalConfig = (input: unknown): FirstVisitModalConfig => {
  const raw = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const minStay = Number(raw.min_stay_seconds);

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_FIRST_VISIT_MODAL.enabled,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : DEFAULT_FIRST_VISIT_MODAL.title,
    content: typeof raw.content === 'string' && raw.content.trim() ? raw.content.trim() : DEFAULT_FIRST_VISIT_MODAL.content,
    min_stay_seconds: Number.isFinite(minStay) ? Math.max(5, Math.floor(minStay)) : DEFAULT_FIRST_VISIT_MODAL.min_stay_seconds,
    version: typeof raw.version === 'string' && raw.version.trim() ? raw.version.trim() : DEFAULT_FIRST_VISIT_MODAL.version,
  };
};

const getFirstVisitModalConfig = async (): Promise<FirstVisitModalConfig> => {
  const result = await pool.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1',
    ['first_visit_modal']
  );

  if (result.rows.length === 0) {
    return DEFAULT_FIRST_VISIT_MODAL;
  }

  return normalizeFirstVisitModalConfig(result.rows[0].setting_value);
};

const normalizeSiteComplianceConfig = (input: unknown): SiteComplianceConfig => {
  const raw = (input && typeof input === 'object') ? input as Record<string, unknown> : {};

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SITE_COMPLIANCE.enabled,
    icp_number: typeof raw.icp_number === 'string' ? raw.icp_number.trim() : DEFAULT_SITE_COMPLIANCE.icp_number,
    public_security_number: typeof raw.public_security_number === 'string'
      ? raw.public_security_number.trim()
      : DEFAULT_SITE_COMPLIANCE.public_security_number,
  };
};

const getSiteComplianceConfig = async (): Promise<SiteComplianceConfig> => {
  const result = await pool.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1',
    ['site_compliance']
  );

  if (result.rows.length === 0) {
    return DEFAULT_SITE_COMPLIANCE;
  }

  return normalizeSiteComplianceConfig(result.rows[0].setting_value);
};

const normalizeMaintenanceModeConfig = (input: unknown): MaintenanceModeConfig => {
  const raw = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const expectedEnd = typeof raw.expected_end_time === 'string' && raw.expected_end_time.trim()
    ? raw.expected_end_time.trim()
    : null;
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_MAINTENANCE_MODE.enabled,
    expected_end_time: expectedEnd,
    message,
    version: typeof raw.version === 'string' && raw.version.trim() ? raw.version.trim() : DEFAULT_MAINTENANCE_MODE.version,
  };
};

const getMaintenanceModeConfig = async (): Promise<MaintenanceModeConfig> => {
  const result = await pool.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1',
    ['maintenance_mode']
  );

  if (result.rows.length === 0) {
    return DEFAULT_MAINTENANCE_MODE;
  }

  return normalizeMaintenanceModeConfig(result.rows[0].setting_value);
};

const getRequestIp = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim().slice(0, 64);
  }
  return (req.ip || req.socket.remoteAddress || '').toString().slice(0, 64) || null;
};

const getReadableEmailError = (error: unknown): string => {
  if (error instanceof Error && error.message === 'MAIL_NOT_CONFIGURED') {
    return '邮件服务未配置';
  }

  const err = error as {
    code?: string;
    responseCode?: number;
    response?: string;
    command?: string;
    message?: string;
  };

  if (err?.code === 'EAUTH' || err?.responseCode === 535) {
    return 'SMTP 认证失败：请检查 MAIL_USER / MAIL_PASS（通常应使用邮箱授权码）';
  }
  if (err?.code === 'ENOTFOUND') {
    return 'SMTP 服务器地址无法解析：请检查 MAIL_HOST';
  }
  if (err?.code === 'ECONNECTION' || err?.code === 'ESOCKET' || err?.code === 'ETIMEDOUT') {
    return 'SMTP 连接失败：请检查 MAIL_HOST / MAIL_PORT / MAIL_SECURE 及网络连通性';
  }
  if (err?.code === 'EENVELOPE' || err?.responseCode === 550 || err?.responseCode === 553) {
    return '收件邮箱地址被服务器拒绝：请检查收件邮箱是否正确';
  }
  if (err?.response && typeof err.response === 'string') {
    return `邮件服务器返回错误：${err.response.slice(0, 200)}`;
  }

  return err?.message || '未知错误';
};

/**
 * @openapi
 * /public/feedback:
 *   post:
 *     tags: [Settings]
 *     summary: 提交用户反馈
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string }
 *               contact: { type: string }
 *             required: [content]
 *     responses:
 *       '200':
 *         description: 提交成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '500':
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/public/feedback', validateBody(feedbackSubmitSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as { content: string; contact?: string };
    const content = body.content.trim();
    const contact = (body.contact || '').trim();
    const ip = getRequestIp(req);
    const ua = String(req.headers['user-agent'] || '').slice(0, 512);

    await pool.query(
      `INSERT INTO feedback_messages (content, contact, ip, user_agent)
       VALUES ($1, NULLIF($2, ''), $3, NULLIF($4, ''))`,
      [content, contact, ip, ua]
    );

    res.json({
      success: true,
      data: { message: 'Feedback submitted successfully' },
    });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FEEDBACK_SUBMIT_ERROR', message: 'Failed to submit feedback' },
    });
  }
});

/**
 * @openapi
 * /settings/test-email:
 *   post:
 *     tags: [Settings]
 *     summary: 发送测试邮件
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *             required: [email]
 *     responses:
 *       '200':
 *         description: 发送成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '400':
 *         description: 邮件未配置
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/settings/test-email', authenticateAdmin, validateBody(testEmailSchema), async (req: Request, res: Response) => {
  try {
    const configError = getMailConfigurationError();
    if (configError) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_NOT_CONFIGURED', message: configError },
      });
    }

    const { email } = req.body as { email: string };
    await sendTestEmail(email);

    res.json({
      success: true,
      data: { message: `测试邮件已发送到 ${email}` },
    });
  } catch (error) {
    console.error('Failed to send test email:', error);
    const reason = getReadableEmailError(error);
    res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: `测试邮件发送失败：${reason}` },
    });
  }
});

/**
 * @openapi
 * /settings/feedback:
 *   get:
 *     tags: [Settings]
 *     summary: 获取反馈列表
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 反馈列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items: { type: array, items: { type: object } }
 *                     pagination: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/settings/feedback', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSizeRaw = parseInt(String(req.query.pageSize || '20'), 10) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const [countResult, listResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM feedback_messages'),
      pool.query(
        `SELECT id, content, contact, ip, user_agent, created_at
         FROM feedback_messages
         ORDER BY created_at DESC, id DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);
    const items = listResult.rows.map((row): FeedbackRow => ({
      id: Number(row.id),
      content: String(row.content),
      contact: row.contact ? String(row.contact) : null,
      ip: row.ip ? String(row.ip) : null,
      user_agent: row.user_agent ? String(row.user_agent) : null,
      created_at: String(row.created_at),
    }));

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
    });
  } catch (error) {
    console.error('Failed to list feedback:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FEEDBACK_LIST_ERROR', message: 'Failed to load feedback list' },
    });
  }
});

/**
 * @openapi
 * /public/site-config/first-visit-modal:
 *   get:
 *     tags: [Settings]
 *     summary: 获取首次访问弹窗配置（公开）
 *     responses:
 *       '200':
 *         description: 配置内容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '500':
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/public/site-config/first-visit-modal', cacheControl(CACHE_TTL.SHORT, { staleWhileRevalidate: 120 }), async (_req: Request, res: Response) => {
  try {
    const config = await getFirstVisitModalConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to read first-visit modal config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_READ_ERROR', message: 'Failed to read first-visit modal config' },
    });
  }
});

/**
 * @openapi
 * /settings/first-visit-modal:
 *   get:
 *     tags: [Settings]
 *     summary: 获取首次访问弹窗配置
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 配置内容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/settings/first-visit-modal', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const config = await getFirstVisitModalConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to read first-visit modal config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_READ_ERROR', message: 'Failed to read first-visit modal config' },
    });
  }
});

/**
 * @openapi
 * /settings/first-visit-modal:
 *   put:
 *     tags: [Settings]
 *     summary: 更新首次访问弹窗配置
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *               title: { type: string }
 *               content: { type: string }
 *               min_stay_seconds: { type: integer }
 *     responses:
 *       '200':
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/settings/first-visit-modal', authenticateAdmin, validateBody(firstVisitModalSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      enabled: boolean;
      title: string;
      content: string;
      min_stay_seconds?: number;
    };

    const nextConfig: FirstVisitModalConfig = {
      enabled: body.enabled,
      title: body.title.trim(),
      content: body.content.trim(),
      min_stay_seconds: Math.max(5, body.min_stay_seconds ?? 5),
      version: new Date().toISOString(),
    };

    await pool.query(
      `
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = NOW()
      `,
      ['first_visit_modal', JSON.stringify(nextConfig)]
    );

    res.json({ success: true, data: nextConfig });
  } catch (error) {
    console.error('Failed to update first-visit modal config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_UPDATE_ERROR', message: 'Failed to update first-visit modal config' },
    });
  }
});

/**
 * @openapi
 * /public/site-config/compliance:
 *   get:
 *     tags: [Settings]
 *     summary: 获取合规配置（公开）
 *     responses:
 *       '200':
 *         description: 配置内容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '500':
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/public/site-config/compliance', cacheControl(CACHE_TTL.SHORT, { staleWhileRevalidate: 120 }), async (_req: Request, res: Response) => {
  try {
    const config = await getSiteComplianceConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to read compliance config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_READ_ERROR', message: 'Failed to read compliance config' },
    });
  }
});

/**
 * @openapi
 * /settings/compliance:
 *   get:
 *     tags: [Settings]
 *     summary: 获取合规配置
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 配置内容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/settings/compliance', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const config = await getSiteComplianceConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to read compliance config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_READ_ERROR', message: 'Failed to read compliance config' },
    });
  }
});

/**
 * @openapi
 * /settings/compliance:
 *   put:
 *     tags: [Settings]
 *     summary: 更新合规配置
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *               icp_number: { type: string }
 *               public_security_number: { type: string }
 *     responses:
 *       '200':
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/settings/compliance', authenticateAdmin, validateBody(siteComplianceSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as SiteComplianceConfig;
    const nextConfig: SiteComplianceConfig = {
      enabled: body.enabled,
      icp_number: body.icp_number.trim(),
      public_security_number: body.public_security_number.trim(),
    };

    await pool.query(
      `
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = NOW()
      `,
      ['site_compliance', JSON.stringify(nextConfig)]
    );

    res.json({ success: true, data: nextConfig });
  } catch (error) {
    console.error('Failed to update compliance config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_UPDATE_ERROR', message: 'Failed to update compliance config' },
    });
  }
});

/**
 * @openapi
 * /public/site-config/maintenance:
 *   get:
 *     tags: [Settings]
 *     summary: 获取维护模式配置（公开）
 *     responses:
 *       '200':
 *         description: 配置内容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '500':
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/public/site-config/maintenance', noStore, async (_req: Request, res: Response) => {
  try {
    const config = await getMaintenanceModeConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to read maintenance config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_READ_ERROR', message: 'Failed to read maintenance config' },
    });
  }
});

/**
 * @openapi
 * /settings/maintenance:
 *   get:
 *     tags: [Settings]
 *     summary: 获取维护模式配置
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 配置内容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/settings/maintenance', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const config = await getMaintenanceModeConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Failed to read maintenance config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_READ_ERROR', message: 'Failed to read maintenance config' },
    });
  }
});

/**
 * @openapi
 * /settings/maintenance:
 *   put:
 *     tags: [Settings]
 *     summary: 更新维护模式配置
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *               expected_end_time: { type: string, nullable: true }
 *               message: { type: string }
 *     responses:
 *       '200':
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/settings/maintenance', authenticateAdmin, validateBody(maintenanceModeSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as { enabled: boolean; expected_end_time?: string | null; message?: string };
    const expectedEnd = typeof body.expected_end_time === 'string' && body.expected_end_time.trim()
      ? body.expected_end_time.trim()
      : null;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    const nextConfig: MaintenanceModeConfig = {
      enabled: body.enabled,
      expected_end_time: expectedEnd,
      message,
      version: new Date().toISOString(),
    };

    await pool.query(
      `
        INSERT INTO app_settings (setting_key, setting_value)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = NOW()
      `,
      ['maintenance_mode', JSON.stringify(nextConfig)]
    );

    res.json({ success: true, data: nextConfig });
  } catch (error) {
    console.error('Failed to update maintenance config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SETTINGS_UPDATE_ERROR', message: 'Failed to update maintenance config' },
    });
  }
});

export default router;


