import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  subscriptionId: { type: String, required: true, index: true },
  action: { type: String, enum: ['requested', 'confirmed', 'withdrawn'], required: true },
  source: { type: String, required: true },
  consentVersion: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
export const NewsletterConsentEventModel = mongoose.model('NewsletterConsentEvent', schema);
