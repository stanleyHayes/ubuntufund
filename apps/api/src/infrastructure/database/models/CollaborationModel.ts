import mongoose, { Schema, type Document } from 'mongoose';
import { CollaboratorRole, CollaborationStatus } from '@ubuntu-fund/types';

export interface CollaborationDocument extends Document {
  campaignId: string;
  userId: string;
  invitedBy: string;
  role: CollaboratorRole;
  status: CollaborationStatus;
  revenueSharePercent: number;
  displayName: string;
  logoUrl?: string;
  inviteMessage?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const collaborationSchema = new Schema<CollaborationDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    invitedBy: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(CollaboratorRole),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CollaborationStatus),
      default: CollaborationStatus.PENDING,
      index: true,
    },
    revenueSharePercent: { type: Number, required: true, min: 0, max: 100 },
    displayName: { type: String, required: true },
    logoUrl: { type: String },
    inviteMessage: { type: String },
    respondedAt: { type: Date },
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

// A user can only have one collaboration record per campaign at a time
// (invite/reinvite always reuses the existing record instead of creating a
// new one — see InviteCollaboratorUseCase), so this must be enforced as a
// unique index, matching the convention used by WalletModel/ReportModel for
// equivalent one-record-per-pair invariants.
collaborationSchema.index({ campaignId: 1, userId: 1 }, { unique: true });

export const CollaborationModel = mongoose.model<CollaborationDocument>(
  'Collaboration',
  collaborationSchema
);
