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
  /** Numeric settings (fees, tiers, percentages). Absent on a text setting. */
  value?: number;
  /**
   * Text settings, e.g. the address review alerts are sent to. A separate
   * column rather than a stringified `value` so existing numeric rows keep
   * their type and every reader of `value` is unaffected.
   */
  textValue?: string;
  effectiveFrom: Date;
  createdBy: string;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CommercialConfigDocument>(
  {
    key: { type: String, required: true, index: true },
    // Exactly one of these is set; which one depends on the key. Neither is
    // `required`, because requiring both would make text settings impossible
    // and requiring neither is caught at the application layer.
    value: { type: Number },
    textValue: { type: String },
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
