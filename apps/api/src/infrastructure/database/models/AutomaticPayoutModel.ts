import mongoose, { Schema } from 'mongoose'
export const automaticPayoutDefaults = {
  enabled: false,
  maxAmount: 500,
  dailyOwnerLimit: 1000,
  dailyPlatformLimit: 5000,
  reviewMaxAgeDays: 30,
  mobileMoneyMaxAmount: 250,
  mobileMoneyReviewMaxAgeHours: 24,
}
export type AutomaticPayoutPolicy = typeof automaticPayoutDefaults
const policySchema = new Schema(
  {
    _id: String,
    enabled: Boolean,
    maxAmount: Number,
    dailyOwnerLimit: Number,
    dailyPlatformLimit: Number,
    reviewMaxAgeDays: Number,
    mobileMoneyMaxAmount: Number,
    mobileMoneyReviewMaxAgeHours: Number,
    updatedBy: String,
    revision: { type: Number, default: 0 },
    claims: { type: Number, default: 0 },
    history: [Schema.Types.Mixed],
  },
  { timestamps: true },
)
export const AutomaticPayoutPolicyModel = mongoose.model('AutomaticPayoutPolicy', policySchema)
export const AutomaticPayoutBudgetModel = mongoose.model(
  'AutomaticPayoutBudget',
  new Schema({ _id: String, usedMinor: { type: Number, default: 0 } }),
)
