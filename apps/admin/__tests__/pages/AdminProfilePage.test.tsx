vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import AdminProfilePage from '@/pages/AdminProfilePage'
import { api, credentialApi } from '@/lib/api'
const { updateName, replaceTokens } = vi.hoisted(() => ({ updateName: vi.fn(), replaceTokens: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-1', name: 'Old name', email: 'admin@example.com', role: 'admin' }, updateName, replaceTokens }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() }, credentialApi: { get: vi.fn(), post: vi.fn() } }))
const profile = { name: 'Saved Admin', email: 'admin@example.com', phone: '0550000000', bio: 'Existing bio', language: 'en', notificationPreferences: { email: false, push: false } }
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(api.get).mockResolvedValue(profile); vi.mocked(api.put).mockResolvedValue({ name: 'Updated Admin' })
  vi.mocked(credentialApi.get).mockResolvedValue({ enabled: false, available: true, recoveryCodesRemaining: 0 })
})
const mount = () => render(<ThemeProvider theme={ujimoraTheme}><AdminProfilePage /></ThemeProvider>)
it('loads saved fields and omits an unset optional country on save', async () => {
  mount()
  expect(screen.getByRole('status', { name: 'Loading profile' })).toBeInTheDocument()
  const name = await screen.findByLabelText('Full Name')
  expect(name).toHaveValue('Saved Admin')
  expect(screen.getByLabelText('Phone Number')).toHaveValue('0550000000')
  expect(screen.getByLabelText('Bio')).toHaveValue('Existing bio')
  fireEvent.change(name, { target: { value: ' Updated Admin ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }))
  await screen.findByText('Profile updated successfully')
  expect(api.put).toHaveBeenCalledWith('/profile', { name: 'Updated Admin', phone: '0550000000', bio: 'Existing bio', automatedReviewConsent: false })
  expect(updateName).toHaveBeenCalledWith('Updated Admin')
})
it('preserves entered details and shows the server error on failed save', async () => {
  vi.mocked(api.put).mockRejectedValue(new Error('Name must contain at least 2 characters'))
  mount(); await screen.findByLabelText('Full Name')
  fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }))
  await screen.findByText('Name must contain at least 2 characters')
  expect(screen.getByLabelText('Bio')).toHaveValue('Existing bio')
  expect(updateName).not.toHaveBeenCalled()
})
it('prevents saving unloaded data and retries profile loading', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Profile unavailable'))
  mount(); await screen.findByText('Profile unavailable')
  expect(screen.queryByRole('button', { name: 'Save Profile' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.getByLabelText('Full Name')).toHaveValue('Saved Admin'))
})

it('omits unchanged identity when saving only private contact fields', async () => {
  mount()
  fireEvent.change(await screen.findByLabelText('Phone Number'), { target: { value: '0551111111' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/profile', { phone: '0551111111', bio: 'Existing bio', automatedReviewConsent: false }))
})

it('keeps the console signed in with the tokens rotated by a password change', async () => {
  const tokens = { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' }
  vi.mocked(api.put).mockResolvedValue({ tokens })
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Security' }))
  fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass12345' } })
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass12345' } })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass12345' } })
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))
  await screen.findByText('Password changed successfully')
  expect(api.put).toHaveBeenCalledWith('/auth/change-password', { currentPassword: 'OldPass12345', newPassword: 'NewPass12345' })
  expect(replaceTokens).toHaveBeenCalledWith(tokens, 'admin-1')
})

it('does not touch the session when the password change is refused', async () => {
  vi.mocked(api.put).mockRejectedValue(new Error('Current password is incorrect'))
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Security' }))
  fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'WrongPass123' } })
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass12345' } })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass12345' } })
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))
  await screen.findByText('Current password is incorrect')
  expect(replaceTokens).not.toHaveBeenCalled()
})

it('does not offer notification or language switches that nothing reads', async () => {
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Preferences' }))
  expect(screen.getByText('Notification Preferences')).toBeVisible()
  expect(screen.getByText(/notification bell/)).toBeVisible()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByText('Push Notifications')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Language')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /save preferences/i })).not.toBeInTheDocument()
})

it('sends authenticator settings through the credential-check client, so a wrong code never signs the admin out', async () => {
  vi.mocked(credentialApi.post).mockRejectedValue(new Error('Current password is incorrect.'))
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Security' }))
  await waitFor(() => expect(credentialApi.get).toHaveBeenCalledWith('/auth/mfa'))
  expect(api.get).not.toHaveBeenCalledWith('/auth/mfa')
  fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: 'WrongPass123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator' }))
  expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
  expect(credentialApi.post).toHaveBeenCalledWith('/auth/mfa/setup', { password: 'WrongPass123' })
  expect(replaceTokens).not.toHaveBeenCalled()
})
