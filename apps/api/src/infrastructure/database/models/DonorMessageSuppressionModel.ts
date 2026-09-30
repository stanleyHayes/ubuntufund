import mongoose, { Schema } from 'mongoose';

/**
 * Addresses that asked not to receive thank-you messages from campaigns they
 * supported. Keyed by the SHA-256 of the lowercased address, so it works for
 * guest donors (who have no account) and never stores the address itself.
 */
const schema = new Schema({
  _id: { type: String },
  source: { type: String, enum: ['unsubscribe_link', 'settings'], required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'donor_message_suppressions' });

export const DonorMessageSuppressionModel = mongoose.model('DonorMessageSuppression', schema);
