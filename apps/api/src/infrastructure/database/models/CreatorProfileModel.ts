import mongoose, { Schema, type Document } from 'mongoose';

export interface CreatorProfileDocument extends Document {
  userId: string;
  handle: string;
  displayName: string;
  tagline?: string;
  bio?: string;
  avatarUrl?: string;
  tipsEnabled: boolean;
  presetAmounts: number[];
  currency: string;
  thankYouMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CreatorProfileDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    // Unique lowercase handle: the public page lives at /@{handle}.
    handle: { type: String, required: true, unique: true, lowercase: true, index: true },
    displayName: { type: String, required: true },
    tagline: { type: String },
    bio: { type: String },
    avatarUrl: { type: String },
    tipsEnabled: { type: Boolean, default: true },
    presetAmounts: { type: [Number], default: [10, 25, 50, 100] },
    currency: { type: String, default: 'GHS' },
    thankYouMessage: { type: String },
  },
  { collection: 'creator_profiles', timestamps: true }
);

export const CreatorProfileModel = mongoose.model<CreatorProfileDocument>(
  'CreatorProfile',
  schema
);
