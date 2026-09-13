import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  _id: { type: String, required: true },
  store: { type: String, enum: ['apple', 'google'], required: true },
  referenceCiphertext: { type: String, required: true, select: false },
  revision: { type: Number, required: true, default: 0 },
  attempts: { type: Number, required: true, default: 0 },
  nextAttemptAt: { type: Date, required: true, index: true },
  leaseUntil: Date,
  processingToken: String,
  reviewRequired: { type: Boolean, default: false },
  lastError: String,
}, { timestamps: true });

export const StoreBillingNotificationModel = mongoose.model('StoreBillingNotification', schema);
