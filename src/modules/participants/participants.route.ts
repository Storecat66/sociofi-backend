import { Router } from 'express';
import { participantsController } from './participants.controller';
import { requireAuth, requireManagerOrAdmin } from '../../middleware/auth';
import { userLimiter } from '../../middleware/rateLimit';

const router = Router();

/**
 * @route   GET /api/participants/search
 * @desc    Search participants by email, name, or phone
 * @access  Private (Manager/Admin only)
 */
router.get('/search', requireAuth, requireManagerOrAdmin, userLimiter, participantsController.searchParticipants);

/**
 * @route   GET /api/participants/stats
 * @desc    Get participants statistics
 * @access  Private (Manager/Admin only)
 */
router.get('/stats', requireAuth, requireManagerOrAdmin, participantsController.getParticipantsStats);

/**
 * @route   GET /api/participants/countries
 * @desc    Get list of unique countries from participants
 * @access  Private (Manager/Admin only)
 */
router.get('/countries', requireAuth, requireManagerOrAdmin, participantsController.getCountries);

/**
 * @route   GET /api/participants/filters
 * @desc    Get available filter options for participants
 * @access  Private (Manager/Admin only)
 */
router.get('/filters', requireAuth, requireManagerOrAdmin, participantsController.getFilterOptions);

/**
 * @route   GET /api/participants
 * @desc    Get paginated list of participants with filtering and sorting
 * @access  Private (Manager/Admin only)
 */
router.get('/fetch_by_promo/:promo_id', requireAuth, userLimiter, participantsController.getParticipants);

/**
 * @route   GET /api/participants/:id
 * @desc    Get participant by ID
 * @access  Private (Manager/Admin only)
 */
router.get('/:id', requireAuth, requireManagerOrAdmin, participantsController.getParticipantById);

export default router;
