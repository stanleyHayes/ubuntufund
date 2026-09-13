import mongoose, { Schema, type Document } from 'mongoose';

export interface NewsletterSubscriptionDocument extends Document {
  email: string;
  createdAt: Date;
  status?: 'pending' | 'active' | 'unsubscribed';
  requestedAt?: Date;
  confirmedAt?: Date;
  withdrawnAt?: Date;
  consentVersion?: string;
  consentSource?: string;
  confirmationTokenHash?: string;
}

const newsletterSubscriptionSchema = new Schema<NewsletterSubscriptionDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Existing rows without status/confirmation are not evidence of consent.
    status: { type: String, enum: ['pending', 'active', 'unsubscribed'], default: 'pending' },
    requestedAt: Date,
    confirmedAt: Date,
    withdrawnAt: Date,
    consentVersion: String,
    consentSource: String,
    confirmationTokenHash: { type: String, select: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'newslettersubscriptions', timestamps: false }
);

export const NewsletterSubscriptionModel =
  mongoose.model<NewsletterSubscriptionDocument>(
    'NewsletterSubscription',
    newsletterSubscriptionSchema
  );
