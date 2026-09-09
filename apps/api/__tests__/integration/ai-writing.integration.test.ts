import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, it } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../helpers/testApp.js'
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { AiWritingAction } from '@ubuntu-fund/types'
process.env.AI_WRITING_ENABLED = 'false'
beforeAll(connectTestDatabase)
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase() })
it('mounts the real AI routes with session and administrator checks', async () => {
  const app = await createTestApp()
  await request(app).get('/api/v1/ai-writing/config').expect(401)
  const email = `ai-${randomUUID()}@example.test`, password = 'SecurePass123'
  const signup = await request(app).post('/api/v1/auth/register').send({ email, password, name: 'AI Test' }).expect(201)
  const token = signup.body.data.tokens.accessToken
  const configuration = await request(app).get('/api/v1/ai-writing/config').set('Authorization', `Bearer ${token}`).expect(200)
  expect(configuration.body.data.enabled).toBe(false)
  await request(app).post('/api/v1/ai-writing').set('Authorization', `Bearer ${token}`).send({ text: 'An honest campaign story.', action: AiWritingAction.IMPROVE_CLARITY }).expect(503)
  await request(app).get('/api/v1/ai-writing/stats').set('Authorization', `Bearer ${token}`).expect(403)
  await UserModel.findByIdAndUpdate(signup.body.data.user.id, { role: 'admin' })
  const login = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200)
  const admin = login.body.data.tokens.accessToken
  const stats = await request(app).get('/api/v1/ai-writing/stats').set('Authorization', `Bearer ${admin}`).expect(200)
  expect(stats.body.data).toMatchObject({ totalRequests: 0, enabled: false })
  const usage = await request(app).get('/api/v1/ai-writing/usage').set('Authorization', `Bearer ${admin}`).expect(200)
  expect(usage.body.data).toMatchObject({ data: [], pagination: { total: 0 } })
})
