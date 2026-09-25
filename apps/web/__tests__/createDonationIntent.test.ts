import { afterEach, expect, it, vi } from 'vitest'
import { createDonationIntent } from '../src/lib/fundraising'

afterEach(() => { vi.unstubAllGlobals() })

function stubFetch() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } })
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { intent: { id: 'i1', status: 'PENDING' }, authorization_url: 'https://checkout.paystack.com/x', reference: 'uf-i1-a' } }), { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const input = { campaignId: 'c1', amount: 50, provider: 'paystack' as const, donorEmail: 'd@example.test' }
const sentKey = (fetchMock: ReturnType<typeof stubFetch>, call: number) =>
  ((fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].headers as Record<string, string>)['Idempotency-Key']

// I041: a retry must be able to reuse the attempt's key.
it('sends the caller-supplied Idempotency-Key on every retry', async () => {
  const fetchMock = stubFetch()
  await createDonationIntent(input, 'attempt-key-1')
  await createDonationIntent(input, 'attempt-key-1')
  expect(sentKey(fetchMock, 0)).toBe('attempt-key-1')
  expect(sentKey(fetchMock, 1)).toBe('attempt-key-1')
})

it('falls back to a fresh key when none is supplied', async () => {
  const fetchMock = stubFetch()
  await createDonationIntent(input)
  await createDonationIntent(input)
  expect(sentKey(fetchMock, 0)).toMatch(/^[0-9a-f-]{36}$/)
  expect(sentKey(fetchMock, 0)).not.toBe(sentKey(fetchMock, 1))
})
