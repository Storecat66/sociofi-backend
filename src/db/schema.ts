import { Types } from "mongoose";

// ========================
// User Types
// ========================

export interface User {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone_number?: string;
  prize_name?: string;
  prize_type?: string;
  prize_date?: Date;
  campaign?: string;
  password_hash: string;
  role: "admin" | "manager" | "viewer";
  is_active: boolean;
  token_version: number;
  created_at: Date;
  updated_at: Date;
}

export type UserRole = "admin" | "manager" | "viewer";

// Derived types
export type UserWithoutPassword = Omit<User, "password_hash" | "token_version">;

export type UserForJWT = {
  userId: string; // ObjectId stringified
  email: string;
  role: UserRole;
  tokenVersion: number;
};

// ========================
// Refresh Token Types
// ========================

export interface RefreshToken {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface NewRefreshToken {
  user_id: Types.ObjectId;
  token: string;
  expires_at: Date;
}

// ========================
// Audit Log Types
// ========================

export interface AuditLog {
  _id: Types.ObjectId;
  actor_id: Types.ObjectId;
  action: string;
  target_table: string;
  target_id: Types.ObjectId | string | number;
  meta?: any;
  created_at: Date;
}

export interface NewAuditLog {
  actor_id: Types.ObjectId;
  action: string;
  target_table: string;
  target_id: Types.ObjectId | string | number;
  meta?: any;
}

// ========================
// Auth Response Types
// ========================

export interface LoginResponse {
  user: UserWithoutPassword;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
