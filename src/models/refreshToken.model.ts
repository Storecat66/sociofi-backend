import { Schema, model, Document, Types } from "mongoose";

export interface IRefreshToken extends Document {
  user_id: Types.ObjectId;
  token: string;
  expires_at: Date;
  created_at: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const RefreshTokenModel = model<IRefreshToken>("RefreshToken", refreshTokenSchema);
