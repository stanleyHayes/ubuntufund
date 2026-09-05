import mongoose, { Schema, type Document } from 'mongoose';
import type { PayoutRecipientType } from '@ubuntu-fund/types';

export interface TransferRecipientDocument extends Document {
  campaignId: string;
  createdBy: string;
  type: PayoutRecipientType;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  recipientCode: string;
  currency: string;
  createdAt: Date;
}

const RECIPIENT_TYPES: PayoutRecipientType[] = ['ghipss', 'mobile_money'];

const transferRecipientSchema = new Schema<TransferRecipientDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    createdBy: { type: String, required: true, index: true },
    type: { type: String, enum: RECIPIENT_TYPES, required: true },
    accountNumber: { type: String, required: true },
    bankCode: { type: String, required: true },
    accountName: { type: String, required: true },
    recipientCode: { type: String, required: true, index: true },
    currency: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'transferrecipients', timestamps: false }
);

export const TransferRecipientModel = mongoose.model<TransferRecipientDocument>(
  'TransferRecipient',
  transferRecipientSchema
);
