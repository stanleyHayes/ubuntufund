import mongoose, { Schema, type Document } from 'mongoose';
import type {
  VerificationType,
  DocumentType,
  RiskLevel,
  KYCDocument as KYCDocumentInfo,
  KYCPersonalInfo,
  KYCAddress,
  KYCBusinessInfo,
} from '@ubuntu-fund/types';
import type { KYCVerificationStatus } from '../../../domain/ports/outbound/KYCRepositoryPort.js';

export interface KYCVerificationDocument extends Document {
  userId: string;
  verificationType: VerificationType;
  status: KYCVerificationStatus;
  documents: KYCDocumentInfo[];
  personalInfo?: KYCPersonalInfo;
  businessInfo?: KYCBusinessInfo;
  riskLevel: RiskLevel;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  expiryDate?: Date;
  rejectionReason?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const VERIFICATION_TYPES: VerificationType[] = [
  'identity',
  'address',
  'business',
  'political',
  'media',
];

const DOCUMENT_TYPES: DocumentType[] = [
  'id_card',
  'passport',
  'drivers_license',
  'utility_bill',
  'bank_statement',
  'business_registration',
  'tax_certificate',
];

const VERIFICATION_STATUSES: KYCVerificationStatus[] = [
  'pending',
  'in_review',
  'approved',
  'rejected',
  'expired',
];

const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high'];

const addressSchema = new Schema<KYCAddress>(
  {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },
  },
  { _id: false }
);

const personalInfoSchema = new Schema<KYCPersonalInfo>(
  {
    fullName: { type: String },
    dateOfBirth: { type: Date },
    nationality: { type: String },
    idNumber: { type: String },
    address: { type: addressSchema },
  },
  { _id: false }
);

const businessInfoSchema = new Schema<KYCBusinessInfo>(
  {
    businessName: { type: String },
    registrationNumber: { type: String },
    taxId: { type: String },
    businessType: { type: String },
    incorporationDate: { type: Date },
  },
  { _id: false }
);

const documentSchema = new Schema<KYCDocumentInfo>(
  {
    type: { type: String, enum: DOCUMENT_TYPES, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, required: true, default: () => new Date() },
    verifiedAt: { type: Date },
  },
  { _id: false }
);

const kycVerificationSchema = new Schema<KYCVerificationDocument>(
  {
    userId: { type: String, required: true, index: true },
    verificationType: {
      type: String,
      enum: VERIFICATION_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: 'pending',
      index: true,
    },
    documents: { type: [documentSchema], default: [] },
    personalInfo: { type: personalInfoSchema },
    businessInfo: { type: businessInfoSchema },
    riskLevel: { type: String, enum: RISK_LEVELS, default: 'low' },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    reviewNotes: { type: String },
    expiryDate: { type: Date },
    rejectionReason: { type: String },
    retryCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Speeds up the duplicate-submission check (userId + verificationType + status).
kycVerificationSchema.index({ userId: 1, verificationType: 1, status: 1 });

export const KYCVerificationModel = mongoose.model<KYCVerificationDocument>(
  'KYCVerification',
  kycVerificationSchema
);
