import mongoose, { Schema, type Document } from 'mongoose';
import type { LiveSessionStatus } from '@ubuntu-fund/types';

export interface LiveSessionStatsSubdoc {
  scans: number;
  checkoutStarts: number;
  successfulDonations: number;
  amountRaised: number;
}

export interface LiveSessionDocument extends Document {
  campaignId: string;
  title?: string;
  targetAmount?: number;
  status: LiveSessionStatus;
  overlayToken: string;
  showDonorNames: boolean;
  showDonorMessages: boolean;
  showAmounts: boolean;
  privacyMode: boolean;
  startedAt: Date;
  endedAt?: Date;
  stats: LiveSessionStatsSubdoc;
  createdAt: Date;
  updatedAt: Date;
}

const LIVE_SESSION_STATUSES: LiveSessionStatus[] = ['active', 'ended'];

const statsSchema = new Schema<LiveSessionStatsSubdoc>(
  {
    scans: { type: Number, default: 0 },
    checkoutStarts: { type: Number, default: 0 },
    successfulDonations: { type: Number, default: 0 },
    amountRaised: { type: Number, default: 0 },
  },
  { _id: false }
);

const liveSessionSchema = new Schema<LiveSessionDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    title: { type: String },
    targetAmount: { type: Number },
    status: {
      type: String,
      enum: LIVE_SESSION_STATUSES,
      required: true,
      default: 'active',
      index: true,
    },
    // Secret bearer token gating overlay + SSE reads. Indexed so the SSE and
    // overlay handlers can validate a token quickly.
    overlayToken: { type: String, required: true, index: true },
    showDonorNames: { type: Boolean, default: true },
    showDonorMessages: { type: Boolean, default: true },
    showAmounts: { type: Boolean, default: true },
    privacyMode: { type: Boolean, default: false },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    stats: {
      type: statsSchema,
      default: () => ({
        scans: 0,
        checkoutStarts: 0,
        successfulDonations: 0,
        amountRaised: 0,
      }),
    },
  },
  { timestamps: true }
);

export const LiveSessionModel = mongoose.model<LiveSessionDocument>(
  'LiveSession',
  liveSessionSchema
);
