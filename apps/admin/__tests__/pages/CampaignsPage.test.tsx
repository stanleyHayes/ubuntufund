vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CampaignCategory, CampaignPriority, CampaignStatus, type Campaign } from '@ubuntu-fund/types'
const state = vi.hoisted(() => ({ campaigns: [] as Campaign[] }))
vi.mock('@/hooks/useApiData', () => ({ useAdminCampaigns: () => ({ data: state.campaigns, isLoading: false, error: null, retry: () => {} }) }))
import CampaignsPage from '@/pages/CampaignsPage'

function campaign(id: string, title: string, extra: Partial<Campaign> = {}): Campaign {
  return {
    id, title, creatorId: `creator-${id}`, description: 'Story', currency: 'GHS', goalAmount: 1000, raisedAmount: 100,
    category: CampaignCategory.MEDICAL, priority: CampaignPriority.NORMAL, status: CampaignStatus.ACTIVE, beneficiaries: [],
    imageUrls: [], startDate: new Date('2026-09-01'), endDate: new Date('2026-12-01'), createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-01'),
    ...extra,
  }
}

// Node's own experimental localStorage shadows jsdom's; the view switch remembers its layout there.
function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) }, clear: () => values.clear() }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  state.campaigns = [
    campaign('own', 'School fees for my daughter'),
    campaign('legacy', 'Older campaign without a creation mode', { creationMode: undefined }),
    campaign('confirmed', 'Surgery for Ama', { creationMode: 'on_behalf', onBehalf: { beneficiaryName: 'Ama Mensah', beneficiaryType: 'individual', beneficiaryConfirmed: true } }),
    campaign('awaiting', 'Roof for the clinic', { creationMode: 'on_behalf', onBehalf: { beneficiaryName: 'Kumasi Clinic', beneficiaryType: 'organization', beneficiaryConfirmed: false } }),
  ]
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const renderPage = () => render(<MemoryRouter><CampaignsPage /></MemoryRouter>)

async function choose(label: string, option: string) {
  // findByRole waits for the previous menu to close and un-hide the page.
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: label }))
  fireEvent.click(await screen.findByRole('option', { name: option }))
}

it('marks campaigns run for someone else with the beneficiary name', () => {
  renderPage()
  expect(screen.getByText('On behalf of Ama Mensah')).toBeVisible()
  expect(screen.getByText('On behalf of Kumasi Clinic · not confirmed')).toBeVisible()
  expect(screen.getAllByText(/^On behalf of/)).toHaveLength(2)
  expect(screen.getByText('4 campaigns')).toBeVisible()
})

it('filters by who a campaign was created for', async () => {
  renderPage()
  await choose('Created for', 'Someone else')
  expect(screen.getByText('2 campaigns')).toBeVisible()
  expect(screen.getByText('Surgery for Ama')).toBeVisible()
  expect(screen.queryByText('School fees for my daughter')).toBeNull()

  await choose('Created for', 'Themselves')
  expect(screen.getByText('2 campaigns')).toBeVisible()
  expect(screen.getByText('School fees for my daughter')).toBeVisible()
  // Campaigns from before creation modes existed were created by their organizer.
  expect(screen.getByText('Older campaign without a creation mode')).toBeVisible()
  expect(screen.queryByText('Surgery for Ama')).toBeNull()
})

it('filters by whether the beneficiary has confirmed', async () => {
  renderPage()
  await choose('Beneficiary', 'Awaiting')
  expect(screen.getByText('1 campaigns')).toBeVisible()
  expect(screen.getByText('Roof for the clinic')).toBeVisible()

  await choose('Beneficiary', 'Confirmed')
  expect(screen.getByText('1 campaigns')).toBeVisible()
  expect(screen.getByText('Surgery for Ama')).toBeVisible()
  expect(screen.queryByText('School fees for my daughter')).toBeNull()

  await choose('Beneficiary', 'Any')
  expect(screen.getByText('4 campaigns')).toBeVisible()
})

it('shows the chip in the table view too', () => {
  localStorage.setItem('uf_admin_campaigns_view', 'table')
  renderPage()
  const table = screen.getByRole('table', { name: 'Campaigns' })
  expect(table).toHaveTextContent('On behalf of Ama Mensah')
  expect(screen.getByRole('link', { name: 'Surgery for Ama' })).toHaveAttribute('href', '/campaigns/confirmed')
})
