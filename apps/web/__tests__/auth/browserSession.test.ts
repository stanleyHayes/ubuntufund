import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createBrowserSession } from '@ubuntu-fund/ui/src/browserSession'
const HOUR = 3600000
const jwt = (expires: number) => `header.${btoa(JSON.stringify({ exp: expires / 1000 }))}.signature`
let session: ReturnType<typeof createBrowserSession>
let stop: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(1800000000000)
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  session = createBrowserSession({ tokensKey: 'tokens', userKey: 'user', legacyKeys: [], activityKey: 'active', expiredEvent: 'expired', changedEvent: 'changed', refreshUrl: '/auth/refresh' })
  localStorage.setItem('user', '{}')
  localStorage.setItem('tokens', JSON.stringify({ accessToken: jwt(Date.now() + 15 * 60000), refreshToken: 'refresh' }))
  session.resetActivity()
})
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })
describe('active browser sessions', () => {
  it('renews an expiring access token once for simultaneous requests without resetting idle time', async () => {
    vi.setSystemTime(Date.now() + 14 * 60000)
    const lastActivity = localStorage.getItem('active'), renewed = jwt(Date.now() + 15 * 60000)
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: renewed, refreshToken: 'next' } })))
    vi.stubGlobal('fetch', fetch)
    expect(await Promise.all([session.ensureAccessToken(), session.ensureAccessToken()])).toEqual([renewed, renewed])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('active')).toBe(lastActivity)
  })
  it('stays signed in with interaction beyond the original token lifetime', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: jwt(Date.now() + 15 * 60000), refreshToken: 'next' } }))))
    stop = session.start(vi.fn())
    for (let i = 0; i < 8; i++) { await vi.advanceTimersByTimeAsync(10 * 60000); window.dispatchEvent(new Event('pointerdown')) }
    expect(session.accessToken()).not.toBeNull()
  })
  it('expires after an hour even with continuous background renewal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: jwt(Date.now() + 15 * 60000), refreshToken: 'next' } }))))
    stop = session.start(vi.fn())
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(session.accessToken()).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })
  it('checks persisted inactivity before activity can revive a sleeping session', () => {
    stop = session.start(vi.fn())
    vi.setSystemTime(Date.now() + HOUR + 1)
    window.dispatchEvent(new Event('pointerdown'))
    expect(session.accessToken()).toBeNull()
  })
  it('retains the session on a temporary network failure and retries later', async () => {
    vi.setSystemTime(Date.now() + 15 * 60000)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(new Response(JSON.stringify({ data: { accessToken: 'renewed', refreshToken: 'next' } }))))
    await expect(session.ensureAccessToken()).rejects.toThrow('Offline')
    expect(session.accessToken()).not.toBeNull()
    expect(await session.ensureAccessToken()).toBe('renewed')
  })
  it('expires a revoked refresh token', async () => {
    vi.setSystemTime(Date.now() + 15 * 60000)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    expect(await session.ensureAccessToken()).toBeNull()
    expect(session.accessToken()).toBeNull()
  })
  it('does not resurrect a session logged out while refresh was in flight', async () => {
    vi.setSystemTime(Date.now() + 15 * 60000)
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    const pending = session.ensureAccessToken(); session.clear()
    finish(new Response(JSON.stringify({ data: { accessToken: 'late', refreshToken: 'next' } })))
    expect(await pending).toBeNull(); expect(session.accessToken()).toBeNull()
  })
})
