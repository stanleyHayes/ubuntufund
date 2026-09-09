import mongoose, { Schema } from 'mongoose'
const usageSchema = new Schema({
  userId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  inputLength: { type: Number, required: true },
  outputLength: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'success', 'error'], default: 'pending' },
  model: { type: String, default: '' },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
})
export const AiUsageModel = mongoose.model('AiUsage', usageSchema)
const quotaSchema = new Schema({ _id: String, used: { type: Number, default: 0 }, expiresAt: Date })
quotaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export const AiQuotaModel = mongoose.model('AiQuota', quotaSchema)
