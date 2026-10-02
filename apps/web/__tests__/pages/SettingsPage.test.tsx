import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { SettingsPage } from '@/pages/SettingsPage'

const { get, put, auth, colorMode, reviewLists } = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(),
  // How many times Publication reviews was mounted, so loaded afresh.
  reviewLists: { mounted: 0 },
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
vi.mock('@/components/account/PublicationReviews', async () => {
  const { useEffect } = await import('react')
  return { PublicationReviews: () => { useEffect(() => { reviewLists.mounted++ }, []); return null } }
})
vi.mock('@/components/account/DataRightsRequests', () => ({ DataRightsRequests: () => null }))
vi.mock('@/components/safety/BlockedUsers', () => ({ BlockedUsers: () => null }))
vi.mock('@ubuntu-fund/ui', async (importOriginal) => ({ ...await importOriginal<typeof import('@ubuntu-fund/ui')>(), MfaSettings: () => null, ThemeStylePicker: () => null }))

beforeEach(() => {
  reviewLists.mounted = 0
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

it('lists a held public profile afresh and says its approval publishes it', async () => {
  get.mockResolvedValue({ darkMode: false, anonymousDonations: false, showLeaderboards: true, publicProfile: false })
  put.mockRejectedValue(Object.assign(new Error('Saved privately for safety review. Your content has not been published yet.'), { status: 409, errors: { publication: ['held', 'publishes_on_approval'] } }))
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><SettingsPage /></MemoryRouter></ThemeProvider>)
  const visibility = await screen.findByRole('switch', { name: 'Allow profile to be public' })
  expect(reviewLists.mounted).toBe(1)
  fireEvent.click(visibility)
  const notice = (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
  expect(notice).toHaveTextContent("Once a reviewer approves it, it's published automatically, so you don't need to submit it again. Check Publication reviews above for the decision; you can withdraw it there.")
  expect(put).toHaveBeenCalledWith('/profile', { publicProfile: true, automatedReviewConsent: false })
  expect(visibility).not.toBeChecked()
  // Reloaded, so the held version is there to check on or withdraw.
  expect(reviewLists.mounted).toBe(2)
})

it('keeps the switch to turn on again after approval otherwise', async () => {
  get.mockResolvedValue({ darkMode: false, anonymousDonations: false, showLeaderboards: true, publicProfile: false })
  put.mockRejectedValue(Object.assign(new Error('Saved privately for safety review.'), { status: 409, errors: { publication: ['held'] } }))
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><SettingsPage /></MemoryRouter></ThemeProvider>)
  fireEvent.click(await screen.findByRole('switch', { name: 'Allow profile to be public' }))
  const notice = (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
  expect(notice).toHaveTextContent('After a reviewer approves it, turn on “Allow profile to be public” again to publish it. Check Publication reviews above for the decision.')
  expect(notice).not.toHaveTextContent(/withdraw/)
})
