import mongoose, { Schema, type Document } from 'mongoose';

export interface NotificationPreferencesSubdocument {
  email: boolean;
  sms: boolean;
  push: boolean;
  donationReceipts: boolean;
  campaignUpdates: boolean;
  marketingEmails: boolean;
}

export interface ProfileDocument extends Document {
  userId: string;
  phone?: string;
  bio?: string;
  notificationPreferences: NotificationPreferencesSubdocument;
  preferredCurrency: string;
  language: string;
  darkMode: boolean;
  anonymousDonations: boolean;
  showLeaderboards: boolean;
  publicProfile: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationPreferencesSchema = new Schema<NotificationPreferencesSubdocument>(
  {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    donationReceipts: { type: Boolean, default: true },
    campaignUpdates: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false },
  },
  { _id: false }
);

const profileSchema = new Schema<ProfileDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    phone: { type: String },
    bio: { type: String, maxlength: 1000 },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
    preferredCurrency: { type: String, default: 'GHS' },
    language: { type: String, default: 'English' },
    darkMode: { type: Boolean, default: false },
    anonymousDonations: { type: Boolean, default: false },
    showLeaderboards: { type: Boolean, default: true },
    publicProfile: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ProfileModel = mongoose.model<ProfileDocument>(
  'Profile',
  profileSchema
);
