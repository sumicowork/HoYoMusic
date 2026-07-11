import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';
import pool from '../config/database';
import { authenticateDebug } from '../middleware/debugAuth';
import { validateBody } from '../middleware/validate';
import { debugQuerySchema } from '../validators/schemas';

const router = Router();

const DEBUG_ROOT_DIR = path.resolve(process.env.DEBUG_ROOT_DIR || path.join(process.cwd(), '..'));
const DEBUG_MAX_READ_BYTES = Math.max(1024, parseInt(process.env.DEBUG_MAX_READ_BYTES || '1048576', 10));
const DEBUG_ALLOW_WRITE_SQL = process.env.DEBUG_ALLOW_WRITE_SQL === 'true';

const listQuerySchema = z.object({
  targetPath: z.string().optional(),
});

const readQuerySchema = z.object({
  targetPath: z.string().min(1),
  offset: z.coerce.number().int().min(0).optional(),
  length: z.coerce.number().int().min(1).max(DEBUG_MAX_READ_BYTES).optional(),
});

async function resolveInsideRoot(targetPath = '.'): Promise<string> {
  const absolutePath = path.resolve(DEBUG_ROOT_DIR, targetPath);
  const realRoot = await fs.realpath(DEBUG_ROOT_DIR);
  const realTarget = await fs.realpath(absolutePath).catch(() => absolutePath);
  const relative = path.relative(realRoot, realTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes DEBUG_ROOT_DIR');
  }
  return realTarget;
}

router.use(authenticateDebug);

/**
 * @openapi
 * /debug/health:
 *   get:
 *     tags: [Debug]
 *     summary: 调试接口健康检查（默认关闭）
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 调试 API 正常，返回数据库时间
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '500':
 *         description: 健康检查失败
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const db = await pool.query('SELECT NOW() AS now');
    res.json({
      success: true,
      data: {
        debugApi: 'enabled',
        rootDir: DEBUG_ROOT_DIR,
        dbNow: db.rows[0]?.now,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'DEBUG_HEALTH_FAILED', message: 'Failed to run debug health check' },
    });
  }
});

/**
 * @openapi
 * /debug/db/query:
 *   post:
 *     tags: [Debug]
 *     summary: 执行原始 SQL 查询（高危，默认关闭）
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sql: { type: string }
 *               params:
 *                 type: array
 *                 items: { type: string }
 *               allowWrite: { type: boolean }
 *             required: [sql]
 *     responses:
 *       '200':
 *         description: SQL 执行结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '400':
 *         description: SQL 执行错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '403':
 *         description: 写操作被阻止（需 DEBUG_ALLOW_WRITE_SQL 与 allowWrite）
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/db/query', validateBody(debugQuerySchema), async (req: Request, res: Response) => {
  const { sql, params = [], allowWrite = false } = req.body as z.infer<typeof debugQuerySchema>;
  const normalized = sql.trim().toLowerCase();
  const isWriteLike = /^(insert|update|delete|create|alter|drop|truncate|grant|revoke)\b/.test(normalized);

  if (isWriteLike && (!DEBUG_ALLOW_WRITE_SQL || !allowWrite)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'DEBUG_WRITE_BLOCKED',
        message: 'Write SQL disabled. Set DEBUG_ALLOW_WRITE_SQL=true and send allowWrite=true to proceed.',
      },
    });
  }

  try {
    const result = await pool.query(sql, params);
    return res.json({
      success: true,
      data: {
        rowCount: result.rowCount,
        rows: result.rows,
        command: result.command,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'DEBUG_SQL_ERROR', message: error?.message || 'SQL execution failed' },
    });
  }
});

/**
 * @openapi
 * /debug/fs/list:
 *   get:
 *     tags: [Debug]
 *     summary: 列出调试根目录下的文件与子目录
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: targetPath
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: 目录条目列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '400':
 *         description: 路径越界或无效
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/fs/list', async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query' } });
  }

  try {
    const target = await resolveInsideRoot(parsed.data.targetPath || '.');
    const entries = await fs.readdir(target, { withFileTypes: true });
    return res.json({
      success: true,
      data: {
        rootDir: DEBUG_ROOT_DIR,
        target,
        entries: entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 'dir' : entry.isFile() ? 'file' : 'other',
        })),
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'DEBUG_FS_LIST_FAILED', message: error?.message || 'Failed to list files' },
    });
  }
});

/**
 * @openapi
 * /debug/fs/read:
 *   get:
 *     tags: [Debug]
 *     summary: 以 base64 读取调试文件内容
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: targetPath
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: offset
 *         schema: { type: integer }
 *       - in: query
 *         name: length
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 文件内容（base64 编码）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '400':
 *         description: 文件读取失败或路径不是文件
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/fs/read', async (req: Request, res: Response) => {
  const parsed = readQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query' } });
  }

  const { targetPath, offset = 0, length = DEBUG_MAX_READ_BYTES } = parsed.data;
  try {
    const target = await resolveInsideRoot(targetPath);
    const stat = await fs.stat(target);
    if (!stat.isFile()) {
      return res.status(400).json({ success: false, error: { code: 'DEBUG_NOT_FILE', message: 'targetPath must be a file' } });
    }
    const safeOffset = Math.min(offset, stat.size);
    const remaining = Math.max(0, stat.size - safeOffset);
    const maxRead = Math.min(length, remaining);
    const buffer = Buffer.allocUnsafe(maxRead);
    const handle = await fs.open(target, 'r');
    let bytesRead = 0;
    try {
      ({ bytesRead } = await handle.read(buffer, 0, maxRead, safeOffset));
    } finally {
      await handle.close();
    }
    const slice = buffer.subarray(0, bytesRead);
    return res.json({
      success: true,
      data: {
        target,
        size: stat.size,
        offset: safeOffset,
        returned: slice.length,
        encoding: 'base64',
        content: slice.toString('base64'),
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'DEBUG_FS_READ_FAILED', message: error?.message || 'Failed to read file' },
    });
  }
});

export default router;
