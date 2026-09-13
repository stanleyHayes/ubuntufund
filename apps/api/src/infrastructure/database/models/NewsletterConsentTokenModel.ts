import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  subscriptionId: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['confirm', 'unsubscribe'], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, expires: 0 },
}, { timestamps: true });
export const NewsletterConsentTokenModel = mongoose.model('NewsletterConsentToken', schema);
