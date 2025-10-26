import { Request, Response } from 'express';
import { z } from 'zod';
import { userService } from './user.service';
import { ResponseBuilder } from '../../utils/http';
import { asyncHandler } from '../../middleware/error';
import { UserRole } from '../../db/schema';

// Validation schemas
const getUsersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(30),
  cursor: z.coerce.number().min(0).optional(),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'manager', 'viewer']).optional(),
  is_active: z.boolean().optional(),
}).refine(
  (data) => data.role !== undefined || data.is_active !== undefined,
  {
    message: 'At least one field (role or is_active) must be provided',
  }
);

// Accept string IDs (e.g. Mongo ObjectId) for route params
const userIdParamsSchema = z.object({
  id: z.string().min(1),
});

export class UserController {
  /**
   * GET /api/users
   * Get paginated list of users
   */
  getUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = getUsersQuerySchema.parse(req.query);

    const options: { limit?: number; cursor?: string } = { limit: query.limit };
    if (query.cursor !== undefined) {
      options.cursor = query.cursor.toString();
    }

    const result = await userService.getUsers(options);

    ResponseBuilder.paginated(
      res,
      result.users,
      result.hasNext,
      result.nextCursor?.toString(),
      query.limit,
      'Users retrieved successfully'
    );
  });

  /**
   * GET /api/users/:id
   * Get user by ID
   */
  getUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = userIdParamsSchema.parse(req.params);
    
    const user = await userService.getUserById(id.toString());
    
    ResponseBuilder.success(res, user, 'User retrieved successfully');
  });

  /**
   * PATCH /api/users/:id
   * Update user role or active status
   */
  updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      ResponseBuilder.error(res, 'Authentication required', 401);
      return;
    }

    const { id } = userIdParamsSchema.parse(req.params);
    const updates = updateUserSchema.parse(req.body);
    
    // Filter out undefined values to match exact optional types
    const filteredUpdates: Partial<{ role: UserRole; is_active: boolean }> = {};
    if (updates.role !== undefined) {
      filteredUpdates.role = updates.role;
    }
    if (updates.is_active !== undefined) {
      filteredUpdates.is_active = updates.is_active;
    }
    
    const updatedUser = await userService.updateUser(
      id.toString(),
      filteredUpdates,
      req.user.id,
      req.user.role
    );
    
    ResponseBuilder.success(res, updatedUser, 'User updated successfully');
  });

  /**
   * PUT /api/users/:id/status
   * Update only the user's active status
   */
  changeStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      ResponseBuilder.error(res, 'Authentication required', 401);
      return;
    }

    const { id } = userIdParamsSchema.parse(req.params);

    const payload = z.object({ is_active: z.boolean() }).parse(req.body);

    const updatedUser = await userService.updateUser(
      id.toString(),
      { is_active: payload.is_active },
      req.user.id,
      req.user.role
    );

    ResponseBuilder.success(res, updatedUser, 'User status updated successfully');
  });

  /**
   * PATCH /api/users/:id/campaigns
   * Assign promotions/campaigns to a user
   */
  assignCampaigns = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      ResponseBuilder.error(res, 'Authentication required', 401);
      return;
    }

    const { id } = userIdParamsSchema.parse(req.params);

    const payload = z.object({ assigned_promotions: z.array(z.string()).optional() }).parse(req.body);

    const assignedPromotions = payload.assigned_promotions ?? [];

    const updatedUser = await userService.assignCampaigns(
      id.toString(),
      assignedPromotions,
      req.user.id,
      req.user.role
    );

    ResponseBuilder.success(res, updatedUser, 'Campaigns updated successfully');
  });

  /**
   * GET /api/users/:id/audit-logs
   * Get user audit logs
   */
  getUserAuditLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = userIdParamsSchema.parse(req.params);
    
    const logs = await userService.getUserAuditLogs(id.toString());
    
    ResponseBuilder.success(res, logs, 'Audit logs retrieved successfully');
  });

  /**
   * GET /api/users/search
   * Search users by email or name
   */
  searchUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = z.string().min(1).parse(req.query.q);
    const limit = z.coerce.number().min(1).max(100).optional().default(30).parse(req.query.limit);
    
    const users = await userService.searchUsers(query, limit);
    
    ResponseBuilder.success(res, users, 'Search results retrieved successfully');
  });

  /**
   * GET /api/users/stats
   * Get user statistics
   */
  getUserStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = await userService.getUserStats();
    
    ResponseBuilder.success(res, stats, 'User statistics retrieved successfully');
  });

  /**
   * GET /api/users/me
   * Get current user profile
   */
  getCurrentUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      ResponseBuilder.error(res, 'Authentication required', 401);
      return;
    }

    const user = await userService.getUserById(req.user.id);
    
    ResponseBuilder.success(res, user, 'Current user retrieved successfully');
  });

  /**
   * POST /api/users
   * Create a new user
   */
  createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      ResponseBuilder.error(res, 'Authentication required', 401);
      return;
    }

    const validatedData = z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(['admin', 'manager', 'viewer']),
      password: z.string().min(6),
      phone_number: z.string().optional(),
      prize_name: z.string().optional(),
      prize_type: z.string().optional(),
      prize_date: z.coerce.date().optional(),
      campaign: z.string().optional(),
      assigned_promotions: z.array(z.string()).optional(),
    }).parse(req.body);

    // Transform to match service expectations (remove undefined from optional types)
    const newUserData: {
      name: string;
      email: string;
      phone_number?: string;
      prize_name?: string;
      prize_type?: string;
      prize_date?: Date;
      campaign?: string;
      password: string;
      assigned_promotions?: string[];
      role: UserRole;
    } = {
      name: validatedData.name,
      email: validatedData.email,
      password: validatedData.password,
      role: validatedData.role,
      ...(validatedData.phone_number !== undefined && { phone_number: validatedData.phone_number }),
      ...(validatedData.prize_name !== undefined && { prize_name: validatedData.prize_name }),
      ...(validatedData.prize_type !== undefined && { prize_type: validatedData.prize_type }),
      ...(validatedData.prize_date !== undefined && { prize_date: validatedData.prize_date }),
      ...(validatedData.campaign !== undefined && { campaign: validatedData.campaign }),
      ...(validatedData.assigned_promotions !== undefined && { assigned_promotions: validatedData.assigned_promotions }),
    };

    const newUser = await userService.createUser(newUserData);

    ResponseBuilder.success(res, newUser, 'User created successfully');
  });

  /**
 * POST /api/users/change-password
 * Change current user's password
 */
changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    ResponseBuilder.error(res, "Authentication required", 401);
    return;
  }

  // Validate input using Zod
  const validatedData = z
    .object({
      currentPassword: z.string().min(6, "Current password required"),
      newPassword: z.string().min(6, "New password must be at least 6 characters"),
    })
    .parse(req.body);

  const { currentPassword, newPassword } = validatedData;

  // Delegate to service
  const updatedUser = await userService.changePassword(req.user.id, currentPassword, newPassword);

  ResponseBuilder.success(res, updatedUser, "Password changed successfully");
});

}

export const userController = new UserController();