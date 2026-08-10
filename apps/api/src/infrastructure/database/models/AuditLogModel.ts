import mongoose, { Schema, type Document } from 'mongoose';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogDocument extends Document {
  actorId: string;
  actorRole?: string;
  action: string;
  resource: string;
  details: string;
  severity: AuditSeverity;
  method: string;
  path: string;
  statusCode: number;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    resource: { type: String, required: true, index: true },
    details: { type: String, required: true },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number, required: true },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLogModel = mongoose.model<AuditLogDocument>(
  'AuditLog',
  auditLogSchema
);
