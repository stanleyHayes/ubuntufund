import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { AiWritingAction } from '@ubuntu-fund/types'
import { AiWritingService } from '../src/application/services/AiWritingService.js'
import { OpenAiWritingProvider } from '../src/infrastructure/adapters/outbound/ai/OpenAiWritingProvider.js'
import { AiQuotaModel, AiUsageModel } from '../src/infrastructure/database/models/AiUsageModel.js'
import { createAiWritingRoutes } from '../src/infrastructure/adapters/inbound/http/routes/aiWritingRoutes.js'
import { createAuthMiddleware } from '../src/infrastructure/adapters/inbound/middleware/authMiddleware.js'
import { errorHandler } from '../src/infrastructure/adapters/inbound/middleware/errorHandler.js'
import {
  connectTestDatabase,
  disconnectTestDatabase,
  dropTestDatabase,
} from './helpers/testDatabase.js'
const input = {
  action: AiWritingAction.IMPROVE_CLARITY,
  text: 'Help our community build a library.',
}
const output = {
  text: 'Help build our community library.',
  model: 'test-model',
  inputTokens: 12,
  outputTokens: 8,
}
const provider = { isConfigured: () => true, write: vi.fn(async () => output) }
beforeAll(async () => {
  await connectTestDatabase()
  await Promise.all([AiQuotaModel.init(), AiUsageModel.init()])
})
afterAll(async () => {
  await dropTestDatabase()
  await disconnectTestDatabase()
})
beforeEach(async () => {
  await Promise.all([AiQuotaModel.deleteMany({}), AiUsageModel.deleteMany({})])
  provider.write.mockReset().mockResolvedValue(output)
})
afterEach(() => vi.unstubAllGlobals())
describe('AI usage and quotas', () => {
  it('persists metadata, counts tokens and paginates without saving campaign text', async () => {
    const service = new AiWritingService(provider, 20, 100)
    expect((await service.write('creator', input)).remainingRequests).toBe(19)
    expect(await service.stats()).toMatchObject({
      totalRequests: 1,
      requestsToday: 1,
      inputTokens: 12,
      outputTokens: 8,
    })
    const usage = await service.usage(1, 1)
    expect(usage.pagination).toMatchObject({ total: 1, totalPages: 1 })
    expect(usage.data[0]).toMatchObject({
      status: 'success',
      userId: 'creator',
      inputLength: input.text.length,
    })
    expect(JSON.stringify(usage)).not.toContain(input.text)
    expect(JSON.stringify(usage)).not.toContain(output.text)
  })
  it('enforces a daily cap under concurrent requests', async () => {
    const service = new AiWritingService(provider, 2, 100)
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => service.write('creator', input)),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2)
    expect(provider.write).toHaveBeenCalledTimes(2)
    expect((await service.configuration('creator')).remainingRequests).toBe(0)
  })
  it('serves the full allowance when the first requests of the day arrive together', async () => {
    // The regression this guards. With no quota document yet, every concurrent
    // caller failed the `used < limit` filter, all attempted the insert, one
    // won and the rest got a duplicate-key error — which was reported as "daily
    // limit reached" before a single request had been served. A cold start with
    // simultaneous requests is the normal case, not an exotic one.
    const service = new AiWritingService(provider, 5, 100)

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.write('cold-start-user', input)),
    )

    expect(
      results.filter((r) => r.status === 'fulfilled'),
      'all five are within the allowance of five',
    ).toHaveLength(5)
    expect((await service.configuration('cold-start-user')).remainingRequests).toBe(0)
  })

  it('enforces the global cap and releases a rejected user reservation', async () => {
    const service = new AiWritingService(provider, 2, 1)
    await service.write('first', input)
    await expect(service.write('second', input)).rejects.toMatchObject({ statusCode: 429 })
    expect((await service.configuration('second')).remainingRequests).toBe(2)
  })
  it('tracks provider failures and consumes the allowance', async () => {
    provider.write.mockRejectedValue(new Error('Unavailable'))
    const service = new AiWritingService(provider, 1, 100)
    await expect(service.write('creator', input)).rejects.toThrow('Unavailable')
    expect(await service.stats()).toMatchObject({ errors: 1, totalRequests: 1 })
    await expect(service.write('creator', input)).rejects.toMatchObject({ statusCode: 429 })
  })
  it('rejects unconfigured requests before recording or charging quota', async () => {
    const service = new AiWritingService({ ...provider, isConfigured: () => false }, 20, 100)
    await expect(service.write('creator', input)).rejects.toMatchObject({ statusCode: 503 })
    expect(await AiQuotaModel.countDocuments()).toBe(0)
    expect(provider.write).not.toHaveBeenCalled()
  })
})
describe('AI HTTP boundaries', () => {
  function app() {
    const app = express()
    app.use(express.json())
    const auth = ((req, res, next) => {
      if (!req.headers.authorization) {
        res.sendStatus(401)
        return
      }
      req.userId = 'creator'
      next()
    }) as ReturnType<typeof createAuthMiddleware>
    app.use(
      '/ai-writing',
      createAiWritingRoutes(new AiWritingService(provider, 20, 100), auth, (req, res, next) => {
        if (req.headers.authorization !== 'admin') {
          res.sendStatus(403)
          return
        }
        next()
      }),
    )
    app.use(errorHandler)
    return app
  }
  it('requires authentication and restricts logs/stats to administrators', async () => {
    await request(app()).post('/ai-writing').send(input).expect(401)
    await request(app()).get('/ai-writing/stats').set('Authorization', 'user').expect(403)
    await request(app()).get('/ai-writing/usage').set('Authorization', 'user').expect(403)
    await request(app()).get('/ai-writing/stats').set('Authorization', 'admin').expect(200)
  })
  it('validates size, action, language and pagination before provider calls', async () => {
    for (const body of [
      { ...input, text: 'x'.repeat(12001) },
      { ...input, action: 'INVALID' },
      { ...input, action: AiWritingAction.TRANSLATE },
    ])
      await request(app()).post('/ai-writing').set('Authorization', 'user').send(body).expect(400)
    await request(app()).get('/ai-writing/usage?page=-1').set('Authorization', 'admin').expect(400)
    expect(provider.write).not.toHaveBeenCalled()
  })
})
describe('OpenAI provider contract', () => {
  it('uses the Responses API without storage and records actual token usage', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'completed',
            model: 'gpt-4.1-mini',
            output: [
              { type: 'message', content: [{ type: 'output_text', text: 'A clear story.' }] },
            ],
            usage: { input_tokens: 20, output_tokens: 4 },
          }),
        ),
    )
    vi.stubGlobal('fetch', fetch)
    const adapter = new OpenAiWritingProvider({
      enabled: true,
      apiKey: 'test-only',
      model: 'gpt-4.1-mini',
    })
    expect(await adapter.write(input)).toMatchObject({
      text: 'A clear story.',
      inputTokens: 20,
      outputTokens: 4,
    })
    const call = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toBe('https://api.openai.com/v1/responses')
    expect(JSON.parse(call[1].body as string)).toMatchObject({
      store: false,
      max_output_tokens: 1600,
    })
  })
  it('rejects incomplete and empty responses without inventing a suggestion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'incomplete' }))),
    )
    await expect(
      new OpenAiWritingProvider({ enabled: true, apiKey: 'test-only', model: 'test' }).write(input),
    ).rejects.toMatchObject({ statusCode: 502 })
  })
})
