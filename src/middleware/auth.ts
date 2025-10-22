import { Request, Response, NextFunction } from "express";
import { jwtService } from "../utils/jwt";
import { UnauthorizedError, ForbiddenError } from "../utils/http";
import { UserRole } from "../db/schema";
import { UserModel } from "../models/user.model"; // ⬅️ new mongoose model

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string; // ObjectId is stored as string in JWT
        email: string;
        role: UserRole;
        tokenVersion: number;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using JWT access token
 */
export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractBearerToken(authHeader);

    if (!token) {
      throw new UnauthorizedError("Access token required");
    }

    // Verify the token and extract payload
    const payload = jwtService.verifyAccessToken(token);

    // Fetch user from MongoDB
    const user = await UserModel.findById(payload.userId).select("email role token_version is_active").lean();

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    if (!user.is_active) {
      throw new UnauthorizedError("Account is deactivated");
    }

    if (user.token_version !== payload.tokenVersion) {
      throw new UnauthorizedError("Token has been invalidated");
    }

    // Attach user info to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError("Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Convenience middleware for admin-only routes
 */
export const requireAdmin = requireRole(["admin"]);

/**
 * Convenience middleware for admin and manager routes
 */
export const requireManagerOrAdmin = requireRole(["admin", "manager"]);

/**
 * Optional auth middleware - attaches user if token is provided but doesn't fail if missing
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractBearerToken(authHeader);

    if (!token) {
      return next();
    }

    const payload = jwtService.verifyAccessToken(token);

    const user = await UserModel.findById(payload.userId).select("email role token_version is_active").lean();

    if (user && user.is_active && user.token_version === payload.tokenVersion) {
      req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        tokenVersion: user.token_version,
      };
    }

    next();
  } catch (error) {
    // optional auth → silently skip if token invalid
    next();
  }
};
