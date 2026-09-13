import { beforeAll, afterAll, it, expect } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp } from '../helpers/testApp.js'
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { BlogPostModel } from '../../src/infrastructure/database/models/BlogPostModel.js'
let app: Express, token: string, reader: string
const draft = {
  title: 'Community field notes',
  slug: 'community-field-notes',
  excerpt: 'A practical community guide.',
  category: 'Guide',
  authorName: 'Ujimora',
  authorRole: 'Editorial',
  image: 'https://example.test/cover.jpg',
  imageAlt: 'Community members working together',
  body: '# A practical guide\n\n**Useful** information.\n\n- One\n- Two',
  featured: true,
}
beforeAll(async () => {
  await connectTestDatabase()
  app = await createTestApp()
  await BlogPostModel.init()
  const body = {
    email: 'blog-admin@example.test',
    name: 'Editor',
    password: 'SecurePass123',
    legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
  }
  const registered = await request(app).post('/api/v1/auth/register').send(body).expect(201)
  reader = (
    await request(app)
      .post('/api/v1/auth/register')
      .send({ ...body, email: 'blog-reader@example.test' })
      .expect(201)
  ).body.data.tokens.accessToken
  await UserModel.findByIdAndUpdate(registered.body.data.user.id, { role: 'admin' })
  token = (
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200)
  ).body.data.tokens.accessToken
})
afterAll(async () => {
  await dropTestDatabase()
  await disconnectTestDatabase()
})
it('keeps drafts and subsequent edits private, requires complete review revision, and unpublishes without losing the draft', async () => {
  const created = (
    await request(app)
      .post('/api/v1/blog/admin/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft })
      .expect(201)
  ).body.data
  await request(app).get('/api/v1/blog/admin/posts').expect(401)
  expect((await request(app).get('/api/v1/blog').expect(200)).body.data).toEqual([])
  await request(app).get(`/api/v1/blog/${draft.slug}`).expect(404)
  await request(app)
    .post(`/api/v1/blog/admin/posts/${created.id}/publish`)
    .set('Authorization', `Bearer ${token}`)
    .send({ revision: 99 })
    .expect(409)
  const published = (
    await request(app)
      .post(`/api/v1/blog/admin/posts/${created.id}/publish`)
      .set('Authorization', `Bearer ${token}`)
      .send({ revision: 1 })
      .expect(200)
  ).body.data
  expect((await request(app).get(`/api/v1/blog/${draft.slug}`)).body.data.body).toBe(draft.body)
  const updated = (
    await request(app)
      .put(`/api/v1/blog/admin/posts/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        revision: published.revision,
        draft: { ...draft, body: 'Private unfinished revision' },
      })
      .expect(200)
  ).body.data
  const publicRead = (await request(app).get(`/api/v1/blog/${draft.slug}`).expect(200)).body.data
  expect(publicRead.body).toBe(draft.body)
  expect(publicRead).not.toHaveProperty('draft')
  expect(publicRead).not.toHaveProperty('updatedBy')
  await request(app)
    .put(`/api/v1/blog/admin/posts/${created.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ revision: 1, draft })
    .expect(409)
  await request(app)
    .post(`/api/v1/blog/admin/posts/${created.id}/unpublish`)
    .set('Authorization', `Bearer ${token}`)
    .send({ revision: updated.revision })
    .expect(200)
  await request(app).get(`/api/v1/blog/${draft.slug}`).expect(404)
  expect((await request(app).get('/api/v1/blog/sitemap.xml').expect(200)).text).not.toContain(
    `/blog/${draft.slug}`,
  )
  expect(
    (
      await request(app)
        .get(`/api/v1/blog/admin/posts/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
    ).body.data.draft.body,
  ).toBe('Private unfinished revision')
})
it('rejects incomplete publication and unsafe URLs', async () => {
  const created = (
    await request(app)
      .post('/api/v1/blog/admin/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ draft: { ...draft, body: '' } })
      .expect(201)
  ).body.data
  await request(app)
    .post(`/api/v1/blog/admin/posts/${created.id}/publish`)
    .set('Authorization', `Bearer ${token}`)
    .send({ revision: 1 })
    .expect(422)
  await request(app)
    .post('/api/v1/blog/admin/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ draft: { ...draft, image: 'javascript:alert(1)' } })
    .expect(400)
  // A non-admin cannot access draft content.
  expect([401, 403]).toContain(
    (await request(app).get('/api/v1/blog/admin/posts').set('Authorization', `Bearer ${reader}`))
      .status,
  )
})
it('migrates the old journal once and never overwrites edits or republishes withdrawn articles', async () => {
  const { seedBlogIfEmpty } = await import('../../src/infrastructure/database/seedBlog.js')
  await BlogPostModel.deleteMany({})
  await seedBlogIfEmpty()
  expect(await BlogPostModel.countDocuments()).toBe(6)
  expect(
    (await request(app).get('/api/v1/blog/sitemap.xml').expect(200)).text.match(/<url>/g),
  ).toHaveLength(6)
  const post = await BlogPostModel.findOne().orFail()
  await BlogPostModel.updateOne(
    { _id: post._id },
    {
      $set: { 'draft.body': 'An editorial revision' },
      $unset: { published: 1, publishedAt: 1, publishedSlug: 1 },
    },
  )
  await seedBlogIfEmpty()
  expect(await BlogPostModel.countDocuments()).toBe(6)
  const retained = await BlogPostModel.findById(post._id).orFail()
  expect(retained.draft.body).toBe('An editorial revision')
  expect(retained.published).toBeUndefined()
  expect((await request(app).get('/api/v1/blog').expect(200)).body.data).toHaveLength(5)
})
