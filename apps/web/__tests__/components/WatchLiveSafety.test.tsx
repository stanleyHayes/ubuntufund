import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { WatchLivePage } from '@/pages/WatchLivePage'
import { getLiveSessionPublic } from '@/lib/fundraising'
import { api } from '@/lib/api'
vi.mock('@/lib/fundraising', () => ({ getLiveSessionPublic: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { put: vi.fn(), post: vi.fn() } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }))
vi.mock('@/components/live/LiveVideoPanel', () => ({ LiveVideoPanel: () => <div data-testid="live-player">Connected player</div> }))
const session = { id: 'live', creatorId: 'host', campaignId: 'campaign', title: 'Broadcast', status: 'active', amountRaised: 10, currency: 'GHS', successfulDonations: 1 }
function view() { return render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter initialEntries={['/live/live']}><Routes><Route path="/live/:sessionId" element={<WatchLivePage />} /></Routes></MemoryRouter></ThemeProvider>) }
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks() })
it('unmounts the connected player when subsequent access is denied', async () => {
  vi.useFakeTimers()
  vi.mocked(getLiveSessionPublic).mockResolvedValueOnce(session as never).mockRejectedValueOnce(new Error('Broadcast unavailable'))
  view()
  await act(async () => {})
  expect(screen.getByTestId('live-player')).toBeVisible()
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(screen.queryByTestId('live-player')).toBeNull()
  expect(screen.getByRole('alert')).toHaveTextContent('Broadcast unavailable')
})
it('disconnects the viewer locally after a persisted block even while provider cleanup retries', async () => {
  vi.mocked(getLiveSessionPublic).mockResolvedValue(session as never)
  vi.mocked(api.put).mockResolvedValue({ providerCleanupPending: true })
  view()
  await screen.findByTestId('live-player')
  fireEvent.click(screen.getByRole('button', { name: 'Block user' }))
  await screen.findByText('User blocked. Manage blocked users in Settings.')
  expect(screen.queryByTestId('live-player')).toBeNull()
  expect(api.put).toHaveBeenCalledWith('/safety/blocks/host', {})
})
