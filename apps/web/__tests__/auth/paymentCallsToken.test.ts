import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDonationIntent } from '@/lib/fundraising'
import { createSubscriptionCheckout } from '@/lib/subscriptions'
import { getAffiliateDashboard } from '@/lib/affiliate'
import { browserSession } from '@/lib/session'

// R2-050: donation, subscription and affiliate calls read the token through
// their own helper. It threw when storage was blocked, and it preferred the
// legacy 'accessToken' key, which renewals wrote but replaceTokens (password
// change, MFA) never updated, so a revoked token was sent.

afterEach(() => { vi.unstubAllGlobals() })

const intentInput = { campaignId: 'c1', amount: 50, provider: 'paystack' as const, donorEmail: 'd@example.test' }
const checkout = { data: { intent: { id: 'i1', status: 'PENDING' }, authorization_url: 'https://checkout.paystack.com/x', reference: 'uf-i1-a' } }

function memoryStorage() {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
  vi.stubGlobal('localStorage', storage)
  return storage
}
const authorization = (fetch: ReturnType<typeof vi.fn>, call = 0) =>
  ((fetch.mock.calls[call] as [string, RequestInit])[1].headers as Record<string, string>).Authorization

describe('storage unavailable', () => {
  const blocked = () => { throw new DOMException('The operation is insecure.', 'SecurityError') }
  it.each([
    ['site data blocked (SecurityError)', { getItem: blocked, setItem: blocked, removeItem: blocked }],
    ['DOM storage off (localStorage is null)', null],
  ])('a guest can still start a donation checkout: %s', async (_, storage) => {
    vi.stubGlobal('localStorage', storage)
    const fetch = vi.fn(async () => new Response(JSON.stringify(checkout), { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    const result = await createDonationIntent(intentInput, 'attempt-key-1')
    expect(result.authorization_url).toBe('https://checkout.paystack.com/x')
    expect(authorization(fetch)).toBeUndefined()
  })
})

describe('after the session tokens are replaced', () => {
  it('sends the current token, never an older copy left in the legacy key', async () => {
    const storage = memoryStorage()
    storage.setItem('accessToken', 'revoked-before-password-change')
    storage.setItem('uf_tokens', JSON.stringify({ accessToken: 'current', refreshToken: 'refresh' }))
    storage.setItem('uf_last_activity', String(Date.now()))
    const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(
      url.endsWith('/donation-intents') ? checkout : { data: { authorizationUrl: 'https://checkout.paystack.com/s' } },
    ), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await createDonationIntent(intentInput, 'attempt-key-1')
    await createSubscriptionCheckout({ planId: 'plan', billingCycle: 'monthly' } as never)
    await getAffiliateDashboard()
    expect([0, 1, 2].map((call) => authorization(fetch, call))).toEqual(['Bearer current', 'Bearer current', 'Bearer current'])
  })

  it('renews and retries a rejected token like every other signed-in call', async () => {
    const storage = memoryStorage()
    storage.setItem('uf_tokens', JSON.stringify({ accessToken: 'stale', refreshToken: 'refresh' }))
    storage.setItem('uf_last_activity', String(Date.now()))
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return new Response(JSON.stringify({ data: { accessToken: 'fresh', refreshToken: 'next' } }))
      const auth = (init?.headers as Record<string, string>).Authorization
      return auth === 'Bearer fresh'
        ? new Response(JSON.stringify({ data: { authorizationUrl: 'https://checkout.paystack.com/s' } }))
        : new Response(JSON.stringify({ message: 'Your session has ended. Please sign in again.' }), { status: 401 })
    })
    vi.stubGlobal('fetch', fetch)
    await expect(createSubscriptionCheckout({ planId: 'plan', billingCycle: 'monthly' } as never))
      .resolves.toEqual({ authorizationUrl: 'https://checkout.paystack.com/s' })
    expect(browserSession.accessToken()).toBe('fresh')
    // Renewal no longer mirrors the token into the legacy key.
    expect(storage.getItem('accessToken')).toBeNull()
  })
})
