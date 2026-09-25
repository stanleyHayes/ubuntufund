import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { ORGANIZER_AGREEMENT_NOTICE } from '@ubuntu-fund/types'
import { publicationDraftKey, writePublicationDraft } from '@/lib/publicationDrafts'
import { api } from '@/lib/api'
import { installMemoryStorage } from '../memoryStorage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner', role: 'user' } }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))
vi.mock('@/components/campaigns/AiWritingAssistant', () => ({ default: () => null }))

import { CampaignForm } from '@/components/campaigns/CampaignForm'

beforeEach(() => {
  installMemoryStorage()
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation(async (path: string) => path === '/campaigns/creation-options'
    ? { plan: { name: 'Free', maxMediaPerCampaign: 1, campaignCollaboration: false, maxCollaboratorsPerCampaign: 0 }, maxGoal: null, activeCount: 0, totalCount: 0, verificationCampaignLimit: 3, canCreate: true, creationBlockReason: null, canSplit: false, splitEnabled: false }
    : { items: [], total: 0 })
})

// The Organizer Agreement (section 10) says organizers accept it by submitting
// a campaign after this notice; the notice must sit beside the submit button.
it('shows the Organizer Agreement notice and link on the step that submits the campaign', async () => {
  writePublicationDraft(publicationDraftKey('campaign', 'owner'), {
    title: 'Clinic roof repair', category: 'medical', description: 'The clinic roof leaks every rainy season.',
    beneficiaries: 'Village clinic', coverImageUrl: '', goalAmount: '5000', currency: 'GHS', endDate: '2099-01-01', priority: 'urgent',
  })
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CampaignForm /></MemoryRouter></ThemeProvider>)
  await screen.findByText(/We restored your unsent draft/)
  expect(screen.queryByText(ORGANIZER_AGREEMENT_NOTICE, { exact: false })).toBeNull()

  for (let step = 0; step < 3; step += 1) fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))

  expect(await screen.findByRole('button', { name: 'Publish campaign' })).toBeInTheDocument()
  expect(screen.getByText(ORGANIZER_AGREEMENT_NOTICE, { exact: false })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Read the Campaign Organizer Agreement' })).toHaveAttribute('href', '/organizer-agreement')
})
