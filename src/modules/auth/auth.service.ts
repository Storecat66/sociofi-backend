import * as argon2 from "argon2";
import { jwtService } from "../../utils/jwt";
import { UnauthorizedError } from "../../utils/http";
import { UserModel } from "../../models/user.model";
import { RefreshTokenModel } from "../../models/refreshToken.model";
import { AuditLogModel } from "../../models/auditLog.model";
import { IUser } from "../../models/user.model";

export class AuthService {
  /**
   * Authenticate user with email and password
   */
  async login(
    email: string,
    password: string,
    ip: string
  ): Promise<{
    user: Omit<IUser, "password_hash" | "token_version">;
    accessToken: string;
    refreshToken: string;
  }> {
    // Find active user by email
    const user = await UserModel.findOne({ email, is_active: true });

    if (!user) throw new UnauthorizedError("Invalid credentials");

    const isValidPassword = await argon2.verify(user.password_hash, password);
    if (!isValidPassword) throw new UnauthorizedError("Invalid credentials");

    // Normalize user id to string (Mongoose _id can be typed as unknown)
    const userId = (user._id as any).toString();

    // Generate tokens
    const accessToken = jwtService.generateAccessToken({
      userId: userId,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version,
    });

    const { token: refreshToken, jti } = jwtService.generateRefreshToken(
      userId,
      user.token_version
    );

    // Save refresh token
    await RefreshTokenModel.create({
      user_id: user._id,
      token: jti,
      expires_at: jwtService.getRefreshTokenExpiry(),
    });

    // Log login activity
    await this.logActivity(userId, "login", "users", userId, { ip });

    // Return a plain object (not a Mongoose document) to match expected type
    return {
      user: {
        _id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        phone_number: user.phone_number,
        assigned_promotions: user.assigned_promotions,
        created_at: user.created_at,
        updated_at: user.updated_at,
      } as any,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenString: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
  const payload = jwtService.verifyRefreshToken(refreshTokenString);

      // Find token record in DB
      const userIdFromPayload = String(payload.userId);

      const storedToken = await RefreshTokenModel.findOne({
        token: payload.jti,
        user_id: userIdFromPayload,
        expires_at: { $gt: new Date() },
      });

      if (!storedToken) throw new UnauthorizedError("Invalid refresh token");

      // Find user
      const user = await UserModel.findOne({
        _id: payload.userId,
        is_active: true,
      });

      if (!user || user.token_version !== payload.tokenVersion) {
        await RefreshTokenModel.deleteOne({ token: payload.jti });
        throw new UnauthorizedError("Invalid refresh token");
      }

      // Token rotation: remove old token
  await RefreshTokenModel.deleteOne({ token: payload.jti });


      // Normalize id for token generation
      const userId = (user._id as any).toString();

      // Generate new tokens
      const newAccessToken = jwtService.generateAccessToken({
        userId: userId,
        email: user.email,
        role: user.role,
        tokenVersion: user.token_version,
      });

      const { token: newRefreshToken, jti: newJti } =
        jwtService.generateRefreshToken(userId, user.token_version);

      await RefreshTokenModel.create({
        user_id: user._id,
        token: newJti,
        expires_at: jwtService.getRefreshTokenExpiry(),
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedError("Invalid refresh token");
    }
  }

  /**
   * Logout user by removing refresh token
   */
  async logout(refreshTokenString: string): Promise<void> {
    try {
      const payload = jwtService.verifyRefreshToken(refreshTokenString);
      await RefreshTokenModel.deleteOne({ token: payload.jti });

      const userId = String(payload.userId);
      await this.logActivity(userId, "logout", "users", userId, {});
    } catch {
      // ignore expired/invalid tokens
    }
  }

  /**
   * Invalidate all sessions by incrementing token_version and deleting all refresh tokens
   */
  async invalidateAllSessions(userId: string): Promise<void> {
    await UserModel.updateOne({ _id: userId }, { $inc: { token_version: 1 } });
    await RefreshTokenModel.deleteMany({ user_id: userId });
  }

  /**
   * Cleanup expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    await RefreshTokenModel.deleteMany({ expires_at: { $lt: new Date() } });
  }

  /**
   * Log user activity
   */
  private async logActivity(
    actorId: string,
    action: string,
    targetTable: string,
    targetId: string,
    meta: any
  ): Promise<void> {
    await AuditLogModel.create({
      actor_id: actorId,
      action,
      target_table: targetTable,
      target_id: targetId,  // Keep as string since it's a MongoDB ObjectId string
      meta,
    });
  }

  /**
   * Request password reset (stub implementation)
   */
  async requestPasswordReset(email: string): Promise<void> {
    // In a real implementation, generate a reset token, save it, and send email
    console.log(`Password reset requested for email: ${email}`);
  }
}

export const authService = new AuthService();
