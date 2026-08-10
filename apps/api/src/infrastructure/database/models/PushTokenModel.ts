import mongoose, { Schema, type Document } from 'mongoose';

export interface PushTokenDocument extends Document {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  disabledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<PushTokenDocument>({
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
  disabledAt: { type: Date, default: null, index: true },
}, { collection: 'pushtokens', timestamps: true });

pushTokenSchema.index({ userId: 1, disabledAt: 1 });
export const PushTokenModel = mongoose.model<PushTokenDocument>('PushToken', pushTokenSchema);
