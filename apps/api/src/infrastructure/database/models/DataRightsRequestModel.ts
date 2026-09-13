import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  userId: { type: String, required: true, index: true },
  kind: { type: String, enum: ['access', 'correction', 'complaint'], required: true },
  details: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: ['open', 'in_review', 'responded'], default: 'open', index: true },
  active: { type: Boolean, default: true },
  response: { type: String, default: '', maxlength: 100000 },
  revision: { type: Number, default: 0 },
  dueAt: { type: Date, required: true, index: true },
  respondedAt: Date,
  deliveryMethod: { type: String, enum: ['account', 'verified_external'] },
}, { timestamps: true });
// One unresolved request of each kind per account, including concurrent submissions.
schema.index({ userId: 1, kind: 1 }, { unique: true, partialFilterExpression: { active: true } });
export const DataRightsRequestModel = mongoose.model('DataRightsRequest', schema);

const eventSchema = new Schema({
  requestId: { type: String, required: true, index: true },
  actorId: { type: String, required: true },
  action: { type: String, enum: ['submitted', 'in_review', 'responded'], required: true },
  revision: { type: Number, required: true },
  // Restricted operational evidence; never included in the requester DTO.
  evidence: { type: String, default: '', maxlength: 5000 },
  deliveryReference: { type: String, maxlength: 1000 },
}, { timestamps: { createdAt: true, updatedAt: false } });
eventSchema.index({ requestId: 1, revision: 1 }, { unique: true });
export const DataRightsEventModel = mongoose.model('DataRightsEvent', eventSchema);
