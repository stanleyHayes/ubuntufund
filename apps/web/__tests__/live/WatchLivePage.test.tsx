import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { WatchLivePage } from '@/pages/WatchLivePage'
const state = vi.hoisted(() => ({ status: 'active' }))
vi.mock('@/lib/fundraising', () => ({ getLiveSessionPublic: async () => ({ id: 'session', campaignId: 'campaign', title: 'Live for our community', status: state.status, successfulDonations: 2, amountRaised: 100, currency: 'GHS' }) }))
vi.mock('@/components/live/LiveVideoPanel', () => ({ LiveVideoPanel: ({ host = false }: { host?: boolean }) => <div>{host ? 'Host access' : 'Viewer access'}</div> }))
afterEach(cleanup)
const mount = () => render(<MemoryRouter initialEntries={['/live/session']}><Routes><Route path="/live/:sessionId" element={<WatchLivePage />} /></Routes></MemoryRouter>)
it('lets guests watch and carries the live session into their donation link', async () => {
  state.status = 'active'; mount(); await screen.findByText('Viewer access')
  expect(screen.getByRole('link', { name: 'Support this campaign' })).toHaveAttribute('href', '/c/campaign/donate?liveSessionId=session')
})
it('shows an ended state and removes the video player and live attribution', async () => {
  state.status = 'ended'; mount(); await screen.findByText(/This broadcast has ended/)
  expect(screen.queryByText('Viewer access')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Support this campaign' })).toHaveAttribute('href', '/c/campaign/donate')
})
