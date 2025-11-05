import { UserModel } from "../../models/user.model";
import { AuditLogModel } from "../../models/auditLog.model";
import { User } from "../../db/schema";
import {
  sanitizeUser,
  sanitizeUsers,
  canManageUser,
  isValidRole,
} from "./user.model";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../../utils/http";
import * as argon2 from "argon2";
import { Types } from "mongoose";
import { sendMail } from "../../utils/mail";
import env from "../../config/env";
import jwtService from "../../utils/jwt";

export class UserService {
  async getUsers({
    limit = 30,
    cursor,
  }: { limit?: number; cursor?: string } = {}) {
    // Base filter to exclude admin users
    const baseFilter: any = { role: { $ne: "admin" } };

    // Add pagination cursor if provided
    if (cursor) {
      baseFilter._id = { $gt: new Types.ObjectId(cursor) };
    }

    // Fetch users except admins
    const users = await UserModel.find(baseFilter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean<User[]>();

    // Pagination logic
    const hasNext = users.length > limit;
    const sliced = hasNext ? users.slice(0, -1) : users;
    const nextCursor = hasNext ? users[limit - 1]?._id.toString() : undefined;

    return { users: sanitizeUsers(sliced), hasNext, nextCursor };
  }

  async getUserById(id: string) {
    const user = await UserModel.findById(id).lean<User>();
    if (!user) throw new NotFoundError("User not found");
    return sanitizeUser(user);
  }

  async updateUser(
    id: string,
    updates: Partial<{ role: string; is_active: boolean }>,
    actorId: string,
    actorRole: string
  ) {
    const targetUser = await UserModel.findById(id);
    if (!targetUser) throw new NotFoundError("User not found");

    if (id === actorId) {
      if (updates.role && updates.role !== targetUser.role)
        throw new ForbiddenError("Cannot change your own role");
      if (updates.is_active === false)
        throw new ForbiddenError("Cannot deactivate your own account");
    }

    if (updates.role && updates.role !== targetUser.role) {
      if (actorRole !== "admin")
        throw new ForbiddenError("Only admins can change roles");
      if (!isValidRole(updates.role))
        throw new BadRequestError("Invalid role specified");
      if (id === actorId && updates.role !== "admin")
        throw new ForbiddenError("Cannot demote yourself");
    }

    if (updates.is_active !== undefined) {
      if (!canManageUser(actorRole, targetUser.role))
        throw new ForbiddenError("Insufficient permissions");
    }

    const previous = { role: targetUser.role, is_active: targetUser.is_active };
    Object.assign(targetUser, updates);
    await targetUser.save();

    await AuditLogModel.create({
      actor_id: actorId,
      action: "update",
      target_table: "users",
      target_id: id,
      meta: { previous, changes: updates },
    });

    // convert document to plain object for sanitizer
    return sanitizeUser(targetUser.toObject() as User);
  }

  async assignCampaigns(
    id: string,
    promotions: string[],
    actorId: string,
    actorRole: string
  ) {
    const targetUser = await UserModel.findById(id);
    if (!targetUser) throw new NotFoundError("User not found");

    // Permission check: only admin or managers who can manage the target role
    if (actorRole !== 'admin' && !canManageUser(actorRole, targetUser.role)) {
      throw new ForbiddenError('Insufficient permissions to assign campaigns');
    }

    const previous = { assigned_promotions: targetUser.assigned_promotions };

    // Ensure unique promotion IDs
    const uniquePromos = Array.from(new Set(promotions || []));

    targetUser.assigned_promotions = uniquePromos;
    await targetUser.save();

    await AuditLogModel.create({
      actor_id: actorId,
      action: 'assign_campaigns',
      target_table: 'users',
      target_id: id,
      meta: { previous, changes: { assigned_promotions: uniquePromos } },
    });

    return sanitizeUser(targetUser.toObject() as User);
  }

  async getUserAuditLogs(userId: string, limit = 50) {
    return AuditLogModel.find({
      target_table: "users",
      target_id: userId,
    })
      .sort({ created_at: -1 })
      .limit(limit);
  }

  async searchUsers(query: string, limit = 30) {
    const users = await UserModel.find({
      $or: [
        { email: new RegExp(query, "i") },
        { name: new RegExp(query, "i") },
      ],
    })
      .sort({ name: 1 })
      .limit(limit)
      .lean<User[]>();

    return sanitizeUsers(users);
  }

  async getUserStats() {
    const byRole = await UserModel.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const active = await UserModel.countDocuments({ is_active: true });
    const inactive = await UserModel.countDocuments({ is_active: false });

    return {
      byRole: byRole.map((r) => ({ role: r._id, count: r.count })),
      active,
      inactive,
    };
  }

  async createUser(userData: {
    name: string;
    email: string;
    phone_number?: string;
    prize_name?: string;
    prize_type?: string;
    prize_date?: Date;
    campaign?: string;
    password: string;
    role: string;
    assigned_promotions?: string[];
  }) {
    const password_hash = await argon2.hash(userData.password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    const newUser = await UserModel.create({
      ...userData,
      password_hash,
    });

    // sending the mail to the user with credentials
    const loginUrl = env.CORS_ORIGIN;
    await sendMail({
      to: newUser.email,
      subject: "Your New Account Created",
      html: `
    <h2>Hello ${newUser.name},</h2>
    <p>Your account has been created successfully.</p>
    <p><strong>Email:</strong> ${newUser.email}<br/>
       <strong>Password:</strong> ${userData.password}</p>
    <p>
      You can log in here: <a href="${loginUrl}" target="_blank">${loginUrl}</a>
    </p>
    <p>Please log in and change your password immediately.</p>
    <br/>
    <p>Best regards,<br/>Socio-Fi Team</p>
  `,
    });

    return sanitizeUser(newUser.toObject() as User);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    // ✅ Verify current password
    const isMatch = await argon2.verify(user.password_hash, currentPassword);
    if (!isMatch) throw new BadRequestError("Incorrect current password");

    // ✅ Hash new password with secure params
    const newPasswordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    user.password_hash = newPasswordHash;
    await user.save();

    // Optional: email user about password change
    try {
      await sendMail({
        to: user.email,
        subject: "Your password has been changed",
        html: `
          <h2>Hello ${user.name},</h2>
          <p>Your Socio-Fi account password was successfully changed.</p>
          <p>If this wasn't you, please contact support immediately.</p>
          <br/>
          <p>Best regards,<br/>Socio-Fi Security Team</p>
        `,
      });
      console.log("✅ Password change email sent to user");
    } catch (emailErr) {
      console.warn("⚠️ Password change email failed:", emailErr);
    }

    return sanitizeUser(user.toObject() as User);
  }

  async impersonateUser(adminId: string, userIdToImpersonate: string) {
    const adminUser = await UserModel.findById(adminId);
    if (!adminUser) throw new NotFoundError("Admin user not found");
    if (adminUser.role !== "admin")
      throw new ForbiddenError("Only admins can impersonate users");

    const targetUser = await UserModel.findById(userIdToImpersonate).lean<User>();
    if (!targetUser) throw new NotFoundError("Target user not found");

    const impersonatedToken = jwtService.generateAccessToken({
      userId: targetUser._id.toString(),
      email: targetUser.email,
      role: targetUser.role,
      tokenVersion: targetUser.token_version,
    });

    // Log the impersonation action
    await AuditLogModel.create({
      actor_id: adminId,
      action: "impersonate",
      target_table: "users",
      target_id: userIdToImpersonate,
      meta: { adminId, userIdToImpersonate },
    });

    const santizedUser =  sanitizeUser(targetUser);
    return { impersontedUser: santizedUser,  impersonatedToken };
  }
}

export const userService = new UserService();
