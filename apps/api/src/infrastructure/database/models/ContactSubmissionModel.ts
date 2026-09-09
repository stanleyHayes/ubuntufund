import mongoose, { Schema, type Document } from 'mongoose';

type ContactStatus = 'new' | 'in_progress' | 'resolved' | 'archived';

export interface ContactSubmissionDocument extends Document {
  name: string; email: string; subject: string;
  inquiryType: 'general' | 'partnership' | 'campaign' | 'bug';
  message: string; status: ContactStatus; adminNotes?: string;
  resolvedAt?: Date; createdAt: Date; updatedAt: Date;
}

const contactSubmissionSchema = new Schema<ContactSubmissionDocument>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  inquiryType: { type: String, enum: ['general', 'partnership', 'campaign', 'bug'], required: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  status: { type: String, enum: ['new', 'in_progress', 'resolved', 'archived'], default: 'new' },
  adminNotes: { type: String, trim: true, maxlength: 5000 },
  resolvedAt: { type: Date },
}, { collection: 'contactsubmissions', timestamps: true });

contactSubmissionSchema.index({ status: 1, inquiryType: 1, createdAt: -1 });
export const ContactSubmissionModel = mongoose.model<ContactSubmissionDocument>('ContactSubmission', contactSubmissionSchema);
