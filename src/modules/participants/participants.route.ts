import { Router } from 'express';
import { participantsController } from './participants.controller';
import { requireAuth, requireManagerOrAdmin } from '../../middleware/auth';
import { userLimiter } from '../../middleware/rateLimit';

const router = Router();

/**
 * @route   GET /api/participants/search/:promo_id
 * @desc    Search participants by email, name, or phone
 * @access  Private (Manager/Admin only)
 */
router.get('/search/:promo_id', requireAuth, requireManagerOrAdmin, userLimiter, participantsController.searchParticipants);

/**
 * @route   GET /api/participants/stats/:promo_id
 * @desc    Get participants statistics
 * @access  Private (Manager/Admin only)
 */
router.get('/stats/:promo_id', requireAuth, requireManagerOrAdmin, participantsController.getParticipantsStats);

/**
 * @route   GET /api/participants/countries/:promo_id
 * @desc    Get list of unique countries from participants
 * @access  Private (Manager/Admin only)
 */
router.get('/countries/:promo_id', requireAuth, requireManagerOrAdmin, participantsController.getCountries);

/**
 * @route   GET /api/participants/filters/:promo_id
 * @desc    Get available filter options for participants
 * @access  Private (Manager/Admin only)
 */
router.get('/filters/:promo_id', requireAuth, requireManagerOrAdmin, participantsController.getFilterOptions);

/**
 * @route   GET /api/participants/fetch_by_promo/:promo_id
 * @desc    Get paginated list of participants with filtering and sorting
 * @access  Private (Manager/Admin only)
 */
router.get('/fetch_by_promo/:promo_id', requireAuth, userLimiter, participantsController.getParticipants);

/**
 * @route   GET /api/participants/:promo_id/:id
 * @desc    Get participant by ID
 * @access  Private (Manager/Admin only)
 */
router.get('/:promo_id/:id', requireAuth, requireManagerOrAdmin, participantsController.getParticipantById);

export default router;
