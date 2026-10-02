import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CreatorDashboardPage } from '@/pages/CreatorDashboardPage'
import { api } from '@/lib/api'
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'creator' } }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))

const profile = { id: 'page', handle: 'ama', displayName: 'Ama', tagline: 'Music and stories', bio: 'Original biography', tipsEnabled: true, presetAmounts: [15, 30], currency: 'GHS', avatarUrl: '', coverUrl: '' }
const held = (markers: string[]) => Object.assign(new Error('Saved privately for safety review.'), { status: 409, errors: { publication: markers } })

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(async path =>
    path === '/creators/me' ? { profile, balance: { availableBalance: 0, totalReceived: 0, paidOutBalance: 0, currency: 'GHS' }, policy: { eligible: true, planName: 'Plus', feePercent: 3 } }
      : path.startsWith('/publication-reviews') ? { items: [], total: 0 }
        : path === '/payout-accounts' ? { accounts: [] } : [])
})
afterEach(() => vi.resetAllMocks())

async function saveHeld(markers: string[]) {
  vi.mocked(api.post).mockImplementation(async (_path, body) => {
    if (JSON.stringify(body) === JSON.stringify({ tipsEnabled: false })) return { ...profile, tipsEnabled: false }
    throw held(markers)
  })
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CreatorDashboardPage /></MemoryRouter></ThemeProvider>)
  const bio = await screen.findByLabelText('About you')
  fireEvent.change(bio, { target: { value: 'Proposed new biography' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  return (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
}

it('says a held creator page is published once approved and keeps the edits on screen', async () => {
  const notice = await saveHeld(['held', 'publishes_on_approval'])
  expect(notice).toHaveTextContent("Once a reviewer approves it, it's published automatically, so you don't need to submit it again. Check Publication reviews above for the decision; you can withdraw it there.")
  expect(screen.getByLabelText('About you')).toHaveValue('Proposed new biography')
  expect(screen.getByRole('button', { name: 'Refresh publication reviews' })).toBeInTheDocument()
})

it('says pausing tips keeps the waiting version from being published', async () => {
  await saveHeld(['held', 'publishes_on_approval'])
  fireEvent.click(screen.getByRole('button', { name: 'Pause tips now' }))
  expect(await screen.findByText("Tips paused. Your changes waiting for review won't be published; save them again to resubmit.")).toBeInTheDocument()
  expect(screen.queryByText('Waiting for safety review')).not.toBeInTheDocument()
  expect(screen.getByLabelText('About you')).toHaveValue('Proposed new biography')
})

it('keeps the earlier words while its author saves it again after approval', async () => {
  const notice = await saveHeld(['held'])
  expect(notice).toHaveTextContent('After a reviewer approves it, save it again unchanged to publish it.')
  fireEvent.click(screen.getByRole('button', { name: 'Pause tips now' }))
  expect(await screen.findByText('Tips paused. Your other draft changes are retained.')).toBeInTheDocument()
  await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/creators/profile', { tipsEnabled: false }))
})
