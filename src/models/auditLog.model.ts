import { Schema, model, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  actor_id: Types.ObjectId;
  action: string;
  target_table: string;
  target_id: string;
  meta?: any;
  created_at: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    target_table: { type: String, required: true },
    target_id: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const AuditLogModel = model<IAuditLog>("AuditLog", auditLogSchema);
