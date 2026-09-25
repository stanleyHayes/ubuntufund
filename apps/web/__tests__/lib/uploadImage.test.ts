import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { uploadImageViaApi } from '@/lib/uploadImage'
import { SESSION_EXPIRED } from '@/lib/session'

/** XMLHttpRequest stand-in: answers each upload from `replies`, records the bearer sent. */
class FakeXhr {
  static replies: Array<{ status: number; body: string }> = []
  static bearers: Array<string | undefined> = []
  status = 0
  responseText = ''
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  private headers: Record<string, string> = {}
  open() {}
  setRequestHeader(name: string, value: string) { this.headers[name] = value }
  send() {
    FakeXhr.bearers.push(this.headers.Authorization)
    const reply = FakeXhr.replies.shift() ?? { status: 500, body: '{}' }
    this.status = reply.status
    this.responseText = reply.body
    queueMicrotask(() => this.onload?.())
  }
}

const file = new File(['bytes'], 'kyc.jpg', { type: 'image/jpeg' })
const refused = { status: 401, body: JSON.stringify({ message: 'Invalid or expired access token' }) }
const stored = { status: 201, body: JSON.stringify({ data: { url: 'https://res.cloudinary.com/x/image/upload/v1/kyc.jpg' } }) }
let expired: ReturnType<typeof vi.fn>

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } })
  localStorage.setItem('uf_user', JSON.stringify({ id: 'member' }))
  localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'skewed-access', refreshToken: 'refresh' }))
  localStorage.setItem('uf_last_activity', String(Date.now()))
  FakeXhr.replies = []
  FakeXhr.bearers = []
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  expired = vi.fn()
  window.addEventListener(SESSION_EXPIRED, expired)
})
afterEach(() => { window.removeEventListener(SESSION_EXPIRED, expired); vi.unstubAllGlobals() })

it('keeps the session when renewal fails on the network after an upload 401', async () => {
  FakeXhr.replies = [refused]
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  await expect(uploadImageViaApi(file, 'kyc')).rejects.toThrow('Unable to renew your session')
  expect(JSON.parse(localStorage.getItem('uf_tokens')!).accessToken).toBe('skewed-access')
  expect(expired).not.toHaveBeenCalled()
})

it('renews once and retries the upload with the new token', async () => {
  FakeXhr.replies = [refused, stored]
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: 'renewed', refreshToken: 'next' } }))))
  await expect(uploadImageViaApi(file, 'kyc')).resolves.toBe('https://res.cloudinary.com/x/image/upload/v1/kyc.jpg')
  expect(FakeXhr.bearers).toEqual(['Bearer skewed-access', 'Bearer renewed'])
  expect(expired).not.toHaveBeenCalled()
})

it('signs out when the refresh itself is refused', async () => {
  FakeXhr.replies = [refused]
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  await expect(uploadImageViaApi(file, 'kyc')).rejects.toThrow()
  expect(localStorage.getItem('uf_tokens')).toBeNull()
  expect(expired).toHaveBeenCalled()
})

it('signs out when the retried upload is still refused', async () => {
  FakeXhr.replies = [refused, refused]
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: 'renewed', refreshToken: 'next' } }))))
  await expect(uploadImageViaApi(file, 'kyc')).rejects.toThrow()
  expect(localStorage.getItem('uf_tokens')).toBeNull()
  expect(expired).toHaveBeenCalled()
})
