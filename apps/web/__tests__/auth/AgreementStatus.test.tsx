import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types'
import { AuthProvider } from '@/context/AuthContext'
import { AccountAgreement, AccountAgreementNotice } from '@/components/auth/AccountAgreement'
import { api } from '@/lib/api'

const jwt = (expires: number) => `header.${btoa(JSON.stringify({ exp: Math.floor(expires / 1000) }))}.signature`
const user = { id: 'member-1', name: 'Ama', email: 'ama@example.test', role: 'user', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-13T00:00:00.000Z' } }
let serverCurrent: boolean
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) }, clear: () => values.clear() })
  localStorage.setItem('uf_user', JSON.stringify(user))
  localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: jwt(Date.now() + 15 * 60000), refreshToken: 'refresh' }))
  localStorage.setItem('uf_last_activity', String(Date.now()))
  serverCurrent = true
  fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/profile/legal-acceptance')) return new Response(JSON.stringify({ data: { current: serverCurrent, requiredVersion: serverCurrent ? LEGAL_ACCEPTANCE_VERSION : '2099-01-01', record: user.legalAcceptance } }))
    if (url.endsWith('/campaigns')) return new Response(JSON.stringify({ message: 'Accept the current account agreement before publishing.' }), { status: 428 })
    return new Response(JSON.stringify({ data: null }))
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals() })

function show() {
  render(<MemoryRouter><AuthProvider><AccountAgreementNotice /></AuthProvider></MemoryRouter>)
}
const statusCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/profile/legal-acceptance')).length

it('shows the notice when the server requires a newer version than this bundle knows', async () => {
  serverCurrent = false
  show()
  expect(await screen.findByText(/review the account agreement/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/account-agreement')
})

it('re-reads the server status after a 428 and then shows the notice', async () => {
  show()
  await waitFor(() => expect(statusCalls()).toBe(1))
  expect(screen.queryByText(/review the account agreement/i)).not.toBeInTheDocument()
  serverCurrent = false
  await act(async () => { await expect(api.post('/campaigns', {})).rejects.toMatchObject({ status: 428 }) })
  expect(await screen.findByText(/review the account agreement/i)).toBeInTheDocument()
  expect(statusCalls()).toBe(2)
})

it('keeps the cached view when the status request fails', async () => {
  fetchMock.mockImplementation(async () => { throw new TypeError('offline') })
  show()
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(screen.queryByText(/review the account agreement/i)).not.toBeInTheDocument()
})

it('accepts the version the server requires, not the one bundled in an older tab', async () => {
  serverCurrent = false
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/profile/legal-acceptance') && init?.method === 'POST') {
      serverCurrent = true
      return new Response(JSON.stringify({ data: { ...JSON.parse(String(init.body)), acceptedAt: '2099-01-02T00:00:00.000Z' } }))
    }
    if (url.endsWith('/profile/legal-acceptance')) return new Response(JSON.stringify({ data: { current: serverCurrent, requiredVersion: '2099-01-01', record: user.legalAcceptance } }))
    return new Response(JSON.stringify({ data: null }))
  })
  render(<MemoryRouter><AuthProvider><AccountAgreement /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText('Confirm your agreement')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms of Use/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /at least 18/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Save agreement' }))
  expect(await screen.findByText('Your agreement has been saved.')).toBeInTheDocument()
  const post = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/profile/legal-acceptance') && init?.method === 'POST')
  expect(JSON.parse(String(post![1].body))).toEqual({ version: '2099-01-01', acceptedTerms: true, ageConfirmed: true })
})
