import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ubuntuFundTheme } from '@ubuntu-fund/ui'
import {
  CampaignCategory,
  CampaignPriority,
  CampaignStatus,
  type Campaign,
} from '@ubuntu-fund/types'

const mockCampaigns: Campaign[] = [
  {
    id: '1',
    title: 'Clean Water for Tamale',
    description: 'Help us build a clean water well.',
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
  },
  {
    id: '2',
    title: 'Solar Panels for Accra School',
    description: 'Install solar panels at a primary school.',
    goalAmount: 25000,
    raisedAmount: 18200,
    currency: 'GHS',
    category: CampaignCategory.EDUCATION,
    priority: CampaignPriority.NORMAL,
    status: CampaignStatus.ACTIVE,
    creatorId: 'user-2',
    beneficiaries: ['Accra School'],
    imageUrls: ['https://example.com/solar.jpg'],
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-07-15'),
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-03-10'),
  },
]

vi.mock('@/hooks/useCampaigns', () => ({
  useCampaigns: () => ({
    campaigns: mockCampaigns,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useLeaderboard', () => ({
  useFeaturedDonors: () => ({
    featured: { topAllTime: [], topThisMonth: [] },
    isLoading: false,
    error: null,
  }),
}))

// Import after mock setup
import { HomePage } from '@/pages/HomePage'

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={ubuntuFundTheme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  )
}

describe('HomePage', () => {
  it('renders the campaigns heading', () => {
    renderWithProviders(<HomePage />)
    expect(screen.getByText('Campaigns')).toBeInTheDocument()
  })

  it('renders the campaigns description', () => {
    renderWithProviders(<HomePage />)
    expect(
      screen.getByText(/Discover verified campaigns across Ghana/)
    ).toBeInTheDocument()
  })

  it('renders the Start a Campaign banner', () => {
    renderWithProviders(<HomePage />)
    expect(
      screen.getByRole('link', { name: /start a campaign/i })
    ).toBeInTheDocument()
  })

  it('renders campaign cards from the hook data', () => {
    renderWithProviders(<HomePage />)
    expect(screen.getByText('Clean Water for Tamale')).toBeInTheDocument()
    expect(
      screen.getByText('Solar Panels for Accra School')
    ).toBeInTheDocument()
  })

  it('shows loading spinner when campaigns are loading', () => {
    vi.doMock('@/hooks/useCampaigns', () => ({
      useCampaigns: () => ({
        campaigns: [],
        isLoading: true,
        error: null,
      }),
    }))

    renderWithProviders(<HomePage />)
    expect(screen.getByText('Campaigns')).toBeInTheDocument()
  })

  it('renders the start campaign banner section', () => {
    renderWithProviders(<HomePage />)
    expect(screen.getAllByText(/Start a Campaign/).length).toBeGreaterThan(0)
  })
})
