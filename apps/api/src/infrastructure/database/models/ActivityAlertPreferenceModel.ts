import mongoose, { Schema } from 'mongoose';

// Legacy profile defaults are deliberately not interpreted as consent.
const schema = new Schema({
  userId: { type: String, required: true, unique: true },
  choices: { type: Map, of: new Schema({ enabled: { type: Boolean, required: true }, enabledAt: Date, changedAt: { type: Date, required: true } }, { _id: false }), default: () => new Map() },
}, { timestamps: true });
export const ActivityAlertPreferenceModel = mongoose.model('ActivityAlertPreference', schema);
