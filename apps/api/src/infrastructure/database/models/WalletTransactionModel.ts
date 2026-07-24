import mongoose, { Schema, type Document } from 'mongoose';
import { TransactionType, TransactionStatus } from '@ubuntu-fund/types';

export interface WalletTransactionDocument extends Document {
  walletId: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  reference: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const walletTransactionSchema = new Schema<WalletTransactionDocument>(
  {
    walletId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(TransactionType), required: true },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.COMPLETED,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    reference: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const WalletTransactionModel = mongoose.model<WalletTransactionDocument>(
  'WalletTransaction',
  walletTransactionSchema
);
