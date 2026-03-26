import { Request, Response } from 'express';
import pool from '../config/database';

type AuthUser = { id: number; is_admin?: boolean };

const clampPage = (v: unknown): number => Math.max(1, Number.parseInt(String(v || '1'), 10) || 1);
const clampPageSize = (v: unknown): number => Math.min(100, Math.max(1, Number.parseInt(String(v || '20'), 10) || 20));

export const sendSiteMessage = async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const payload = req.body as {
    title: string;
    content: string;
    is_broadcast?: boolean;
    recipient_user_ids?: number[];
    expires_at?: string | null;
  };

  const isBroadcast = Boolean(payload.is_broadcast);
  const recipientIds = Array.isArray(payload.recipient_user_ids)
    ? Array.from(new Set(payload.recipient_user_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)))
    : [];

  if (!isBroadcast && recipientIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'recipient_user_ids is required when is_broadcast=false' },
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const messageResult = await client.query(
      `INSERT INTO site_messages (sender_user_id, title, content, is_broadcast, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sender_user_id, title, content, is_broadcast, created_at, expires_at`,
      [user.id, payload.title.trim(), payload.content.trim(), isBroadcast, payload.expires_at || null]
    );

    const messageId = messageResult.rows[0].id;
    let deliveryCount = 0;

    if (isBroadcast) {
      const deliveryResult = await client.query(
        `INSERT INTO site_message_deliveries (message_id, recipient_user_id)
         SELECT $1, u.id
         FROM users u
         WHERE u.account_status = 'active'
         ON CONFLICT (message_id, recipient_user_id) DO NOTHING`,
        [messageId]
      );
      deliveryCount = Number(deliveryResult.rowCount || 0);
    } else {
      const activeUsersResult = await client.query(
        `SELECT id FROM users WHERE id = ANY($1) AND account_status = 'active'`,
        [recipientIds]
      );
      const activeIds = activeUsersResult.rows.map((row) => Number(row.id));

      if (activeIds.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: { code: 'NO_ACTIVE_RECIPIENTS', message: 'No active recipients found' },
        });
      }

      const deliveryResult = await client.query(
        `INSERT INTO site_message_deliveries (message_id, recipient_user_id)
         SELECT $1, unnest($2::int[])
         ON CONFLICT (message_id, recipient_user_id) DO NOTHING`,
        [messageId, activeIds]
      );
      deliveryCount = Number(deliveryResult.rowCount || 0);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        message: messageResult.rows[0],
        delivery_count: deliveryCount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Send site message error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SITE_MESSAGE_SEND_ERROR', message: 'Failed to send site message' },
    });
  } finally {
    client.release();
  }
};

export const getInboxMessages = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthUser;
    const page = clampPage(req.query.page);
    const pageSize = clampPageSize(req.query.pageSize);
    const offset = (page - 1) * pageSize;

    const [countResult, listResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM site_message_deliveries d
         JOIN site_messages m ON m.id = d.message_id
         WHERE d.recipient_user_id = $1
           AND (m.expires_at IS NULL OR m.expires_at > NOW())`,
        [user.id]
      ),
      pool.query(
        `SELECT
           d.id,
           d.message_id,
           d.delivered_at,
           d.is_read,
           d.read_at,
           m.title,
           m.content,
           m.is_broadcast,
           m.created_at,
           m.expires_at,
           sender.username AS sender_username
         FROM site_message_deliveries d
         JOIN site_messages m ON m.id = d.message_id
         LEFT JOIN users sender ON sender.id = m.sender_user_id
         WHERE d.recipient_user_id = $1
           AND (m.expires_at IS NULL OR m.expires_at > NOW())
         ORDER BY d.delivered_at DESC
         LIMIT $2 OFFSET $3`,
        [user.id, pageSize, offset]
      ),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);
    return res.json({
      success: true,
      data: {
        items: listResult.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
    });
  } catch (error) {
    console.error('Get inbox messages error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SITE_MESSAGE_INBOX_ERROR', message: 'Failed to load inbox messages' },
    });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthUser;
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM site_message_deliveries d
       JOIN site_messages m ON m.id = d.message_id
       WHERE d.recipient_user_id = $1
         AND d.is_read = FALSE
         AND (m.expires_at IS NULL OR m.expires_at > NOW())`,
      [user.id]
    );

    return res.json({ success: true, data: { unread: Number(result.rows[0]?.total || 0) } });
  } catch (error) {
    console.error('Get unread count error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SITE_MESSAGE_UNREAD_ERROR', message: 'Failed to load unread count' },
    });
  }
};

export const markMessageRead = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthUser;
    const deliveryId = Number.parseInt(String(req.params.deliveryId || ''), 10);
    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid delivery id' } });
    }

    const result = await pool.query(
      `UPDATE site_message_deliveries
       SET is_read = TRUE,
           read_at = COALESCE(read_at, NOW())
       WHERE id = $1
         AND recipient_user_id = $2
       RETURNING id, is_read, read_at`,
      [deliveryId, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'MESSAGE_NOT_FOUND', message: 'Message delivery not found' },
      });
    }

    return res.json({ success: true, data: { delivery: result.rows[0] } });
  } catch (error) {
    console.error('Mark message read error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SITE_MESSAGE_MARK_READ_ERROR', message: 'Failed to mark message as read' },
    });
  }
};

export const markAllMessagesRead = async (req: Request, res: Response) => {
  try {
    const user = req.user as AuthUser;
    const result = await pool.query(
      `UPDATE site_message_deliveries d
       SET is_read = TRUE,
           read_at = COALESCE(read_at, NOW())
       FROM site_messages m
       WHERE d.message_id = m.id
         AND d.recipient_user_id = $1
         AND d.is_read = FALSE
         AND (m.expires_at IS NULL OR m.expires_at > NOW())`,
      [user.id]
    );

    return res.json({
      success: true,
      data: {
        updated: Number(result.rowCount || 0),
      },
    });
  } catch (error) {
    console.error('Mark all messages read error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SITE_MESSAGE_MARK_ALL_READ_ERROR', message: 'Failed to mark all as read' },
    });
  }
};

export const listSentMessages = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '30'), 10) || 30));
    const result = await pool.query(
      `SELECT
         m.id,
         m.title,
         m.content,
         m.is_broadcast,
         m.created_at,
         m.expires_at,
         sender.username AS sender_username,
         COUNT(d.id)::int AS delivery_count,
         COUNT(*) FILTER (WHERE d.is_read = TRUE)::int AS read_count
       FROM site_messages m
       LEFT JOIN users sender ON sender.id = m.sender_user_id
       LEFT JOIN site_message_deliveries d ON d.message_id = m.id
       GROUP BY m.id, sender.username
       ORDER BY m.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ success: true, data: { items: result.rows } });
  } catch (error) {
    console.error('List sent messages error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SITE_MESSAGE_LIST_SENT_ERROR', message: 'Failed to load sent messages' },
    });
  }
};

