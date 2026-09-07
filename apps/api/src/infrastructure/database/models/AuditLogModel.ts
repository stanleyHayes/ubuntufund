import mongoose, { Schema, type Document } from 'mongoose';

export type AuditSeverity = 'info' | 'warning' | 'critical';

/** A single field's old→new value diff on a sensitive config change (ADR-5). */
export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

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
  /** Old→new values for a sensitive money/commercial config change (ADR-5). */
  changes?: AuditChange[];
  /** Optional free-text reason an admin gave for the change. */
  reason?: string;
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
    changes: {
      type: [
        new Schema<AuditChange>(
          { field: { type: String, required: true }, before: Schema.Types.Mixed, after: Schema.Types.Mixed },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    reason: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLogModel = mongoose.model<AuditLogDocument>(
  'AuditLog',
  auditLogSchema
);
