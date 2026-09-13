import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  _id: { type: String, required: true }, userId: { type: String, required: true, index: true },
  category: { type: String, required: true }, channel: { type: String, enum: ['inApp', 'email'], required: true },
  title: { type: String, required: true }, body: { type: String, required: true }, path: { type: String, required: true },
  occurredAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'delivered', 'suppressed', 'review'], default: 'pending', index: true },
  nextAttemptAt: { type: Date, default: Date.now }, attempts: { type: Number, default: 0 },
  leaseUntil: Date, leaseToken: String, firstAttemptAt: Date, deliveredAt: Date, lastError: String,
  // Freeze the request before first send so an idempotent retry has identical content.
  emailRequest: { type: Schema.Types.Mixed, select: false },
}, { timestamps: true });
schema.index({ status: 1, nextAttemptAt: 1 });
export const ActivityAlertDeliveryModel = mongoose.model('ActivityAlertDelivery', schema);
