import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignCategory, CampaignPriority, CampaignStatus, type Campaign } from '@ubuntu-fund/types'

function campaign(id: string, title: string, status: CampaignStatus, overrides: Partial<Campaign> = {}): Campaign {
  return {
    id, title, description: 'A campaign', goalAmount: 1000, raisedAmount: 100, currency: 'GHS', category: CampaignCategory.MEDICAL,
    priority: CampaignPriority.NORMAL, status, creatorId: 'owner', beneficiaries: [], imageUrls: [], startDate: new Date('2025-01-01'),
    endDate: new Date(Date.now() + 86_400_000), createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'), ...overrides,
  }
}
const campaigns = [
  campaign('a', 'Open clinic appeal', CampaignStatus.ACTIVE, { donorCount: 7 }),
  campaign('b', 'Single donor appeal', CampaignStatus.FUNDED, { donorCount: 1 }),
  campaign('c', 'Awaiting review appeal', CampaignStatus.PENDING_REVIEW),
  campaign('d', 'Ended but not swept', CampaignStatus.ACTIVE, { endDate: new Date(Date.now() - 60_000), donorCount: 3 }),
]
vi.mock('@/hooks/useCampaigns', () => ({ useMyCampaigns: () => ({ campaigns, isLoading: false, error: null }) }))

import { MyCampaignsPage } from '@/pages/MyCampaignsPage'

function renderPage() {
  return render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><MyCampaignsPage /></MemoryRouter></ThemeProvider>)
}

it('shows real donor counts and no Edit action that only duplicated View', () => {
  renderPage()
  expect(screen.getByText('7 donors')).toBeInTheDocument()
  expect(screen.getByText('1 donor')).toBeInTheDocument()
  expect(screen.queryByText('0 donors', { exact: false })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument()
})

it('filters by pending review and effective expiry, with no always-empty Draft tab', () => {
  renderPage()
  const tabs = screen.getAllByRole('tab').map(tab => tab.textContent)
  expect(tabs.some(label => label?.startsWith('Draft'))).toBe(false)
  // Counts follow the effective state too: the ended campaign is counted as expired.
  expect(tabs).toEqual(expect.arrayContaining(['All4', 'Pending review1', 'Active1', 'Funded1', 'Expired1', 'Blocked0']))
  fireEvent.click(screen.getByRole('tab', { name: /Pending review/ }))
  expect(screen.getByText('Awaiting review appeal')).toBeInTheDocument()
  expect(screen.queryByText('Open clinic appeal')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: /Expired/ }))
  expect(screen.getByText('Ended but not swept')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: /^Active/ }))
  expect(screen.getByText('Open clinic appeal')).toBeInTheDocument()
  expect(screen.queryByText('Ended but not swept')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: /Blocked/ }))
  expect(within(document.body).getByText("You don't have any blocked campaigns.")).toBeInTheDocument()
})
