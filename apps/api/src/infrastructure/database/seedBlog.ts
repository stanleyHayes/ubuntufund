import mongoose from 'mongoose'
import { BlogPostModel } from './models/BlogPostModel.js'
import defaults from './blogPostDefaults.json'
/** Preserve the previously public static journal on the first CMS deployment.
 * One transaction; never overwrites drafts or repopulates unpublished articles.
 */
export async function seedBlogIfEmpty(): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    if (await BlogPostModel.countDocuments().session(session)) return
    await BlogPostModel.insertMany(
      defaults.map(({ publishedAt, ...draft }) => ({
        draft,
        published: draft,
        publishedSlug: draft.slug,
        publishedAt: new Date(publishedAt),
        revision: 1,
        updatedBy: 'migration:static-blog',
      })),
      { session },
    )
  })
}
