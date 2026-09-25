import mongoose, { Schema } from 'mongoose';

/**
 * Append-only history of publishing restrictions. ContentRestriction holds the
 * single active record that every enforcement check reads; a second restrict
 * replaces its reason/report, so this log keeps each restrict and restore.
 */
const schema = new Schema({
  userId: { type: String, required: true, index: true },
  action: { type: String, enum: ['restrict', 'restore'], required: true },
  reason: { type: String, required: true },
  actorId: { type: String, required: true },
  reportId: String,
  /** On restore: the restriction that was lifted. */
  liftedReason: String,
  liftedReportId: String,
}, { timestamps: true });
// A report-driven restriction is recorded once, however often its review is retried.
schema.index({ reportId: 1, action: 1 }, { unique: true, partialFilterExpression: { reportId: { $type: 'string' }, action: 'restrict' } });
export const ContentRestrictionEventModel = mongoose.model('ContentRestrictionEvent', schema);
