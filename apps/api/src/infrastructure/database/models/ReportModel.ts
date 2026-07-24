import mongoose, { Schema, type Document } from 'mongoose';
import type {
  ReportReason,
  ReportStatus,
} from '../../../domain/ports/outbound/ReportRepositoryPort.js';

export interface ReportDocument extends Document {
  campaignId: string;
  reporterId: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: Date;
}

const REPORT_REASONS: ReportReason[] = [
  'fraudulent',
  'misleading',
  'inappropriate_content',
  'spam',
  'illegal_activity',
  'other',
];

const REPORT_STATUSES: ReportStatus[] = ['pending', 'reviewed', 'dismissed'];

const reportSchema = new Schema<ReportDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    reporterId: { type: String, required: true, index: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

// One report per campaign per reporter
reportSchema.index({ campaignId: 1, reporterId: 1 }, { unique: true });

export const ReportModel = mongoose.model<ReportDocument>(
  'Report',
  reportSchema
);
