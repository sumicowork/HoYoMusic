import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticateJWT } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { firstVisitModalSchema, siteComplianceSchema, feedbackSubmitSchema, testEmailSchema } from '../validators/schemas';
import { isMailConfigured, sendTestEmail } from '../services/emailService';

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

router.post('/settings/test-email', authenticateJWT, validateBody(testEmailSchema), async (req: Request, res: Response) => {
  try {
    if (!isMailConfigured()) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_NOT_CONFIGURED', message: '邮件服务未配置，请先设置 MAIL_* 环境变量' },
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
    res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: '测试邮件发送失败，请检查 SMTP 配置' },
    });
  }
});

router.get('/settings/feedback', authenticateJWT, async (req: Request, res: Response) => {
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

router.get('/public/site-config/first-visit-modal', async (_req: Request, res: Response) => {
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

router.get('/settings/first-visit-modal', authenticateJWT, async (_req: Request, res: Response) => {
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

router.put('/settings/first-visit-modal', authenticateJWT, validateBody(firstVisitModalSchema), async (req: Request, res: Response) => {
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

router.get('/public/site-config/compliance', async (_req: Request, res: Response) => {
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

router.get('/settings/compliance', authenticateJWT, async (_req: Request, res: Response) => {
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

router.put('/settings/compliance', authenticateJWT, validateBody(siteComplianceSchema), async (req: Request, res: Response) => {
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

export default router;


