import mongoose, { Schema, type Document } from 'mongoose';
import type { PayoutRecipientType } from '@ubuntu-fund/types';

export interface BeneficiaryRecipientDocument extends Document {
  campaignId: string;
  beneficiaryId: string;
  type: PayoutRecipientType;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  recipientCode: string;
  currency: string;
  kycVerified: boolean;
  kycVerifiedBy?: string;
  kycVerifiedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<BeneficiaryRecipientDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    beneficiaryId: { type: String, required: true },
    type: { type: String, enum: ['ghipss', 'mobile_money'], required: true },
    accountNumber: { type: String, required: true },
    bankCode: { type: String, required: true },
    accountName: { type: String, required: true },
    recipientCode: { type: String, required: true },
    currency: { type: String, required: true },
    kycVerified: { type: Boolean, default: false },
    kycVerifiedBy: { type: String },
    kycVerifiedAt: { type: Date },
    createdBy: { type: String, required: true },
  },
  { collection: 'beneficiary_recipients', timestamps: true }
);

// One payout destination per (campaign, beneficiary).
schema.index({ campaignId: 1, beneficiaryId: 1 }, { unique: true });

export const BeneficiaryRecipientModel =
  mongoose.model<BeneficiaryRecipientDocument>(
    'BeneficiaryRecipient',
    schema
  );
