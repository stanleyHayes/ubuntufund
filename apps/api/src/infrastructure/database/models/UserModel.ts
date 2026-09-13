import type { LegalAcceptanceRecord } from '@ubuntu-fund/types';
import mongoose, { Schema, type Document } from 'mongoose';
import { UserRole, VerificationLevel, OrganizationType } from '@ubuntu-fund/types';

export interface UserDocument extends Document {
  email: string;
  name: string;
  passwordHash: string;
  authVersion?: string;
  staffActionVersion?: number;
  profileWriteVersion?: number;
  accountIdentityRevision?: number;
  publicationWriteVersion?: number;
  organizationProfileRevision?: number;
  recoveryEmailRequestedAt?: Date;
  verificationEmailRequestedAt?: Date;
  avatarUrl?: string;
  coverUrl?: string;
  role: UserRole;
  verificationLevel: VerificationLevel;
  trustScore: number;
  country?: string;
  emailVerified: boolean;
  organizationName?: string;
  organizationType?: OrganizationType;
  registrationNumber?: string;
  website?: string;
  needsWebsite?: boolean;
  websiteRequestedAt?: Date;
  websiteRequestWithdrawnAt?: Date;
  legalAcceptance?: LegalAcceptanceRecord;
  /**
   * Compliance-approved campaign-goal ceiling (spec §18). When set, the effective
   * campaign limit is MIN(plan cap, this). Undefined = no compliance restriction
   * beyond the subscription plan. -1 means an approved unlimited override.
   */
  complianceApprovedCampaignLimit?: number;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    authVersion: { type: String },
    staffActionVersion: { type: Number },
    profileWriteVersion: { type: Number },
    accountIdentityRevision: { type: Number },
    publicationWriteVersion: { type: Number },
    organizationProfileRevision: { type: Number },
    recoveryEmailRequestedAt: { type: Date },
    verificationEmailRequestedAt: { type: Date },
    avatarUrl: { type: String },
    coverUrl: { type: String },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    verificationLevel: {
      type: Number,
      enum: Object.values(VerificationLevel).filter(
        (v) => typeof v === 'number'
      ),
      default: VerificationLevel.NONE,
    },
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    country: { type: String },
    emailVerified: { type: Boolean, default: false },
    organizationName: { type: String, trim: true },
    organizationType: { type: String, enum: Object.values(OrganizationType) },
    registrationNumber: { type: String, trim: true },
    website: { type: String, trim: true },
    needsWebsite: { type: Boolean, default: false },
    websiteRequestedAt: Date,
    websiteRequestWithdrawnAt: Date,
    legalAcceptance: { type: new Schema({ version: String, acceptedTerms: Boolean, ageConfirmed: Boolean, acceptedAt: Date }, { _id: false }) },
    complianceApprovedCampaignLimit: { type: Number },
    deletedAt: { type: Date, index: true },
    deletedBy: { type: String },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
