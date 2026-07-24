import mongoose, { Schema, type Document } from 'mongoose';
import { PaymentMethod } from '@ubuntu-fund/types';

export interface PaymentProviderDocument extends Document {
  name: string;
  slug: string;
  type: PaymentMethod;
  enabled: boolean;
  isDefault: boolean;
  feePercent: number;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const paymentProviderSchema = new Schema<PaymentProviderDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    type: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    enabled: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    feePercent: { type: Number, default: 0, min: 0 },
    displayOrder: { type: Number, default: 0 },
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

export const PaymentProviderModel = mongoose.model<PaymentProviderDocument>(
  'PaymentProvider',
  paymentProviderSchema
);
