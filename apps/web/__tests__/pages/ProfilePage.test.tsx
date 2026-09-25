import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { ProfilePage } from '@/pages/ProfilePage'
import { api } from '@/lib/api'
const { updateName, replaceTokens } = vi.hoisted(() => ({ updateName: vi.fn(), replaceTokens: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', name: 'Old cached name' }, updateName, replaceTokens }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('@/components/KYCStatus', () => ({ default: () => null }))
const mount = () => render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><ProfilePage /></MemoryRouter></ThemeProvider>)
describe('saved profile details', () => {
 it('shows saved details and updates the cached name only after saving', async () => {
  vi.mocked(api.get).mockImplementation(async path => path === '/profile' ? { name: 'Actual name', phone: '0551234567', bio: 'My own bio', country: 'Kenya' } : {})
  vi.mocked(api.put).mockResolvedValue({ name: 'Updated name', phone: '0551234567', bio: 'My own bio' })
  mount()
  const name = await screen.findByLabelText('Full Name')
  expect(name).toHaveValue('Actual name')
  expect(screen.getByLabelText('Phone Number')).toHaveValue('0551234567')
  expect(screen.getByLabelText('Bio')).toHaveValue('My own bio')
  fireEvent.change(name, { target: { value: 'Updated name' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => expect(updateName).toHaveBeenCalledWith('Updated name'))
  expect(api.put).toHaveBeenCalledWith('/profile', { name: 'Updated name', phone: '0551234567', bio: 'My own bio', automatedReviewConsent: false })
 })
 it('leaves missing optional fields empty', async () => {
  vi.mocked(api.get).mockResolvedValue({ name: 'New member' })
  mount()
  expect(await screen.findByLabelText('Phone Number')).toHaveValue('')
  expect(screen.getByLabelText('Bio')).toHaveValue('')
  expect(screen.getByLabelText('Country')).toHaveValue('')
 })
 it('blocks editing after a profile load failure and allows retry', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Offline'))
  mount()
  await screen.findByRole('button', { name: 'Retry' })
  expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
  vi.mocked(api.get).mockResolvedValue({ name: 'Recovered name' })
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByLabelText('Full Name')).toHaveValue('Recovered name')
 })
 it('uses organization identity while retaining a separate contact person', async () => {
  vi.mocked(api.get).mockResolvedValue({ name: 'Contact Person', organizationName: 'Community Foundation' })
  mount()
  expect(await screen.findByLabelText('Contact person')).toHaveValue('Contact Person')
  expect(screen.getByText('Community Foundation')).toBeInTheDocument()
  expect(screen.getByText('Managed by Contact Person')).toBeInTheDocument()
 })

})

it('keeps a held identity draft and private contact fields while allowing review refresh', async () => {
  updateName.mockClear()
  vi.mocked(api.get).mockImplementation(async path => path.startsWith('/publication-reviews') ? { items: [], total: 0 } : { name: 'Current name', phone: '0551234567', bio: 'Private biography' })
  vi.mocked(api.put).mockRejectedValue(new Error('Saved privately for safety review.'))
  mount()
  const name = await screen.findByLabelText('Full Name')
  fireEvent.change(name, { target: { value: 'Held proposed name' } })
  expect(screen.getByRole('checkbox', { name: /Use OpenAI/ })).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await screen.findByText('Saved privately for safety review.')
  expect(name).toHaveValue('Held proposed name')
  expect(screen.getByLabelText('Bio')).toHaveValue('Private biography')
  expect(screen.getByRole('button', { name: 'Refresh publication reviews' })).toBeInTheDocument()
  expect(updateName).not.toHaveBeenCalled()
})

it('saves private contact changes without resubmitting unchanged public identity', async () => {
  vi.mocked(api.get).mockResolvedValue({ name: 'Current name', phone: '0551234567', bio: 'Private biography' })
  vi.mocked(api.put).mockResolvedValue({ name: 'Current name', phone: '0551111111', bio: 'Private biography' })
  mount()
  fireEvent.change(await screen.findByLabelText('Phone Number'), { target: { value: '0551111111' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/profile', { phone: '0551111111', bio: 'Private biography', automatedReviewConsent: false }))
})

it('keeps this device signed in with the tokens rotated by a password change', async () => {
  const tokens = { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' }
  vi.mocked(api.get).mockResolvedValue({ name: 'Current name' })
  vi.mocked(api.put).mockResolvedValue({ tokens })
  replaceTokens.mockClear()
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Change Password' }))
  fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass12345' } })
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass12345' } })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass12345' } })
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))
  await waitFor(() => expect(replaceTokens).toHaveBeenCalledWith(tokens, 'user-1'))
  expect(api.put).toHaveBeenLastCalledWith('/auth/change-password', { currentPassword: 'OldPass12345', newPassword: 'NewPass12345' })
  expect(screen.getByLabelText('Current Password')).toHaveValue('')
})

it('keeps the current session untouched when the password change is refused', async () => {
  vi.mocked(api.get).mockResolvedValue({ name: 'Current name' })
  vi.mocked(api.put).mockRejectedValue(new Error('Current password is incorrect'))
  replaceTokens.mockClear()
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Change Password' }))
  fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'WrongPass123' } })
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass12345' } })
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'NewPass12345' } })
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))
  expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
  expect(replaceTokens).not.toHaveBeenCalled()
})
