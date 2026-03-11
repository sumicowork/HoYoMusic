import { Router } from 'express';
import { getCredits, addCredit, updateCredit, deleteCredit, importCredits } from '../controllers/creditsController';
import { authenticateJWT } from '../middleware/auth';
import { jsonUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { addCreditSchema, updateCreditSchema } from '../validators/schemas';

const router = Router();

// Get credits - public
router.get('/:id/credits', getCredits);

// Bulk import from JSON file - require authentication
// Accepts: multipart/form-data with field "file", OR application/json body
router.post('/import', authenticateJWT, jsonUpload.single('file'), importCredits);

// Admin routes - require authentication
router.post('/:id/credits', authenticateJWT, validateBody(addCreditSchema), addCredit);
router.put('/:id/credits/:creditId', authenticateJWT, validateBody(updateCreditSchema), updateCredit);
router.delete('/:id/credits/:creditId', authenticateJWT, deleteCredit);

export default router;

