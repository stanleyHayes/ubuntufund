import { beforeEach, expect, it, vi } from 'vitest'
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types'
vi.hoisted(() => { process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test' })
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }))
vi.mock('../session', () => ({ accessToken: vi.fn(async () => 'access'), configureRefresh: vi.fn() }))
// test/setup.ts mocks the API client globally; this suite exercises the real one.
vi.unmock('@/lib/api')
import { onAgreementRequired, signalAgreementRequired } from '../agreementEvents'
import { agreementNotice, fetchLegalStatus } from '../agreementStatus'
import { api } from '../api'

const current = { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true }
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

it('lets the server status outrank the bundled version', () => {
  expect(agreementNotice(false, undefined, { current: false, requiredVersion: LEGAL_ACCEPTANCE_VERSION })).toBe('hidden')
  // Cached record matches this build, but the API requires something newer.
  expect(agreementNotice(true, current, { current: false, requiredVersion: '2099-01-01' })).toBe('update-app')
  expect(agreementNotice(true, current, { current: false, requiredVersion: LEGAL_ACCEPTANCE_VERSION })).toBe('review')
  // Accepted on another device: the stale cached record no longer matters.
  expect(agreementNotice(true, { ...current, version: 'old' }, { current: true, requiredVersion: LEGAL_ACCEPTANCE_VERSION })).toBe('hidden')
  // Before the status loads, fall back to the cached record.
  expect(agreementNotice(true, current, null)).toBe('hidden')
  expect(agreementNotice(true, { ...current, version: 'old' }, null)).toBe('review')
})

it('notifies observers only for 428 responses from authenticated and public requests', async () => {
  const seen = vi.fn()
  const stop = onAgreementRequired(seen)
  signalAgreementRequired(400)
  expect(seen).not.toHaveBeenCalled()
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Accept the current account agreement before publishing.' }), { status: 428 }))
  await expect(api.post('/campaigns', {})).rejects.toMatchObject({ status: 428 })
  expect(seen).toHaveBeenCalledTimes(1)
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid' }), { status: 400 }))
  await expect(api.post('/campaigns', {})).rejects.toMatchObject({ status: 400 })
  expect(seen).toHaveBeenCalledTimes(1)
  stop()
  signalAgreementRequired(428)
  expect(seen).toHaveBeenCalledTimes(1)
})

it('reads the status and ignores malformed or failed responses', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { current: false, requiredVersion: '2099-01-01', record: null } })))
  expect(await fetchLegalStatus()).toEqual({ current: false, requiredVersion: '2099-01-01' })
  expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.test/api/v1/profile/legal-acceptance')
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { unexpected: true } })))
  expect(await fetchLegalStatus()).toBeNull()
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
  expect(await fetchLegalStatus()).toBeNull()
})
