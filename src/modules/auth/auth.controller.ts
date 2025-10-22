import { Request, Response } from "express";
import { z } from "zod";
import { authService } from "./auth.service";
import { ResponseBuilder } from "../../utils/http";
import { asyncHandler } from "../../middleware/error";

// Validation schema
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export class AuthController {
  /**
   * POST /api/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = loginSchema.parse(req.body);

    const result = await authService.login(email, password, req.ip ?? "");

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/auth",
    });

    ResponseBuilder.success(
      res,
      { user: result.user, accessToken: result.accessToken },
      "Login successful"
    );
  });

  /**
   * POST /api/auth
   * Refresh token
   */
  refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken)
      ResponseBuilder.error(res, "Refresh token not found", 401);

    const result = await authService.refreshToken(refreshToken);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/auth",
    });

    ResponseBuilder.success(
      res,
      { accessToken: result.accessToken },
      "Token refreshed successfully"
    );
  });

  /**
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) await authService.logout(refreshToken);

    res.clearCookie("refreshToken", { path: "/api/auth" });
    ResponseBuilder.success(res, null, "Logged out successfully");
  });

  /**
   * POST /api/auth/invalidate-sessions
   */
  invalidateSessions = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      if (!req.user) ResponseBuilder.error(res, "Authentication required", 401);

      if (!req.user) {
        ResponseBuilder.error(res, "Authentication required", 401);
        return;
      }

      await authService.invalidateAllSessions(req.user.id);

      await authService.invalidateAllSessions(req.user.id);

      res.clearCookie("refreshToken", { path: "/api/auth" });
      ResponseBuilder.success(
        res,
        null,
        "All sessions invalidated successfully"
      );
    }
  );
}

export const authController = new AuthController();
