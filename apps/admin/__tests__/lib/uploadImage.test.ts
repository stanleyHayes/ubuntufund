import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadImageViaApi } from '../../src/lib/uploadImage'

/** A minimal XHR stand-in that answers every upload with `status`. */
function stubUploads(status: number, body = '{}') {
  const sent: string[] = []
  class FakeXhr {
    status = 0; responseText = ''; upload = {} as { onprogress?: unknown }
    onload?: () => void; onerror?: () => void; onabort?: () => void
    private headers: Record<string, string> = {}
    open() {}
    setRequestHeader(name: string, value: string) { this.headers[name] = value }
    send() { sent.push(this.headers.Authorization ?? ''); this.status = status; this.responseText = body; queueMicrotask(() => this.onload?.()) }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  return sent
}

describe('admin image upload session handling', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
    localStorage.setItem('uf_admin_tokens', JSON.stringify({ accessToken: 'live', refreshToken: 'refresh' }))
    localStorage.setItem('uf_admin_token', 'live')
    localStorage.setItem('uf_admin_last_activity', String(Date.now()))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the session when renewing fails only because of the network', async () => {
    const sent = stubUploads(401)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    await expect(uploadImageViaApi(file, 'misc')).rejects.toThrow('Unable to renew your session')
    expect(sent).toEqual(['Bearer live'])
    expect(localStorage.getItem('uf_admin_token')).toBe('live')
    expect(localStorage.getItem('uf_admin_tokens')).not.toBeNull()
  })

  it('keeps the session when the refresh endpoint has a server error', async () => {
    stubUploads(401)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })))
    await expect(uploadImageViaApi(new File(['x'], 'photo.png', { type: 'image/png' }), 'misc')).rejects.toThrow('Unable to renew your session')
    expect(localStorage.getItem('uf_admin_tokens')).not.toBeNull()
  })

  it('signs out when the refresh is refused', async () => {
    stubUploads(401, JSON.stringify({ message: 'Invalid or expired token' }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    await expect(uploadImageViaApi(new File(['x'], 'photo.png', { type: 'image/png' }), 'misc')).rejects.toThrow('Invalid or expired token')
    expect(localStorage.getItem('uf_admin_token')).toBeNull()
    expect(localStorage.getItem('uf_admin_tokens')).toBeNull()
  })
})
