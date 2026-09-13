import { Router, type RequestHandler } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { BlogPostModel } from '../../../../database/models/BlogPostModel.js'
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js'
import { AppError } from '../../middleware/errorHandler.js'
const draftSchema = z
  .object({
    title: z.string().max(180),
    slug: z
      .string()
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .or(z.literal('')),
    excerpt: z.string().max(500),
    category: z.string().max(60),
    authorName: z.string().max(100),
    authorRole: z.string().max(100),
    image: z
      .string()
      .url()
      .max(2000)
      .refine((v) => new URL(v).protocol === 'https:')
      .or(z.literal('')),
    imageAlt: z.string().max(300),
    body: z.string().max(150000),
    featured: z.boolean(),
  })
  .strict()
const revisionSchema = z.object({ revision: z.number().int().positive() })
const wrap =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) =>
      next(
        error instanceof z.ZodError
          ? new AppError(error.issues.map((issue) => issue.message).join('; '), 400)
          : error,
      ),
    )
  }
const article = (doc: InstanceType<typeof BlogPostModel>) => ({
  ...doc.toObject().published!,
  id: String(doc._id),
  publishedAt: doc.publishedAt!.toISOString(),
  readTime: Math.max(1, Math.ceil((doc.published?.body ?? '').split(/\s+/).length / 200)),
})
const record = (doc: InstanceType<typeof BlogPostModel>) => ({
  id: String(doc._id),
  draft: doc.toObject().draft,
  revision: doc.revision,
  published: doc.published ? article(doc) : undefined,
  updatedAt: doc.updatedAt,
})
export function createBlogRoutes(auth: RequestHandler, admin: RequestHandler) {
  const router = Router()
  router.get(
    '/',
    wrap(async (_req, res) => {
      const docs = await BlogPostModel.find({ publishedSlug: { $exists: true } }).sort({
        publishedAt: -1,
      })
      res.json({ data: docs.map(article) })
    }),
  )
  router.get(
    '/sitemap.xml',
    wrap(async (_req, res) => {
      const posts = await BlogPostModel.find({ publishedSlug: { $exists: true } })
        .select('publishedSlug updatedAt')
        .lean()
      const urls = posts
        .map(
          (post) =>
            `<url><loc>https://ujimora.com/blog/${encodeURIComponent(post.publishedSlug!)}</loc><lastmod>${post.updatedAt.toISOString()}</lastmod></url>`,
        )
        .join('')
      res
        .type('application/xml')
        .send(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
        )
    }),
  )
  router.get(
    '/admin/posts',
    auth,
    admin,
    wrap(async (_req, res) => {
      const docs = await BlogPostModel.find().sort({ updatedAt: -1 })
      res.json({ data: docs.map(record) })
    }),
  )
  router.post(
    '/admin/posts',
    auth,
    admin,
    wrap(async (req, res) => {
      const draft = draftSchema.parse(req.body.draft)
      const doc = await BlogPostModel.create({
        draft,
        updatedBy: (req as AuthenticatedRequest).userId,
      })
      res.status(201).json({ data: record(doc) })
    }),
  )
  router.use('/admin/posts/:id', auth, admin, (req, _res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id))
      return next(new AppError('Article not found', 404))
    next()
  })
  router.get(
    '/admin/posts/:id',
    wrap(async (req, res) => {
      const doc = await BlogPostModel.findById(req.params.id)
      if (!doc) throw new AppError('Article not found', 404)
      res.json({ data: record(doc) })
    }),
  )
  router.put(
    '/admin/posts/:id',
    wrap(async (req, res) => {
      const { revision } = revisionSchema.parse(req.body),
        draft = draftSchema.parse(req.body.draft)
      const doc = await BlogPostModel.findOneAndUpdate(
        { _id: req.params.id, revision },
        { $set: { draft, updatedBy: (req as AuthenticatedRequest).userId }, $inc: { revision: 1 } },
        { new: true },
      )
      if (!doc)
        throw new AppError('This draft changed in another session. Reload before saving.', 409)
      res.json({ data: record(doc) })
    }),
  )
  router.post(
    '/admin/posts/:id/publish',
    wrap(async (req, res) => {
      const { revision } = revisionSchema.parse(req.body)
      const doc = await BlogPostModel.findOne({ _id: req.params.id, revision })
      if (!doc) throw new AppError('The draft changed. Save and review the latest version.', 409)
      const d = draftSchema.parse(doc.toObject().draft)
      if (
        ![d.title, d.slug, d.excerpt, d.category, d.authorName, d.image, d.imageAlt, d.body].every(
          (v) => v.trim(),
        )
      )
        throw new AppError(
          'Complete the article details, body and accessible cover image before publishing.',
          422,
        )
      try {
        const saved = await BlogPostModel.findOneAndUpdate(
          { _id: doc._id, revision },
          {
            $set: {
              published: d,
              publishedSlug: d.slug,
              publishedAt: doc.publishedAt ?? new Date(),
              updatedBy: (req as AuthenticatedRequest).userId,
            },
            $inc: { revision: 1 },
          },
          { new: true },
        )
        if (!saved) throw new AppError('The draft changed. Review it again.', 409)
        res.json({ data: record(saved) })
      } catch (error) {
        if ((error as { code?: number }).code === 11000)
          throw new AppError('That article URL is already published. Choose another slug.', 409)
        throw error
      }
    }),
  )
  router.post(
    '/admin/posts/:id/unpublish',
    wrap(async (req, res) => {
      const { revision } = revisionSchema.parse(req.body)
      const doc = await BlogPostModel.findOneAndUpdate(
        { _id: req.params.id, revision },
        { $unset: { published: 1, publishedSlug: 1, publishedAt: 1 }, $inc: { revision: 1 } },
        { new: true },
      )
      if (!doc) throw new AppError('The article changed. Reload and try again.', 409)
      res.json({ data: record(doc) })
    }),
  )
  router.get(
    '/:slug',
    wrap(async (req, res) => {
      const doc = await BlogPostModel.findOne({ publishedSlug: req.params.slug })
      if (!doc) throw new AppError('Article not found', 404)
      res.json({ data: article(doc) })
    }),
  )
  return router
}
