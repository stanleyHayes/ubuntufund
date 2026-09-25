import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { WatchLivePage } from '@/pages/WatchLivePage'
const state = vi.hoisted(() => ({ status: 'active', targetAmount: undefined as number | undefined, amountRaised: 100 as number | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/fundraising', () => ({ getLiveSessionPublic: async () => ({ id: 'session', campaignId: 'campaign', title: 'Live for our community', status: state.status, successfulDonations: 2, amountRaised: state.amountRaised, targetAmount: state.targetAmount, currency: 'GHS' }) }))
vi.mock('@/components/live/LiveVideoPanel', () => ({ LiveVideoPanel: ({ host = false }: { host?: boolean }) => <div>{host ? 'Host access' : 'Viewer access'}</div> }))
afterEach(() => { cleanup(); state.targetAmount = undefined; state.amountRaised = 100 })
const mount = () => render(<MemoryRouter initialEntries={['/live/session']}><Routes><Route path="/live/:sessionId" element={<WatchLivePage />} /></Routes></MemoryRouter>)
it('lets guests watch and carries the live session into their donation link', async () => {
  state.status = 'active'; mount(); await screen.findByText('Viewer access')
  expect(screen.getByRole('link', { name: 'Support this campaign' })).toHaveAttribute('href', '/c/campaign/donate?liveSessionId=session')
})
it('shows the host’s session goal with progress, and no progress while amounts are hidden', async () => {
  state.status = 'active'; state.targetAmount = 400; mount()
  expect(await screen.findByText(/Session goal:/)).toHaveTextContent(/400.*25% reached/)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  cleanup(); state.amountRaised = null; mount()
  const goal = await screen.findByText(/Session goal:/)
  expect(goal).not.toHaveTextContent(/reached/)
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})
it('shows no session goal when the host did not set one', async () => {
  state.status = 'active'; mount(); await screen.findByText('Viewer access')
  expect(screen.queryByText(/Session goal:/)).not.toBeInTheDocument()
})
it('shows an ended state and removes the video player and live attribution', async () => {
  state.status = 'ended'; mount(); await screen.findByText(/This broadcast has ended/)
  expect(screen.queryByText('Viewer access')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Support this campaign' })).toHaveAttribute('href', '/c/campaign/donate')
})
