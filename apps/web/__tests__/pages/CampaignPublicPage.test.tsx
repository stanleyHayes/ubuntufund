import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignCategory, CampaignPriority, CampaignStatus } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const campaignState = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('@/hooks/usePublicCampaign', () => ({ usePublicCampaign: () => ({ campaign: campaignState.value, isLoading: false, error: null, notFound: false }) }))
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))

import { CampaignPublicPage } from '@/pages/CampaignPublicPage'

function Where() {
  const location = useLocation()
  return <output aria-label="location">{location.pathname + location.search}</output>
}

function renderAt(path: string) {
  return render(
    <ThemeProvider theme={ujimoraTheme}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/c/:slug" element={<><CampaignPublicPage /><Where /></>} /></Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  auth.user = null
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockResolvedValue(null)
  campaignState.value = {
    id: '64b000000000000000000001', slug: 'current-slug', title: 'Clinic roof repair', description: 'Fix the clinic roof.',
    goalAmount: 1000, raisedAmount: 100, currency: 'GHS', category: CampaignCategory.MEDICAL, priority: CampaignPriority.NORMAL,
    status: CampaignStatus.ACTIVE, creatorId: 'creator', beneficiaries: [], imageUrls: [], startDate: new Date(), endDate: new Date(Date.now() + 86_400_000),
    createdAt: new Date(), updatedAt: new Date(), donorCount: 0,
  }
})

it('moves an old vanity slug to the campaign’s current slug, keeping the query', async () => {
  renderAt('/c/old-slug?ref=flyer')
  await waitFor(() => expect(screen.getByLabelText('location')).toHaveTextContent('/c/current-slug?ref=flyer'))
  expect(screen.getByText('Clinic roof repair')).toBeInTheDocument()
})

it('stays put on the current slug', async () => {
  renderAt('/c/current-slug')
  expect(await screen.findByText('Clinic roof repair')).toBeInTheDocument()
  expect(screen.getByLabelText('location')).toHaveTextContent('/c/current-slug')
})

it('links a running broadcast and offers report and block to signed-in visitors', async () => {
  auth.user = { id: 'visitor' }
  vi.mocked(api.get).mockImplementation(async (path: string) => path.endsWith('/active-live') ? { id: 'live-1' } : null)
  renderAt('/c/current-slug')
  const watch = await screen.findByRole('link', { name: 'Watch live broadcast' })
  expect(watch).toHaveAttribute('href', '/live/live-1')
  expect(screen.getByRole('button', { name: 'Report campaign' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Block user' })).toBeInTheDocument()
})

it('sends signed-out visitors to sign in before reporting, and shows no live link without a broadcast', async () => {
  renderAt('/c/current-slug')
  await screen.findByText('Clinic roof repair')
  expect(screen.queryByRole('link', { name: 'Watch live broadcast' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Block user' })).not.toBeInTheDocument()
  screen.getByRole('button', { name: 'Report campaign' }).click()
  await waitFor(() => expect(screen.queryByText('Clinic roof repair')).not.toBeInTheDocument())
})
