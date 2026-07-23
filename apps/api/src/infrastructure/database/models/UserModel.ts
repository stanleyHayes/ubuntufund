import mongoose, { Schema, type Document } from 'mongoose';
import { UserRole, VerificationLevel } from '@ubuntu-fund/types';

export interface UserDocument extends Document {
  email: string;
  name: string;
  passwordHash: string;
  avatarUrl?: string;
  role: UserRole;
  verificationLevel: VerificationLevel;
  trustScore: number;
  country?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
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
    trustScore: { type: Number, default: 50, min: 0, max: 100 },
    country: { type: String },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
