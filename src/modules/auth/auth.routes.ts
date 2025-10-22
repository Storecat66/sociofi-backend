import { Router } from 'express';
import { authController } from './auth.controller';
import { authLimiter } from '../../middleware/rateLimit';
import { requireAuth } from '../../middleware/auth';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', authLimiter, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token cookie
 * @access  Public (requires refresh token cookie)
 */
router.post('/refresh', authLimiter, authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and clear refresh token
 * @access  Public
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/invalidate-sessions
 * @desc    Invalidate all sessions for current user
 * @access  Private
 */
router.post('/invalidate-sessions', requireAuth, authController.invalidateSessions);

export default router;