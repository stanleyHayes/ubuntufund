import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.ujimora.test'
  return { token: vi.fn(async (_force?: boolean): Promise<string | null> => 'access-1') }
})
vi.unmock('@/lib/api')
vi.mock('../session', () => ({ accessToken: m.token, configureRefresh: vi.fn() }))
import { AI_WRITING_TIMEOUT_MS, api, ApiError, loginApi, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from '../api'
import { requestAiWriting } from '../aiWriting'
import { AiWritingAction } from '@ubuntu-fund/types'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => { fetchMock.mockReset(); m.token.mockReset().mockResolvedValue('access-1'); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

/** A fetch that never answers until its signal aborts, like a stalled Android request. */
function stalledFetch() {
  fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
  }))
}

describe('unauthenticated auth requests', () => {
  it('turns an HTML 502 page into a friendly ApiError instead of a JSON parse error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html><body>Bad gateway</body></html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))
    const error = await loginApi('ama@example.test', 'password').catch(e => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, message: 'Ujimora is temporarily unavailable. Please try again in a minute.' })
  })

  it('reports a network failure as status 0 with a connection hint', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(loginApi('ama@example.test', 'password')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Could not reach Ujimora') })
  })

  it('keeps the server message and status for JSON errors, and unwraps success envelopes', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { message: 'Invalid email or password', status: 401 }))
    await expect(loginApi('ama@example.test', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' })
    fetchMock.mockResolvedValueOnce(json(200, { data: { user: { id: 'u1' }, tokens: { accessToken: 'a', refreshToken: 'r' } }, status: 200 }))
    await expect(loginApi('ama@example.test', 'right')).resolves.toEqual({ user: { id: 'u1' }, tokens: { accessToken: 'a', refreshToken: 'r' } })
  })

  it('rejects a 200 whose body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>captive portal</html>', { status: 200 }))
    await expect(loginApi('ama@example.test', 'password')).rejects.toMatchObject({ message: 'Unexpected response from Ujimora. Please try again.' })
  })
})

describe('request timeouts', () => {
  it('gives up on a stalled request after 30 seconds', async () => {
    vi.useFakeTimers(); stalledFetch()
    const pending = api.get('/wallets').catch(e => e)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    const error = await pending
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, message: expect.stringContaining('took too long') })
  })

  it('lets uploads run for two minutes before timing out', async () => {
    vi.useFakeTimers(); stalledFetch()
    let settled = false
    const pending = api.upload('/uploads/image?folder=kyc', new ArrayBuffer(8), 'image/jpeg').catch(e => { settled = true; return e })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS - REQUEST_TIMEOUT_MS)
    expect(await pending).toMatchObject({ status: 0, message: expect.stringContaining('took too long') })
  })

  it('waits out the server budget for AI writing (moderation, generation, moderation) before timing out', async () => {
    vi.useFakeTimers(); stalledFetch()
    let settled = false
    const pending = requestAiWriting({ consentToExternalProcessing: true, text: 'Help Ama finish nursing school', action: AiWritingAction.EXPAND }).catch(e => { settled = true; return e })
    // A suggestion finished at ~31-60 s is still delivered rather than dropped after it used a daily request.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(settled).toBe(false)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.ujimora.test/api/v1/ai-writing')
    expect(AI_WRITING_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000 + 15_000)
    await vi.advanceTimersByTimeAsync(AI_WRITING_TIMEOUT_MS - 60_000)
    expect(await pending).toMatchObject({ status: 0, message: expect.stringContaining('took too long') })
  })

  it('keeps the default deadline for other POSTs', async () => {
    vi.useFakeTimers(); stalledFetch()
    const pending = api.post('/campaigns/c1/share', { platform: 'mobile' }).catch(e => e)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    expect(await pending).toMatchObject({ status: 0, message: expect.stringContaining('took too long') })
  })

  it('still retries once with a renewed token after a 401', async () => {
    let current = 'access-1'
    m.token.mockImplementation(async (force?: boolean) => { if (force) current = 'access-2'; return current })
    fetchMock.mockResolvedValueOnce(json(401, { message: 'Token expired' })).mockResolvedValueOnce(json(200, { data: [{ id: 'w1' }] }))
    await expect(api.get('/wallets')).resolves.toEqual([{ id: 'w1' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization).toBe('Bearer access-2')
  })

  it('accepts an empty success body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(api.delete('/campaigns/c1/updates/u1')).resolves.toBeNull()
  })
})
