import mongoose, { Schema, type Document } from 'mongoose';
import { WalletType } from '@ubuntu-fund/types';

export interface WalletDocument extends Document {
  userId: string;
  type: WalletType;
  currency: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<WalletDocument>(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: Object.values(WalletType),
      required: true,
    },
    currency: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

walletSchema.index({ userId: 1, type: 1, currency: 1 }, { unique: true });

export const WalletModel = mongoose.model<WalletDocument>(
  'Wallet',
  walletSchema
);
