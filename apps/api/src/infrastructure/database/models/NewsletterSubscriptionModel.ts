import mongoose, { Schema, type Document } from 'mongoose';

export interface NewsletterSubscriptionDocument extends Document {
  email: string;
  createdAt: Date;
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
    // A subscription is write-once: `createdAt` is stamped on insert by the
    // repository's upsert (`$setOnInsert`) and never touched on re-subscribe.
    // No `updatedAt`, so `timestamps` stays off.
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'newslettersubscriptions', timestamps: false }
);

export const NewsletterSubscriptionModel =
  mongoose.model<NewsletterSubscriptionDocument>(
    'NewsletterSubscription',
    newsletterSubscriptionSchema
  );
