import mongoose, { Schema, type Document } from 'mongoose';

/**
 * A versioned, effective-dated commercial/risk config value (ADR-5). Each write
 * appends a new row for the key with its own `effectiveFrom`, so history is
 * preserved and a change can be scheduled ahead of time; the currently-effective
 * value is the newest row whose `effectiveFrom <= now`. Values that predate a key
 * having any row fall back to the env default (see CommercialConfigService).
 */
export interface CommercialConfigDocument extends Document {
  key: string;
  value: number;
  effectiveFrom: Date;
  createdBy: string;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CommercialConfigDocument>(
  {
    key: { type: String, required: true, index: true },
    value: { type: Number, required: true },
    effectiveFrom: { type: Date, required: true, index: true },
    createdBy: { type: String, required: true },
    reason: { type: String },
  },
  { collection: 'commercial_config', timestamps: true }
);

// Fast "currently-effective value for a key" lookup: newest effectiveFrom first.
schema.index({ key: 1, effectiveFrom: -1 });

export const CommercialConfigModel = mongoose.model<CommercialConfigDocument>(
  'CommercialConfig',
  schema
);
