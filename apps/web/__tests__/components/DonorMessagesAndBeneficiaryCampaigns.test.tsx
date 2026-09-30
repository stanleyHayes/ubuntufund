import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BeneficiaryCampaignListItem } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { DonorMessageSettings } from '@/components/account/DonorMessageSettings'
import { BeneficiaryCampaigns } from '@/components/campaigns/BeneficiaryCampaigns'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
afterEach(() => { vi.resetAllMocks() })

it('reads and saves the thank-you message choice', async () => {
  vi.mocked(api.get).mockResolvedValue({ thankYouEmails: true })
  vi.mocked(api.put).mockResolvedValue({ thankYouEmails: false })
  render(<DonorMessageSettings />)
  const toggle = await screen.findByRole('switch', { name: 'Thank-you messages from campaigns I supported' })
  expect(api.get).toHaveBeenCalledWith('/profile/donor-messages')
  expect(toggle).toBeChecked()
  fireEvent.click(toggle)
  expect(await screen.findByText('You will not get thank-you messages from campaigns.')).toBeInTheDocument()
  expect(api.put).toHaveBeenCalledWith('/profile/donor-messages', { thankYouEmails: false })
  expect(screen.getByRole('switch', { name: 'Thank-you messages from campaigns I supported' })).not.toBeChecked()
})

it('lists campaigns run for the viewer, with who may request payouts', async () => {
  const item = (over: Partial<BeneficiaryCampaignListItem>): BeneficiaryCampaignListItem => ({
    id: 'c1', title: 'Surgery for Ama', status: 'active', raisedAmount: 800, goalAmount: 12000, currency: 'GHS', organizerName: 'Hope Foundation',
    consentStatus: 'accepted', payoutArrangement: 'beneficiary', payoutAuthority: true, endDate: '2099-01-01T00:00:00.000Z', ...over,
  })
  vi.mocked(api.get).mockResolvedValue([
    item({}),
    item({ id: 'c2', title: 'School fees for Kojo', payoutArrangement: 'organization', payoutAuthority: false, status: 'funded' }),
    item({ id: 'c3', title: 'Paused appeal', consentStatus: 'revoked', payoutAuthority: false, status: 'pending_review' }),
  ])
  render(<MemoryRouter><BeneficiaryCampaigns /></MemoryRouter>)
  const section = await screen.findByRole('region', { name: 'Campaigns run for you' })
  expect(api.get).toHaveBeenCalledWith('/beneficiary/campaigns')
  expect(within(section).getByRole('link', { name: 'Surgery for Ama' })).toHaveAttribute('href', '/campaigns/c1')
  expect(within(section).getAllByText('Organized by Hope Foundation')).toHaveLength(3)
  expect(within(section).getByText('You can request payouts from the campaign page.')).toBeInTheDocument()
  expect(within(section).getByText('Hope Foundation receives the payouts, as you agreed.')).toBeInTheDocument()
  expect(within(section).getByText('Consent withdrawn')).toBeInTheDocument()
  expect(within(section).getByText(/Payouts are paused/)).toBeInTheDocument()
})

it('stays hidden when nothing is run for the viewer', async () => {
  vi.mocked(api.get).mockResolvedValue([])
  const { container } = render(<MemoryRouter><BeneficiaryCampaigns /></MemoryRouter>)
  await waitFor(() => expect(api.get).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})
