import { Schema, model, Document, Types } from "mongoose";

export interface IPasswordReset extends Document {
  user_id: Types.ObjectId;
  token: string; // jti
  used: boolean;
  used_at?: Date;
  expires_at: Date;
  created_at: Date;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    used: { type: Boolean, default: false },
    used_at: { type: Date },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const PasswordResetModel = model<IPasswordReset>("PasswordReset", passwordResetSchema);
