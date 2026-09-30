import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import type { BeneficiaryInvitationPreview } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const auth = vi.hoisted(() => ({
  value: { user: null as { id: string; name: string; email: string } | null, isAuthenticated: false, isLoading: false, logout: vi.fn() },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth.value }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/components/account/EmailVerificationNotice', () => ({ EmailVerificationNotice: () => <p>Send a verification link</p> }))

import { BeneficiaryInvitationPage } from '@/pages/BeneficiaryInvitationPage'

const TOKEN = 'ab'.repeat(32)
const STORAGE_KEY = 'uf_beneficiary_invitation'
const preview: BeneficiaryInvitationPreview = {
  status: 'pending', expiresAt: '2099-10-06T10:00:00.000Z', campaignTitle: 'Surgery for Ama', campaignSummary: 'Ama needs a hip operation this month.',
  goalAmount: 12000, currency: 'GHS', organizerName: 'Hope Foundation', beneficiaryName: 'Ama Mensah', beneficiaryType: 'individual',
  relationship: 'patient', reason: 'Ama is a long-time patient of our clinic.', payoutArrangement: 'beneficiary', requiredAccountType: 'individual',
  consentVersion: '2026-09-29',
}

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)) },
    removeItem: (key: string) => { data.delete(key) },
    clear: () => data.clear(),
    keys: () => [...data.keys()],
  }
}
let storage: ReturnType<typeof memoryStorage>

function LoginProbe() {
  const location = useLocation()
  return <output aria-label="login">{JSON.stringify(location.state)}</output>
}
function renderPage() {
  return render(
    <ThemeProvider theme={ujimoraTheme}>
      <MemoryRouter initialEntries={['/beneficiary-invitation']}>
        <Routes>
          <Route path="/beneficiary-invitation" element={<BeneficiaryInvitationPage />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}
const openLink = () => window.history.replaceState({}, '', `/beneficiary-invitation#token=${TOKEN}`)

beforeEach(() => {
  storage = memoryStorage()
  vi.stubGlobal('sessionStorage', storage)
  auth.value = { user: null, isAuthenticated: false, isLoading: false, logout: vi.fn() }
  vi.mocked(api.post).mockReset()
  vi.mocked(api.post).mockImplementation(async (path: string) => (path === '/beneficiary-invitations/preview' ? preview : null))
})
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

it('shows the invitation before sign-in and keeps the token out of the page and address bar', async () => {
  openLink()
  renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'Hope Foundation created a campaign for Ama Mensah' })).toBeInTheDocument()
  expect(window.location.hash).toBe('')
  expect(api.post).toHaveBeenCalledWith('/beneficiary-invitations/preview', { token: TOKEN })
  expect(screen.getByRole('heading', { name: 'Surgery for Ama' })).toBeInTheDocument()
  expect(screen.getByText('Ama needs a hip operation this month.')).toBeInTheDocument()
  const details = screen.getByText('Organized by').closest('dl')!
  expect(within(details).getByText(/12,000/)).toBeInTheDocument()
  expect(within(details).getByText('Hope Foundation')).toBeInTheDocument()
  expect(within(details).getByText('Ama Mensah · Person')).toBeInTheDocument()
  expect(within(details).getByText('Patient')).toBeInTheDocument()
  expect(within(details).getByText('Ama is a long-time patient of our clinic.')).toBeInTheDocument()
  expect(within(details).getByText(/2099/)).toBeInTheDocument()
  expect(screen.getByText(/Donations are paid out to you, into your own verified account\. Hope Foundation manages the campaign but cannot withdraw the money\./)).toBeInTheDocument()
  expect(document.body.textContent).not.toContain(TOKEN)
  // Nothing is kept in the browser until the visitor chooses to sign in.
  expect(storage.getItem(STORAGE_KEY)).toBeNull()
})

