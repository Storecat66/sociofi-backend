import { Router } from 'express';
import { exportUserDataController } from './export_user_data.controller';
import { optionalAuth, requireAdmin } from '../../middleware/auth';

const router = Router();

/**
 * @route   POST /api/export
 * @desc    Export user data in PDF or Excel format
 * @access  Private (requires authentication)
 */
router.post('/', optionalAuth, requireAdmin, exportUserDataController.exportUserData);

export default router;
