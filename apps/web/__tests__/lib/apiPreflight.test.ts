import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, loginApi } from '@/lib/api'

// The API is a separate origin. A bodyless anonymous GET must stay a CORS
// "simple" request (no Content-Type, no Authorization) so public browsing
// skips the preflight round trip; requests with a JSON body still declare it.
let fetchMock: ReturnType<typeof vi.fn>
const headersOf = (call: number) => (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<string, string>

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } })
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { items: [], total: 0 } })))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

it('sends an anonymous GET without Content-Type or Authorization', async () => {
  await api.get('/campaigns?page=1&pageSize=6')
  expect(headersOf(0)).toEqual({})
})

it('declares JSON only when a body is sent', async () => {
  await api.post('/contact', { message: 'Hello' })
  expect(headersOf(0)).toMatchObject({ 'Content-Type': 'application/json' })
  await api.delete('/profile/saved-thing')
  expect(headersOf(1)['Content-Type']).toBeUndefined()
})

it('still declares JSON on sign-in, which always has a body', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { user: { id: 'u' }, tokens: { accessToken: 'a', refreshToken: 'r' } } })))
  await loginApi('ama@example.test', 'SecurePass123')
  expect(headersOf(0)).toEqual({ 'Content-Type': 'application/json' })
})
