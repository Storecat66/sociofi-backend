import { UserModel } from "../../models/user.model";
import { AuditLogModel } from "../../models/auditLog.model";
import { User } from "../../db/schema";
import { sanitizeUser, sanitizeUsers, canManageUser, isValidRole } from "./user.model";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../utils/http";
import * as argon2 from "argon2";
import { Types } from "mongoose";

export class UserService {
  async getUsers({ limit = 30, cursor }: { limit?: number; cursor?: string } = {}) {
    const filter = cursor ? { _id: { $gt: new Types.ObjectId(cursor) } } : {};
    const users = await UserModel.find(filter).sort({ _id: 1 }).limit(limit + 1).lean<User[]>();

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
      if (actorRole !== "admin") throw new ForbiddenError("Only admins can change roles");
      if (!isValidRole(updates.role)) throw new BadRequestError("Invalid role specified");
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

    return sanitizeUser(newUser.toObject() as User);
  }
}

export const userService = new UserService();
