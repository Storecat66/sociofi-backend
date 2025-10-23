import { Router } from 'express';
import { promotionsController } from './promotions.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

/**
 * @route   GET /api/promotions/active
 * @desc    Get list of active promotions
 * @access  Public
 */
router.get('/active',requireAuth, promotionsController.getActivePromotions);

export default router;
    