import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { SettingsPage } from '@/pages/SettingsPage'

const { get, put, auth, colorMode } = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(),
  // Stable identities, as the real providers give: the page's effects depend on them.
  auth: { user: { id: 'member-1', name: 'Ama Mensah', email: 'ama@example.test' }, logout: () => {}, replaceTokens: () => {}, isLoading: false },
  colorMode: { darkMode: false, setDarkMode: () => {}, skin: 'default', setSkin: () => {} },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/api')>(), api: { get, put, post: vi.fn(), delete: vi.fn() } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/context/ColorModeContext', () => ({ useColorMode: () => colorMode }))
vi.mock('@/components/account/ActivityAlertSettings', () => ({ ActivityAlertSettings: () => null }))
vi.mock('@/components/account/NewsletterSettings', () => ({ NewsletterSettings: () => null }))
vi.mock('@/components/account/PublicationReviews', () => ({ PublicationReviews: () => null }))
vi.mock('@/components/account/DataRightsRequests', () => ({ DataRightsRequests: () => null }))
vi.mock('@/components/safety/BlockedUsers', () => ({ BlockedUsers: () => null }))
vi.mock('@ubuntu-fund/ui', async (importOriginal) => ({ ...await importOriginal<typeof import('@ubuntu-fund/ui')>(), MfaSettings: () => null, ThemeStylePicker: () => null }))

beforeEach(() => {
  get.mockReset().mockResolvedValue({ language: 'Twi', darkMode: false, anonymousDonations: false, showLeaderboards: true, publicProfile: true })
  put.mockReset().mockImplementation(async (_path: string, body: unknown) => body)
})

it('offers no language choice, because nothing in the apps is translated', async () => {
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><SettingsPage /></MemoryRouter></ThemeProvider>)
  expect(await screen.findByText('Currency and appearance.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Language')).not.toBeInTheDocument()
  expect(screen.queryByText('Twi')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('switch', { name: 'Show me on leaderboards' }))
  await waitFor(() => expect(put).toHaveBeenCalledWith('/profile', { showLeaderboards: false }))
  for (const [, body] of put.mock.calls) expect(body).not.toHaveProperty('language')
})
