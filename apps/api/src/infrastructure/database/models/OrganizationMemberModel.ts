import mongoose, { Schema } from 'mongoose'
const schema = new Schema(
  {
    organizationId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    userId: String,
    role: { type: String, enum: ['admin', 'editor', 'viewer'], required: true },
    status: { type: String, enum: ['invited', 'active', 'revoked'], required: true },
    invitedBy: { type: String, required: true },
    expiresAt: Date,
  },
  { timestamps: true },
)
schema.index({ organizationId: 1, email: 1 }, { unique: true })
export const OrganizationMemberModel = mongoose.model('OrganizationMember', schema)
