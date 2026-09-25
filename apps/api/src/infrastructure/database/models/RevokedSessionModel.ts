import mongoose, { Schema } from 'mongoose';

/**
 * Sessions signed out on the server. Every token pair carries a session id
 * (`sid`) that survives refreshes; once revoked, no token in that session can
 * be refreshed. Rows expire after the longest refresh-token lifetime.
 */
const schema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  revokedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { collection: 'revoked_sessions' });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RevokedSessionModel = mongoose.model('RevokedSession', schema);