it('keeps the token for sign-in, then restores it and accepts', async () => {
  openLink()
  const view = renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in to accept' }))
  expect(storage.getItem(STORAGE_KEY)).toBe(TOKEN)
  expect(JSON.parse(screen.getByRole('status', { name: 'login' }).textContent ?? '{}')).toEqual({ from: { pathname: '/beneficiary-invitation' } })
  expect(api.post).not.toHaveBeenCalledWith('/beneficiary-invitations/accept', expect.anything())
  view.unmount()

  // Back from the login page: no fragment any more, the token comes from this tab.
  auth.value = { user: { id: 'ama', name: 'Ama Mensah', email: 'ama@example.test' }, isAuthenticated: true, isLoading: false, logout: vi.fn() }
  vi.mocked(api.post).mockImplementation(async (path: string) => path === '/beneficiary-invitations/preview'
    ? preview
    : path === '/beneficiary-invitations/accept' ? { campaignId: 'campaign-7', status: 'pending_review' } : null)
  renderPage()
  expect(await screen.findByText(/Signed in as ama@example.test/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Accept campaign' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'You accepted this campaign' })).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledWith('/beneficiary-invitations/accept', { token: TOKEN })
  expect(screen.getByText(/waiting for a staff review/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View the campaign' })).toHaveAttribute('href', '/campaigns/campaign-7')
  expect(storage.getItem(STORAGE_KEY)).toBeNull()
})

it('shows why an acceptance was refused and how to verify the email', async () => {
  auth.value = { user: { id: 'ama', name: 'Ama Mensah', email: 'ama@example.test' }, isAuthenticated: true, isLoading: false, logout: vi.fn() }
  vi.mocked(api.post).mockImplementation(async (path: string) => {
    if (path === '/beneficiary-invitations/preview') return preview
    throw Object.assign(new Error('Verify your email address before accepting.'), { status: 403 })
  })
  openLink()
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Accept campaign' }))
  expect(await screen.findByText(/Verify your email address before accepting\./)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Verify your email in Settings' })).toHaveAttribute('href', '/settings#notifications')
  expect(screen.getByText('Send a verification link')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Accept campaign' })).toBeEnabled()
})

it('declines without an account, with an optional reason, after confirming', async () => {
  storage.setItem(STORAGE_KEY, TOKEN)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Decline' }))
  const dialog = await screen.findByRole('dialog', { name: 'Decline this campaign?' })
  expect(api.post).not.toHaveBeenCalledWith('/beneficiary-invitations/decline', expect.anything())
  fireEvent.change(within(dialog).getByLabelText('Reason (optional)'), { target: { value: 'I did not ask for this.' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Decline campaign' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'You declined this campaign' })).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledWith('/beneficiary-invitations/decline', { token: TOKEN, reason: 'I did not ask for this.' })
  expect(storage.getItem(STORAGE_KEY)).toBeNull()
})

it.each([
  ['expired', 'This invitation has expired. Ask Hope Foundation to send a new one.'],
  ['superseded', 'This invitation was replaced by a newer one.'],
  ['accepted', 'This invitation has already been accepted.'],
] as const)('shows an %s invitation without actions', async (status, text) => {
  vi.mocked(api.post).mockResolvedValue({ ...preview, status })
  storage.setItem(STORAGE_KEY, TOKEN)
  renderPage()
  expect(await screen.findByText(text, { exact: false })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
  expect(storage.getItem(STORAGE_KEY)).toBeNull()
})

it('explains an invalid or missing link', async () => {
  vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('This invitation link is not valid.'), { status: 404 }))
  storage.setItem(STORAGE_KEY, TOKEN)
  const view = renderPage()
  expect(await screen.findByRole('heading', { level: 1, name: 'This invitation link is not valid' })).toBeInTheDocument()
  expect(storage.getItem(STORAGE_KEY)).toBeNull()
  view.unmount()
  vi.mocked(api.post).mockClear()
  renderPage()
  expect(screen.getByRole('heading', { level: 1, name: 'Open your invitation link' })).toBeInTheDocument()
  expect(api.post).not.toHaveBeenCalled()
})
