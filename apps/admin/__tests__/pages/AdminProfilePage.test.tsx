import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import AdminProfilePage from '@/pages/AdminProfilePage'
import { api } from '@/lib/api'
const updateName = vi.hoisted(() => vi.fn())
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Old name', email: 'admin@example.com', role: 'admin' }, updateName }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
const profile = { name: 'Saved Admin', email: 'admin@example.com', phone: '0550000000', bio: 'Existing bio', language: 'en', notificationPreferences: { email: false, push: false } }
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.get).mockResolvedValue(profile); vi.mocked(api.put).mockResolvedValue({ name: 'Updated Admin' }) })
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
  expect(api.put).toHaveBeenCalledWith('/profile', { name: 'Updated Admin', phone: '0550000000', bio: 'Existing bio' })
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
