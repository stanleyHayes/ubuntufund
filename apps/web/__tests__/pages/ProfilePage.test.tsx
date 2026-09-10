import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { ProfilePage } from '@/pages/ProfilePage'
import { api } from '@/lib/api'
const updateName = vi.hoisted(() => vi.fn())
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Old cached name' }, updateName }) }))
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
  expect(api.put).toHaveBeenCalledWith('/profile', { name: 'Updated name', phone: '0551234567', bio: 'My own bio' })
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
