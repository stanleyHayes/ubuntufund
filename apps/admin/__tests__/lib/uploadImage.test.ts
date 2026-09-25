import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { uploadImageViaApi } from '../../src/lib/uploadImage'

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

const file = new File(['bytes'], 'testimonial.jpg', { type: 'image/jpeg' })
const refused = { status: 401, body: JSON.stringify({ message: 'Invalid or expired access token' }) }
const stored = { status: 201, body: JSON.stringify({ data: { url: 'https://res.cloudinary.com/x/image/upload/v1/t.jpg' } }) }

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } })
  localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'skewed', refreshToken: 'refresh' }))
  localStorage.setItem('uf_admin_token', 'skewed')
  localStorage.setItem('uf_admin_last_activity', String(Date.now()))
  FakeXhr.replies = []
  FakeXhr.bearers = []
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})
afterEach(() => vi.unstubAllGlobals())

it('keeps the staff session when renewal fails on the network after an upload 401', async () => {
  FakeXhr.replies = [refused]
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  await expect(uploadImageViaApi(file, 'misc')).rejects.toThrow('Unable to renew your session')
  expect(localStorage.getItem('uf_admin_token')).toBe('skewed')
})

it('renews once and retries, and signs out only when the refresh is refused', async () => {
  FakeXhr.replies = [refused, stored]
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { accessToken: 'renewed', refreshToken: 'next' } }))))
  await expect(uploadImageViaApi(file, 'misc')).resolves.toBe('https://res.cloudinary.com/x/image/upload/v1/t.jpg')
  expect(FakeXhr.bearers).toEqual(['Bearer skewed', 'Bearer renewed'])

  FakeXhr.replies = [refused]
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
  await expect(uploadImageViaApi(file, 'misc')).rejects.toThrow()
  expect(localStorage.getItem('uf_admin_token')).toBeNull()
})
