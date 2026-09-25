import mongoose, { Schema, type Document } from 'mongoose';
import type { PayoutRecipientType } from '@ubuntu-fund/types';

export interface TransferRecipientDocument extends Document {
  payoutWriteVersion?: number;
  campaignId: string;
  createdBy: string;
  type: PayoutRecipientType;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  recipientCode: string;
  recipientMode?: 'live' | 'test';
  currency: string;
  verificationStatus?: 'name_matched' | 'needs_review';
  resolvedAccountName?: string;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: Date;
  reviews?: { payoutId: string; reviewedBy: string; reviewNote: string; reviewedAt: Date; destination?: { recipientCode: string; accountNumber: string; bankCode: string; currency: string; type: string; campaignId: string; createdBy: string } }[];
  createdAt: Date;
}

const RECIPIENT_TYPES: PayoutRecipientType[] = ['ghipss', 'mobile_money'];

const transferRecipientSchema = new Schema<TransferRecipientDocument>(
  {
    payoutWriteVersion: { type: Number, default: 0 },
    campaignId: { type: String, required: true, index: true },
    createdBy: { type: String, required: true, index: true },
    type: { type: String, enum: RECIPIENT_TYPES, required: true },
    accountNumber: { type: String, required: true },
    bankCode: { type: String, required: true },
    accountName: { type: String, required: true },
    recipientCode: { type: String, required: true, index: true },
    recipientMode: { type: String, enum: ['live', 'test'] },
    currency: { type: String, required: true },
    verificationStatus: { type: String, enum: ['name_matched', 'needs_review'], default: 'needs_review' },
    resolvedAccountName: String,
    reviewedBy: String,
    reviewNote: String,
    reviewedAt: Date,
    reviews: [{ payoutId: String, reviewedBy: String, reviewNote: String, reviewedAt: Date, destination: { recipientCode: String, accountNumber: String, bankCode: String, currency: String, type: { type: String }, campaignId: String, createdBy: String } }],
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'transferrecipients', timestamps: false }
);

export const TransferRecipientModel = mongoose.model<TransferRecipientDocument>(
  'TransferRecipient',
  transferRecipientSchema
);
