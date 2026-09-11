import mongoose, { Schema, type Document } from 'mongoose';

/**
 * A per-payout lease on "may call the provider to verify this transfer".
 *
 * Deliberately NOT a field on PayoutModel. That schema is `{ timestamps: true }`
 * and the reconciler selects stuck payouts on `updatedAt`
 * (MongoPayoutRepository.findStuckProcessing, and the 24h batch dwell in
 * ReconcilePayoutsUseCase). Leasing on the payout row would bump `updatedAt` on
 * every owner poll, so an actively-watched payout could never age past the
 * 1-minute cutoff and the reconciliation safety net would disengage exactly
 * where it is most needed. Do not "simplify" this into a payout field.
 *
 * Truncating this collection (`db.payout_check_leases.deleteMany({})`) is a safe
 * on-call override: it re-enables immediate checks without touching money rows.
 */
export interface PayoutCheckLeaseDocument extends Document<string> {
  _id: string; // payout id
  expiresAt: Date;
}

const payoutCheckLeaseSchema = new Schema<PayoutCheckLeaseDocument>(
  { _id: { type: String }, expiresAt: { type: Date, required: true } },
  { collection: 'payout_check_leases', versionKey: false }
);

// Self-cleaning only. The acquire filter does the real expiry check, because the
// TTL monitor runs on its own ~60s cadence and must never be load-bearing.
payoutCheckLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PayoutCheckLeaseModel = mongoose.model<PayoutCheckLeaseDocument>(
  'PayoutCheckLease',
  payoutCheckLeaseSchema
);
