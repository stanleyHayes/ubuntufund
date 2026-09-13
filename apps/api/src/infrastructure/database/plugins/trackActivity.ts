import type { Schema } from 'mongoose';

/** The pending marker commits with the financial record, never as a later side effect. */
export function trackActivity(schema: Schema) {
  schema.add({ activityPending: { type: Boolean, default: true }, activityRevision: { type: Number, default: 1 }, activityOccurredAt: { type: Date, default: Date.now }, activityNextCheckAt: { type: Date, default: Date.now } });
  schema.index({ activityPending: 1, activityNextCheckAt: 1 });
  schema.pre('save', function () {
    if (!this.isNew && ['status', 'settlementApplied', 'currentPeriodEnd', 'cancelAtPeriodEnd', 'tier'].some(field => this.isModified(field))) {
      this.set('activityPending', true); this.set('activityOccurredAt', new Date());
      this.set('activityNextCheckAt', new Date());
      this.set('activityRevision', Number(this.get('activityRevision') || 0) + 1);
    }
  });
  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate'] as const) {
    schema.pre(operation, function () {
      const update = this.getUpdate();
      if (!update || Array.isArray(update)) return;
      const changes = update.$set ?? update;
      if (!['status', 'settlementApplied', 'currentPeriodEnd', 'cancelAtPeriodEnd', 'tier'].some(field => field in changes)) return;
      update.$set = { ...update.$set, activityPending: true, activityOccurredAt: new Date(), activityNextCheckAt: new Date() };
      update.$inc = { ...update.$inc, activityRevision: 1 };
      // Upserts must not assign the same field through $inc and $setOnInsert.
      if (update.$setOnInsert) delete update.$setOnInsert.activityRevision;
      this.setUpdate(update);
    });
  }
}
