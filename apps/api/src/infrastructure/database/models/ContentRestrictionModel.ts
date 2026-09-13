import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  userId: { type: String, required: true, unique: true },
  reason: { type: String, required: true },
  restrictedBy: { type: String, required: true },
  reportId: String,
}, { timestamps: true });
export const ContentRestrictionModel = mongoose.model('ContentRestriction', schema);
