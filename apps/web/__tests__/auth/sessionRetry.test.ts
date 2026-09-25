import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { SESSION_EXPIRED } from '@/lib/session'

// Server time runs 20 minutes ahead of this device: the API has already
// expired a token the device still believes has 5 minutes left.
const serverNow = () => Date.now() + 20 * 60000
const issued = (lifetimeSeconds = 15 * 60, iatShift = -15 * 60) => {
  const iat = Math.floor(serverNow() / 1000) + iatShift
  return `header.${btoa(JSON.stringify({ iat, exp: iat + lifetimeSeconds }))}.signature`
}
let expired: ReturnType<typeof vi.fn>
beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } })
  localStorage.setItem('uf_user', JSON.stringify({ id: 'member' }))
  localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'stale-access', refreshToken: 'refresh' }))
  localStorage.setItem('uf_last_activity', String(Date.now()))
  expired = vi.fn()
  window.addEventListener(SESSION_EXPIRED, expired)
})
afterEach(() => { window.removeEventListener(SESSION_EXPIRED, expired); vi.unstubAllGlobals() })

function server(refreshStatus = 200) {
  const fresh = issued(15 * 60, 0)
  return {
    fresh,
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return refreshStatus === 200
        ? new Response(JSON.stringify({ data: { accessToken: fresh, refreshToken: 'next' } }))
        : new Response('{}', { status: refreshStatus })
      const auth = (init?.headers as Record<string, string>)?.Authorization
      return auth === `Bearer ${fresh}` ? new Response(JSON.stringify({ data: { ok: true } })) : new Response(JSON.stringify({ message: 'Invalid or expired access token' }), { status: 401 })
    }),
  }
}
const refreshes = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')).length

it('renews once and retries a request the server rejected, without signing out', async () => {
  const { fetch, fresh } = server()
  vi.stubGlobal('fetch', fetch)
  expect(await api.get('/profile')).toEqual({ ok: true })
  expect(refreshes(fetch)).toBe(1)
  expect(JSON.parse(localStorage.getItem('uf_tokens')!).accessToken).toBe(fresh)
  expect(expired).not.toHaveBeenCalled()
})

it('shares one renewal between parallel rejected requests', async () => {
  const { fetch } = server()
  vi.stubGlobal('fetch', fetch)
  expect(await Promise.all([api.get('/profile'), api.get('/notifications'), api.post('/views', {})])).toEqual([{ ok: true }, { ok: true }, { ok: true }])
  expect(refreshes(fetch)).toBe(1)
  expect(expired).not.toHaveBeenCalled()
})

it('signs out when the renewal itself is refused', async () => {
  const { fetch } = server(401)
  vi.stubGlobal('fetch', fetch)
  await expect(api.get('/profile')).rejects.toMatchObject({ status: 401 })
  expect(refreshes(fetch)).toBe(1)
  expect(expired).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem('uf_tokens')).toBeNull()
})

it('keeps the session when renewal fails for lack of a connection', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/auth/refresh')) throw new TypeError('Failed to fetch')
    return new Response('{}', { status: 401 })
  }))
  await expect(api.get('/profile')).rejects.toMatchObject({ status: 0 })
  expect(expired).not.toHaveBeenCalled()
  expect(localStorage.getItem('uf_tokens')).not.toBeNull()
})

it('does not retry more than once', async () => {
  const fetch = vi.fn(async (url: string) => url.endsWith('/auth/refresh')
    ? new Response(JSON.stringify({ data: { accessToken: issued(15 * 60, 0), refreshToken: 'next' } }))
    : new Response('{}', { status: 401 }))
  vi.stubGlobal('fetch', fetch)
  await expect(api.get('/profile')).rejects.toMatchObject({ status: 401 })
  expect(refreshes(fetch)).toBe(1)
  expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/profile'))).toHaveLength(2)
  expect(expired).toHaveBeenCalledTimes(1)
})
