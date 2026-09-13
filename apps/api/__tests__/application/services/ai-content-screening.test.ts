import { afterEach, expect, it, vi } from 'vitest'
import { AiWritingAction } from '@ubuntu-fund/types'
import { OpenAiWritingProvider } from '../../../src/infrastructure/adapters/outbound/ai/OpenAiWritingProvider.js'
import { OpenAiContentModerator } from '../../../src/infrastructure/adapters/outbound/ai/OpenAiContentModerator.js'

afterEach(() => vi.unstubAllGlobals())
const adapter = () => new OpenAiWritingProvider({ enabled: true, apiKey: 'test-only', model: 'test-model' })
const input = { consentToExternalProcessing: true, action: AiWritingAction.IMPROVE_CLARITY, text: 'Community library project', prompt: 'Use supplied facts only.' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const draft = { status: 'completed', model: 'test-model', output: [{ type: 'message', content: [{ type: 'output_text', text: 'A generated draft for screening.' }] }], usage: { input_tokens: 5, output_tokens: 8 } }

it('screens the complete input and output, returning a draft only after both pass', async () => {
  const fetch = vi.fn(async (url: string) => json(url.endsWith('/moderations') ? { results: [{ flagged: false }] } : draft))
  vi.stubGlobal('fetch', fetch)
  expect(await adapter().write(input)).toMatchObject({ text: 'A generated draft for screening.', outputTokens: 8 })
  const calls = fetch.mock.calls as unknown as [string, RequestInit][]
  expect(calls.map(c => c[0].split('/').pop())).toEqual(['moderations', 'responses', 'moderations'])
  expect(JSON.parse(calls[0][1].body as string)).toMatchObject({ model: 'omni-moderation-latest', input: JSON.stringify({ text: input.text, notes: input.prompt }) })
  expect(JSON.parse(calls[2][1].body as string).input).toBe('A generated draft for screening.')
})

it('withholds a flagged input before calling generation', async () => {
  const fetch = vi.fn(async () => json({ results: [{ flagged: true }] }))
  vi.stubGlobal('fetch', fetch)
  await expect(adapter().write(input)).rejects.toMatchObject({ statusCode: 422 })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('withholds a flagged output without exposing its text in the error', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json({ results: [{ flagged: false }] })).mockResolvedValueOnce(json(draft)).mockResolvedValueOnce(json({ results: [{ flagged: true }] }))
  vi.stubGlobal('fetch', fetch)
  await expect(adapter().write(input)).rejects.toMatchObject({ statusCode: 422, message: expect.not.stringContaining('A generated draft') })
  expect(fetch).toHaveBeenCalledTimes(3)
})

it.each([{}, { results: [] }, { results: [{ flagged: 'false' }] }, { results: [{ flagged: false }, { flagged: false }] }])('does not treat malformed moderation output as approval: %j', async body => {
  vi.stubGlobal('fetch', vi.fn(async () => json(body)))
  await expect(new OpenAiContentModerator('test-only').assertAllowed('Test input')).rejects.toMatchObject({ statusCode: 502 })
})

it('withholds the draft if output screening is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ results: [{ flagged: false }] })).mockResolvedValueOnce(json(draft)).mockResolvedValueOnce(json({ error: 'provider unavailable' }, 503)))
  await expect(adapter().write(input)).rejects.toMatchObject({ statusCode: 502 })
})

it('does not expose transport errors or call the provider without configuration', async () => {
  const fetch = vi.fn(async () => { throw new Error('private-provider-payload') })
  vi.stubGlobal('fetch', fetch)
  await expect(new OpenAiContentModerator('').assertAllowed('Test input')).rejects.toMatchObject({ statusCode: 503 })
  expect(fetch).not.toHaveBeenCalled()
  await expect(new OpenAiContentModerator('test-only').assertAllowed('Test input')).rejects.toMatchObject({ statusCode: 502, message: expect.not.stringContaining('private-provider-payload') })
})
