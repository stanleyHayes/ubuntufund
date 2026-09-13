import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  userId: { type: String, required: true, index: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'raw'], required: true },
  format: { type: String, required: true },
  mimeType: { type: String, required: true },
  deletedAt: Date,
  reviewWriteVersion: { type: Number, default: 0 },
}, { timestamps: true });
export const PrivateKycDocumentModel = mongoose.model('PrivateKycDocument', schema);
