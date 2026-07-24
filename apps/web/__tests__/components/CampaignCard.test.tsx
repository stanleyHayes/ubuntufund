import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ubuntuFundTheme } from '@ubuntu-fund/ui'
import { CampaignCard } from '@/components/campaigns/CampaignCard'
import {
  CampaignCategory,
  CampaignPriority,
  CampaignStatus,
  type Campaign,
} from '@ubuntu-fund/types'

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={ubuntuFundTheme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  )
}

const mockCampaign: Campaign = {
  id: 'test-1',
  title: 'Clean Water for Tamale',
  description:
    'Help us build a clean water well for the Tamale community in the Northern Region. Over 2,000 families lack access to safe drinking water.',
  goalAmount: 500000,
  raisedAmount: 375000,
  currency: 'GHS',
  category: CampaignCategory.COMMUNITY,
  priority: CampaignPriority.URGENT,
  status: CampaignStatus.ACTIVE,
  creatorId: 'user-1',
  beneficiaries: ['Tamale Community'],
  imageUrls: ['https://example.com/image.jpg'],
  startDate: new Date('2025-12-01'),
  endDate: new Date('2026-06-01'),
  createdAt: new Date('2025-12-01'),
  updatedAt: new Date('2026-03-15'),
}

describe('CampaignCard', () => {
  it('renders the campaign title', () => {
    renderWithProviders(<CampaignCard campaign={mockCampaign} />)
    expect(screen.getByText('Clean Water for Tamale')).toBeInTheDocument()
  })

  it('renders the description', () => {
    renderWithProviders(<CampaignCard campaign={mockCampaign} />)
    expect(
      screen.getByText(/Help us build a clean water well/)
    ).toBeInTheDocument()
  })

  it('renders the category chip with emoji', () => {
    renderWithProviders(<CampaignCard campaign={mockCampaign} />)
    expect(screen.getByText(/Community/)).toBeInTheDocument()
  })

  it('renders the percentage badge', () => {
    renderWithProviders(<CampaignCard campaign={mockCampaign} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders the raised amount in GHS', () => {
    renderWithProviders(<CampaignCard campaign={mockCampaign} />)
    expect(screen.getByText(/GH₵ 375,000/)).toBeInTheDocument()
  })

  it('renders a link to the campaign detail page', () => {
    renderWithProviders(<CampaignCard campaign={mockCampaign} />)
    const link = screen.getByRole('link', { name: /view details/i })
    expect(link).toHaveAttribute('href', '/campaigns/test-1')
  })

  it('shows the supporter count when donors exist', () => {
    renderWithProviders(<CampaignCard campaign={{ ...mockCampaign, donorCount: 147 }} />)
    expect(screen.getByText(/147 supporters/)).toBeInTheDocument()
  })

  it('invites the first supporter when nobody has donated', () => {
    renderWithProviders(<CampaignCard campaign={{ ...mockCampaign, donorCount: 0 }} />)
    expect(screen.getByText(/be the first supporter/i)).toBeInTheDocument()
  })

  it('shows days left for active campaigns', () => {
    renderWithProviders(<CampaignCard campaign={mockCampaign} />)
    expect(screen.getByText(/days left|Ended/)).toBeInTheDocument()
  })
})
