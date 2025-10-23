import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  phone_number?: string;
  prize_name?: string;
  prize_type?: string;
  prize_date?: Date;
  campaign?: string;
  password_hash: string;
  role: "admin" | "manager" | "viewer";
  assigned_promotions: string[];
  is_active: boolean;
  token_version: number;
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone_number: { type: String },
    prize_name: { type: String },
    prize_type: { type: String },
    prize_date: { type: Date },
    campaign: { type: String },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ["admin", "manager", "viewer"],default: "viewer" },
    assigned_promotions: { type: [String], default: [] },
    is_active: { type: Boolean, default: true },
    token_version: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const UserModel = model<IUser>("User", userSchema);
