import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, credentialApi } from '../../src/lib/api'

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

  it('reports a wrong password or code on a credential check without renewing, replaying or signing out', async () => {
    window.history.replaceState({}, '', '/profile')
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'live', refreshToken: 'refresh' }))
    localStorage.setItem('uf_admin_token', 'live')
    localStorage.setItem('uf_admin_last_activity', String(Date.now()))
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, pathname: '/profile', assign })
    const fetchMock = vi.fn(async (url: string) => url.endsWith('/auth/refresh')
      ? new Response(JSON.stringify({ data: { accessToken: 'renewed', refreshToken: 'next' } }))
      : new Response(JSON.stringify({ message: 'Enter a valid authenticator code or an unused recovery code.', errors: { mfaCode: ['required'] } }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const failure = await credentialApi.post('/auth/mfa/enable', { password: 'SecurePass123', code: '000000', enrollmentId: 'e1' }).catch(error => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ status: 401, message: 'Enter a valid authenticator code or an unused recovery code.', errors: { mfaCode: ['required'] } })
    // One attempt only: no renewal and no replay that would count the code twice.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('uf_admin_token')).toBe('live')
    expect(localStorage.getItem('uf_admin_tokens')).not.toBeNull()
    expect(assign).not.toHaveBeenCalled()
    window.history.replaceState({}, '', '/login')
  })

  it('still treats a credential check sent without any session as a sign-out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Authentication required' }), { status: 401 })))
    await expect(credentialApi.post('/auth/mfa/setup', { password: 'x' })).rejects.toThrow('Your session has expired')
  })

  it('exposes the HTTP status on API errors', async () => {
    localStorage.setItem('uf_admin_token', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Changed elsewhere', errors: { revision: ['stale'] } }), { status: 409 })))
    const failure = await api.post('/admin/example', {}).catch(error => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ status: 409, message: 'Changed elsewhere', errors: { revision: ['stale'] } })
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
