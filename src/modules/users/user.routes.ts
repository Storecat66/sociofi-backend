import { Router } from "express";
import { userController } from "./user.controller";
import {
  requireAuth,
  requireAdmin,
  requireManagerOrAdmin,
} from "../../middleware/auth";
import { userLimiter } from "../../middleware/rateLimit";

const router = Router();

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", requireAuth, userController.getCurrentUser);

/**
 * @route   GET /api/users/search
 * @desc    Search users by email or name
 * @access  Private (Manager/Admin only)
 */
router.get(
  "/search",
  requireAuth,
  requireManagerOrAdmin,
  userController.searchUsers
);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private (Admin only)
 */
router.get("/stats", requireAuth, requireAdmin, userController.getUserStats);

/**
 * @route   GET /api/users
 * @desc    Get paginated list of users with keyset pagination
 * @access  Private (Manager/Admin only)
 */
router.get(
  "/",
  requireAuth,
  requireAdmin,
  userLimiter,
  userController.getUsers
);

/**
 * @route  POST /api/users
 * @desc   Create a new user
 * @access Private (Admin only)
 */
router.post(
  "/",
  requireAuth,
  requireManagerOrAdmin,
  userLimiter,
  userController.createUser
);

/**
 * @route POST /api/impersonate/:userIdToImpoersonate
 * @desc Impersonate another user
 * @access Private (Admin only)
 */
router.post(
  "/impersonate/:userIdToImpoersonate",
  requireAuth,
  requireAdmin,
  userController.impersonateUser
);

/**
 * @route POST /api/change-password
 * @desc changing the user password
 * @access Private
 */
router.post("/change-password", requireAuth, userController.changePassword);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Manager/Admin only)
 */
router.get(
  "/:id",
  requireAuth,
  requireManagerOrAdmin,
  userController.getUserById
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update user role or active status
 * @access  Private (Admin only for role changes, Manager for status changes)
 */
router.patch("/:id", requireAuth, userLimiter, userController.updateUser);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Toggle or set user active status
 * @access  Private (Manager/Admin only)
 */
router.put(
  "/:id/status",
  requireAuth,
  requireAdmin,
  userLimiter,
  userController.changeStatus
);

/**
 * @route   PATCH /api/users/:id/campaigns
 * @desc    Assign promotions/campaigns to a user
 * @access  Private (Admin only)
 */
router.patch(
  "/:id/campaigns",
  requireAuth,
  requireAdmin,
  userLimiter,
  userController.assignCampaigns
);

/**
 * @route   GET /api/users/:id/audit-logs
 * @desc    Get user audit logs
 * @access  Private (Admin only)
 */
router.get(
  "/:id/audit-logs",
  requireAuth,
  requireAdmin,
  userController.getUserAuditLogs
);

export default router;
