import mongoose, { Schema, type Document } from 'mongoose';
import { PaymentMethod } from '@ubuntu-fund/types';

export interface DonationDocument extends Document {
  campaignId: string;
  donorId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  message?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

const donationSchema = new Schema<DonationDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    donorId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), default: PaymentMethod.WALLET, required: true },
    message: { type: String },
    isAnonymous: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const DonationModel = mongoose.model<DonationDocument>(
  'Donation',
  donationSchema
);
