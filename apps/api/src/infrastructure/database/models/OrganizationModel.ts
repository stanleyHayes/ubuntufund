import mongoose, { Schema, type Document } from 'mongoose';
import { UserRole, VerificationLevel, OrganizationType } from '@ubuntu-fund/types';

/**
 * Organizations live in the same `users` collection as everyone else
 * (role=organization, plus organization-specific fields). Rather than editing
 * the existing UserModel/UserDocument, this declares a second Mongoose model
 * bound to the same underlying collection so the organizations slice can read
 * the organization-only fields without touching code outside this slice.
 */
export interface OrganizationUserDocument extends Document {
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  verificationLevel: VerificationLevel;
  country?: string;
  emailVerified: boolean;
  organizationName?: string;
  organizationType?: OrganizationType;
  registrationNumber?: string;
  website?: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationUserSchema = new Schema<OrganizationUserDocument>(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
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
    country: { type: String },
    emailVerified: { type: Boolean, default: false },
    organizationName: { type: String },
    organizationType: {
      type: String,
      enum: Object.values(OrganizationType),
    },
    registrationNumber: { type: String },
    website: { type: String },
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

export const OrganizationUserModel = mongoose.model<OrganizationUserDocument>(
  'OrganizationUser',
  organizationUserSchema,
  'users' // shares the collection with UserModel — read-only projection
);
