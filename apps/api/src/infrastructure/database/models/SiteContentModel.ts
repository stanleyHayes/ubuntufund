import mongoose, { Schema, type Document } from 'mongoose';

export interface SiteContentDocument extends Document {
  key: string;
  type: string;
  // Arbitrary JSON payload — Mixed so any block shape can be stored without a
  // schema migration. Consumers key off `type` to interpret it.
  data: unknown;
  updatedAt: Date;
  updatedBy?: string;
}

const siteContentSchema = new Schema<SiteContentDocument>(
  {
    // `unique` already provisions the index, so the key is both unique and
    // indexed without a second (duplicate) index declaration.
    key: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, trim: true, default: 'custom' },
    data: { type: Schema.Types.Mixed, required: true, default: {} },
    updatedBy: { type: String, required: false },
  },
  // Only `updatedAt` is meaningful for a key→JSON store (last edit time); no
  // createdAt is tracked.
  {
    collection: 'sitecontents',
    timestamps: { createdAt: false, updatedAt: true },
  }
);

export const SiteContentModel = mongoose.model<SiteContentDocument>(
  'SiteContent',
  siteContentSchema
);
