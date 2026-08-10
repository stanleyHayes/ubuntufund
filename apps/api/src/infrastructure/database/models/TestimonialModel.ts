import mongoose, { Schema, type Document } from 'mongoose';

export type TestimonialStatus = 'draft' | 'published' | 'archived';

export interface TestimonialDocument extends Document {
  name: string;
  role: string;
  location: string;
  quote: string;
  rating: number;
  avatarUrl?: string;
  avatarColor: string;
  status: TestimonialStatus;
  displayOrder: number;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const testimonialSchema = new Schema<TestimonialDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, trim: true, maxlength: 160 },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    quote: { type: String, required: true, trim: true, maxlength: 1200 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    avatarUrl: { type: String, trim: true },
    avatarColor: { type: String, required: true, default: '#2E3D2F' },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    displayOrder: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { collection: 'testimonials', timestamps: true }
);

testimonialSchema.index({ status: 1, displayOrder: 1, createdAt: -1 });

export const TestimonialModel = mongoose.model<TestimonialDocument>(
  'Testimonial',
  testimonialSchema
);
