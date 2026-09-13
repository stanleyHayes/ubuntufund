import mongoose, { Schema } from 'mongoose'
import type { BlogDraft } from '@ubuntu-fund/types'
const draft = new Schema<BlogDraft>(
  {
    title: String,
    slug: String,
    excerpt: String,
    category: String,
    authorName: String,
    authorRole: String,
    image: String,
    imageAlt: String,
    body: String,
    featured: Boolean,
  },
  { _id: false },
)
const schema = new Schema(
  {
    draft: { type: draft, required: true },
    published: { type: draft, default: undefined },
    publishedAt: Date,
    publishedSlug: { type: String, unique: true, sparse: true },
    revision: { type: Number, default: 1 },
    updatedBy: String,
  },
  { timestamps: true, collection: 'blogposts' },
)
export const BlogPostModel = mongoose.model('BlogPost', schema)
