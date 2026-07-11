import { Router } from 'express';
import { getCredits, addCredit, updateCredit, deleteCredit, importCredits, exportCredits } from '../controllers/creditsController';
import { authenticateAdmin } from '../middleware/auth';
import { jsonUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { addCreditSchema, updateCreditSchema } from '../validators/schemas';

const router = Router();

// Get credits - public
/**
 * @openapi
 * /credits/{id}/credits:
 *   get:
 *     tags: [Credits]
 *     summary: 获取曲目制作人员信息（公开）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 制作人员列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 *       '404':
 *         description: 曲目不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/credits', getCredits);

// Bulk import from JSON file - require authentication
// Accepts: multipart/form-data with field "file", OR application/json body
/**
 * @openapi
 * /credits/import:
 *   post:
 *     tags: [Credits]
 *     summary: 批量导入制作人员信息
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       '200':
 *         description: 导入完成
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
router.post('/import', authenticateAdmin, jsonUpload.single('file'), importCredits);

// Bulk export to JSON file (same schema as import)
/**
 * @openapi
 * /credits/export:
 *   post:
 *     tags: [Credits]
 *     summary: 批量导出制作人员信息
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 导出文件
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/export', authenticateAdmin, exportCredits);

// Admin routes - require authentication
/**
 * @openapi
 * /credits/{id}/credits:
 *   post:
 *     tags: [Credits]
 *     summary: 添加制作人员信息
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               credit_key: { type: string }
 *               credit_value: { type: string }
 *             required: [credit_key, credit_value]
 *     responses:
 *       '201':
 *         description: 添加成功
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
router.post('/:id/credits', authenticateAdmin, validateBody(addCreditSchema), addCredit);

/**
 * @openapi
 * /credits/{id}/credits/{creditId}:
 *   put:
 *     tags: [Credits]
 *     summary: 更新制作人员信息
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: creditId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               credit_key: { type: string }
 *               credit_value: { type: string }
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
router.put('/:id/credits/:creditId', authenticateAdmin, validateBody(updateCreditSchema), updateCredit);

/**
 * @openapi
 * /credits/{id}/credits/{creditId}:
 *   delete:
 *     tags: [Credits]
 *     summary: 删除制作人员信息
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: creditId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 删除成功
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
router.delete('/:id/credits/:creditId', authenticateAdmin, deleteCredit);

export default router;

