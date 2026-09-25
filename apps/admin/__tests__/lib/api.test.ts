import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../src/lib/api'

describe('admin authentication errors', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
    window.history.replaceState({}, '', '/login')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows credential errors and omits stale tokens when signing in', async () => {
    localStorage.setItem('uf_admin_token', 'old-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid email or password' }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.post('/auth/login', { email: 'admin@example.com', password: 'wrong' })).rejects.toThrow('Invalid email or password')
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
  })

  it('uses a sign-in error fallback for an empty unauthorized login response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    await expect(api.post('/auth/login', {})).rejects.toThrow('The email or password is incorrect')
  })

  it('clears all persisted authentication on protected-request expiry', async () => {
    for (const key of ['uf_admin_token', 'uf_admin_tokens', 'uf_admin_user']) localStorage.setItem(key, 'stale')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    await expect(api.get('/users')).rejects.toThrow('Your session has expired')
    for (const key of ['uf_admin_token', 'uf_admin_tokens', 'uf_admin_user']) expect(localStorage.getItem(key)).toBeNull()
  })

  it('renews once and retries when the server rejects a token that still looks valid here', async () => {
    window.history.replaceState({}, '', '/users')
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'skewed', refreshToken: 'refresh' }))
    localStorage.setItem('uf_admin_token', 'skewed')
    localStorage.setItem('uf_admin_last_activity', String(Date.now()))
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return new Response(JSON.stringify({ data: { accessToken: 'renewed', refreshToken: 'next' } }))
      return (init?.headers as Record<string, string>).Authorization === 'Bearer renewed'
        ? new Response(JSON.stringify({ data: [{ id: 'u1' }] }))
        : new Response('{}', { status: 401 })
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.get('/users')).resolves.toEqual([{ id: 'u1' }])
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1)
    expect(localStorage.getItem('uf_admin_token')).toBe('renewed')
    window.history.replaceState({}, '', '/login')
  })

  it('returns successful login data', async () => {
    const data = { user: { id: 'admin' }, tokens: { accessToken: 'new-token' } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 })))
    await expect(api.post('/auth/login', {})).resolves.toEqual(data)
  })
  it('preserves a null data payload for campaigns without an active split', async () => {
    localStorage.setItem('uf_admin_token', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null, message: 'No active split', status: 200 }), { status: 200 })))
    await expect(api.get('/campaigns/example/split')).resolves.toBeNull()
  })

})
