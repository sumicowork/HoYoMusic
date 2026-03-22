import { Router } from 'express';
import { getCredits, addCredit, updateCredit, deleteCredit, importCredits, exportCredits } from '../controllers/creditsController';
import { authenticateAdmin } from '../middleware/auth';
import { jsonUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { addCreditSchema, updateCreditSchema } from '../validators/schemas';

const router = Router();

// Get credits - public
router.get('/:id/credits', getCredits);

// Bulk import from JSON file - require authentication
// Accepts: multipart/form-data with field "file", OR application/json body
router.post('/import', authenticateAdmin, jsonUpload.single('file'), importCredits);

// Bulk export to JSON file (same schema as import)
router.post('/export', authenticateAdmin, exportCredits);

// Admin routes - require authentication
router.post('/:id/credits', authenticateAdmin, validateBody(addCreditSchema), addCredit);
router.put('/:id/credits/:creditId', authenticateAdmin, validateBody(updateCreditSchema), updateCredit);
router.delete('/:id/credits/:creditId', authenticateAdmin, deleteCredit);

export default router;

