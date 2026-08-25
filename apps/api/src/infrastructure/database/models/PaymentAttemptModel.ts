import mongoose, { Schema, type Document } from 'mongoose';
import type {
  DonationProvider,
  PaymentAttemptStatus,
} from '@ubuntu-fund/types';

export interface PaymentAttemptDocument extends Document {
  intentId: string;
  provider: DonationProvider;
  providerRef?: string;
  status: PaymentAttemptStatus;
  raw?: Record<string, unknown>;
  createdAt: Date;
}

const DONATION_PROVIDERS: DonationProvider[] = ['wallet', 'paystack'];
const ATTEMPT_STATUSES: PaymentAttemptStatus[] = [
  'initiated',
  'succeeded',
  'failed',
];

const paymentAttemptSchema = new Schema<PaymentAttemptDocument>(
  {
    intentId: { type: String, required: true, index: true },
    provider: { type: String, enum: DONATION_PROVIDERS, required: true },
    providerRef: { type: String },
    status: { type: String, enum: ATTEMPT_STATUSES, required: true },
    raw: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'paymentattempts', timestamps: false }
);

export const PaymentAttemptModel = mongoose.model<PaymentAttemptDocument>(
  'PaymentAttempt',
  paymentAttemptSchema
);
