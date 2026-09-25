import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadImageViaApi } from '@/lib/uploadImage'
import { SESSION_EXPIRED, storedAccessToken } from '@/lib/session'

// R2-054: an upload answered 401 forces one token renewal. A renewal that
// failed on the network or with a 5xx was turned into "no session" and the
// user was signed out, losing the KYC or campaign form in progress.

class FakeXhr {
  static responses: { status: number; body: string }[] = []
  static sentWith: (string | undefined)[] = []
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null }
  status = 0
  responseText = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  private headers: Record<string, string> = {}
  open() {}
  setRequestHeader(name: string, value: string) { this.headers[name] = value }
  send() {
    const next = FakeXhr.responses.shift() ?? { status: 500, body: '{}' }
    FakeXhr.sentWith.push(this.headers.Authorization)
    this.status = next.status
    this.responseText = next.body
    queueMicrotask(() => this.onload?.())
  }
}

const file = new File(['image'], 'id.png', { type: 'image/png' })
const refused = { status: 401, body: JSON.stringify({ message: 'Invalid or expired access token' }) }
let expired: ReturnType<typeof vi.fn>

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } })
  localStorage.setItem('uf_user', JSON.stringify({ id: 'member' }))
  localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'looks-valid', refreshToken: 'refresh' }))
  localStorage.setItem('uf_last_activity', String(Date.now()))
  FakeXhr.responses = []
  FakeXhr.sentWith = []
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  expired = vi.fn()
  window.addEventListener(SESSION_EXPIRED, expired)
})
afterEach(() => { window.removeEventListener(SESSION_EXPIRED, expired); vi.unstubAllGlobals() })

describe('upload after a 401', () => {
  it.each([
    ['the network is down', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['the API answers 502 during a cold start', async () => new Response('Bad gateway', { status: 502 })],
  ])('keeps the session when the renewal fails because %s', async (_, refresh) => {
    FakeXhr.responses = [refused]
    vi.stubGlobal('fetch', vi.fn(refresh))
    await expect(uploadImageViaApi(file, 'kyc')).rejects.toThrow(/Check your connection/)
    expect(storedAccessToken()).toBe('looks-valid')
    expect(localStorage.getItem('uf_user')).not.toBeNull()
    expect(expired).not.toHaveBeenCalled()
  })

  it('retries once with the renewed token', async () => {
    FakeXhr.responses = [refused, { status: 201, body: JSON.stringify({ data: { url: 'https://media.example.test/id.png' } }) }]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: 'renewed', refreshToken: 'next' } }))))
    await expect(uploadImageViaApi(file, 'kyc')).resolves.toBe('https://media.example.test/id.png')
    expect(FakeXhr.sentWith).toEqual(['Bearer looks-valid', 'Bearer renewed'])
    expect(expired).not.toHaveBeenCalled()
  })

  it('signs out when the renewal is refused', async () => {
    FakeXhr.responses = [refused]
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    await expect(uploadImageViaApi(file, 'kyc')).rejects.toThrow('Invalid or expired access token')
    expect(storedAccessToken()).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('signs out when the renewed token is refused too', async () => {
    FakeXhr.responses = [refused, refused]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: 'renewed', refreshToken: 'next' } }))))
    await expect(uploadImageViaApi(file, 'kyc')).rejects.toThrow('Invalid or expired access token')
    expect(storedAccessToken()).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
  })
})
