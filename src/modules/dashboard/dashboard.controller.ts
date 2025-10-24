import { Request, Response } from "express";
import { ResponseBuilder } from "../../utils/http";
import { asyncHandler } from "../../middleware/error";
import { dashboardService } from "./dashboard.service";

export class DashboardController {
  /**
   * GET /api/dashboard/stats
   * Get dashboard statistics
   */
  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const promo_id = req.query.promo_id as string | undefined; // ✅ optional query param
    const stats = await dashboardService.getStats(promo_id);
    ResponseBuilder.success(res, stats, "Dashboard statistics retrieved successfully");
  });
}

export const dashboardController = new DashboardController();
