import { beforeEach, describe, expect, it, vi } from 'vitest'
const { data } = vi.hoisted(() => ({ data: new Map<string, string>() }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => data.get(key) ?? null,
  removeItem: async (key: string) => { data.delete(key) },
  multiSet: async (entries: [string, string][]) => { entries.forEach(([k, v]) => data.set(k, v)) },
  multiRemove: async (keys: string[]) => { keys.forEach(k => data.delete(k)) },
} }))
vi.mock('expo-secure-store', () => ({ getItemAsync: async (key: string) => data.get(`secure:${key}`) ?? null, setItemAsync: async (key: string, value: string) => { data.set(`secure:${key}`, value) }, deleteItemAsync: async (key: string) => { data.delete(`secure:${key}`) }, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' }))
const user = { id: 'member', name: 'Ama', email: 'ama@example.test', role: 'user' }
const valid = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200 }))}.sig`
beforeEach(() => { data.clear(); vi.resetModules(); vi.useRealTimers() })
describe('native session lifecycle', () => {
  it('shares refresh across concurrent requests and retains user identity', async () => {
    const s = await import('../session')
    const renew = vi.fn(async () => ({ accessToken: valid, refreshToken: 'rotated' }))
    s.configureRefresh(renew)
    await s.establishSession(user, { accessToken: 'expired', refreshToken: 'refresh' })
    expect(await Promise.all([s.accessToken(), s.accessToken(), s.accessToken()])).toEqual([valid, valid, valid])
    expect(renew).toHaveBeenCalledTimes(1)
    expect(s.sessionSnapshot()?.user.id).toBe('member')
  })
  it('preserves a session on network errors but clears revoked refresh tokens', async () => {
    const s = await import('../session')
    await s.establishSession(user, { accessToken: 'expired', refreshToken: 'refresh' })
    s.configureRefresh(async () => { throw new Error('offline') })
    await expect(s.accessToken()).rejects.toThrow('offline')
    expect(s.sessionSnapshot()).not.toBeNull()
    s.configureRefresh(async () => { throw Object.assign(new Error('revoked'), { status: 401 }) })
    await expect(s.accessToken()).rejects.toThrow('revoked')
    expect(s.sessionSnapshot()).toBeNull()
    expect(data.has('secure:uf_tokens')).toBe(false)
  })
  it('expires after one hour and does not let a late touch resurrect the session', async () => {
    const s = await import('../session')
    await s.establishSession(user, { accessToken: valid, refreshToken: 'refresh' })
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + s.IDLE_MS + 1)
    s.recordActivity()
    expect(s.sessionSnapshot()).toBeNull()
    expect(await s.accessToken()).toBeNull()
    vi.useRealTimers()
  })
  it('does not restore a signed-out user when an earlier refresh completes', async () => {
    const s = await import('../session')
    let resolve!: (tokens: { accessToken: string; refreshToken: string }) => void
    s.configureRefresh(() => new Promise(r => { resolve = r }))
    await s.establishSession(user, { accessToken: 'expired', refreshToken: 'refresh' })
    const request = s.accessToken(); await Promise.resolve(); await Promise.resolve()
    await s.endSession()
    resolve({ accessToken: valid, refreshToken: 'rotated' })
    expect(await request).toBeNull()
    expect(data.has('secure:uf_tokens')).toBe(false)
  })
  it('does not overwrite a newly signed-in account after an old refresh', async () => {
    const s = await import('../session')
    let resolve!: (tokens: { accessToken: string; refreshToken: string }) => void
    s.configureRefresh(() => new Promise(r => { resolve = r }))
    await s.establishSession(user, { accessToken: 'expired', refreshToken: 'refresh' })
    const request = s.accessToken(); await Promise.resolve(); await Promise.resolve()
    await s.establishSession({ ...user, id: 'new-member' }, { accessToken: valid, refreshToken: 'new-refresh' })
    resolve({ accessToken: 'old-user-token', refreshToken: 'old-rotated' })
    expect(await request).toBeNull()
    expect(s.sessionSnapshot()?.user.id).toBe('new-member')
    expect(JSON.parse(data.get('secure:uf_tokens')!).refreshToken).toBe('new-refresh')
  })
})
