import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { webcrypto } from 'node:crypto'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { publicationDraftKey, writePublicationDraft } from '@/lib/publicationDrafts'
import { api } from '@/lib/api'
import { installMemoryStorage } from '../memoryStorage'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'org-1', role: 'organization', name: 'Kofi Boateng', organizationName: 'Hope Foundation', email: 'team@hope.test' } }),
}))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))
vi.mock('@/components/campaigns/AiWritingAssistant', () => ({ default: () => null }))

import { CampaignForm } from '@/components/campaigns/CampaignForm'

const baseOptions = {
  plan: { name: 'Organization', maxMediaPerCampaign: 5, campaignCollaboration: false, maxCollaboratorsPerCampaign: 0, maxCampaignGoal: -1 },
  maxGoal: null, activeCount: 0, totalCount: 0, verificationCampaignLimit: 3, canCreate: true, creationBlockReason: null, canSplit: false, splitEnabled: false,
}
function mockOptions(extra: Record<string, unknown>) {
  vi.mocked(api.get).mockImplementation(async (path: string) => (path === '/campaigns/creation-options' ? { ...baseOptions, ...extra } : { items: [], total: 0 }))
}
const renderForm = () => render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CampaignForm /></MemoryRouter></ThemeProvider>)
const someoneElse = () => screen.getByRole('radio', { name: 'Someone else (on their behalf)' })

beforeEach(() => {
  installMemoryStorage()
  vi.stubGlobal('crypto', webcrypto)
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
})
afterEach(() => { vi.unstubAllGlobals() })

it.each([
  ['plan_required', 'Available on plans that include campaigns for others.', 'See plans', '/subscription'],
  ['plan_limit', 'Yours allows 2 active campaigns for others, and you have reached it.', 'See plans', '/subscription'],
  ['verification_required', 'Verify your account to run campaigns for others.', 'Review verification', '/kyc'],
])('offers campaigns for others only when the account may run them (%s)', async (reason, text, linkName, href) => {
  mockOptions({ canCreateOnBehalf: false, onBehalfBlockReason: reason, onBehalf: { limit: 2, active: 2, feePercent: 0 } })
  renderForm()
  await waitFor(() => expect(someoneElse()).toBeDisabled())
  expect(screen.getByRole('radio', { name: 'Me or my organization' })).toBeChecked()
  expect(screen.getByText(text, { exact: false })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: linkName })).toHaveAttribute('href', href)
  expect(screen.queryByLabelText('Their email address')).not.toBeInTheDocument()
})

it('says when campaigns for others are temporarily unavailable', async () => {
  mockOptions({ canCreateOnBehalf: false, onBehalfBlockReason: 'unavailable', onBehalf: { limit: -1, active: 0, feePercent: 0 } })
  renderForm()
  await waitFor(() => expect(someoneElse()).toBeDisabled())
  expect(screen.getByText(/temporarily unavailable/)).toBeInTheDocument()
})

it('collects the beneficiary, summarises who gets the money, and sends the onBehalf block', async () => {
  mockOptions({ canCreateOnBehalf: true, onBehalfBlockReason: null, onBehalf: { limit: -1, active: 0, feePercent: 2 } })
  vi.mocked(api.post).mockResolvedValue({ id: 'campaign-9', status: 'pending_review' })
  // The rest of the campaign is restored from a draft; the choice starts on "me".
  writePublicationDraft(publicationDraftKey('campaign', 'org-1'), {
    title: 'Clinic roof repair', category: 'medical', description: 'The clinic roof leaks every rainy season and patients get wet.',
    beneficiaries: 'Village clinic', coverImageUrl: '', goalAmount: '5000', currency: 'GHS', endDate: '2099-01-01', priority: 'normal',
  })
  renderForm()
  await waitFor(() => expect(someoneElse()).toBeEnabled())
  expect(screen.getByText(/An extra 2% platform fee applies/)).toBeInTheDocument()
  fireEvent.click(someoneElse())

  const continueButton = screen.getByRole('button', { name: 'Continue' })
  expect(continueButton).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Their public name'), { target: { value: 'Ama Mensah' } })
  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'team@hope.test' } })
  fireEvent.blur(screen.getByLabelText('Their email address'))
  expect(await screen.findByText('Use their own email address, not yours')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'ama@example.test' } })
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Their relationship to you' }))
  fireEvent.click(screen.getByRole('option', { name: 'Patient' }))
  fireEvent.change(screen.getByLabelText('Why are you raising money for them?'), { target: { value: 'Ama needs surgery that her family cannot pay for.' } })
  expect(screen.getByRole('radio', { name: 'The beneficiary, into their own verified account' })).toBeChecked()

  // The third party's email address is never kept in the browser draft.
  await waitFor(() => expect(JSON.stringify(Object.entries(localStorage))).toContain('Ama Mensah'))
  expect(JSON.stringify(Object.entries(localStorage))).not.toContain('ama@example.test')

  for (let step = 0; step < 3; step++) {
    const next = await screen.findByRole('button', { name: 'Continue' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
  }
  const summary = screen.getByText('On someone’s behalf').closest('div')!.parentElement!
  expect(within(summary).getByText('Hope Foundation (you)')).toBeInTheDocument()
  expect(within(summary).getByText(/Ama Mensah · Person · Patient/)).toBeInTheDocument()
  expect(within(summary).getByText('Ama Mensah, into their own verified account')).toBeInTheDocument()
  expect(within(summary).getByText(/The beneficiary must accept before the campaign can go live or collect donations/)).toBeInTheDocument()
  expect(within(summary).getByText(/An extra 2% platform fee applies to this campaign/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Publish campaign' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
  const [path, body, headers] = vi.mocked(api.post).mock.calls[0]
  expect(path).toBe('/campaigns')
  expect(body).toMatchObject({
    title: 'Clinic roof repair',
    onBehalf: {
      beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', beneficiaryEmail: 'ama@example.test',
      relationship: 'patient', reason: 'Ama needs surgery that her family cannot pay for.', payoutArrangement: 'beneficiary',
    },
  })
  expect(headers).toEqual({ 'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/) })
  expect(await screen.findByText('Waiting for Ama Mensah')).toBeInTheDocument()
  // Nobody sets up payouts for the beneficiary at creation.
  expect(screen.queryByText('Next: set up your payout account')).not.toBeInTheDocument()
})

it('keeps the default choice exactly as before: no onBehalf block', async () => {
  mockOptions({ canCreateOnBehalf: true, onBehalfBlockReason: null, onBehalf: { limit: -1, active: 0, feePercent: 0 } })
  vi.mocked(api.post).mockResolvedValue({ id: 'campaign-1', status: 'active' })
  writePublicationDraft(publicationDraftKey('campaign', 'org-1'), {
    title: 'Clinic roof repair', category: 'medical', description: 'The clinic roof leaks every rainy season and patients get wet.',
    beneficiaries: 'Village clinic', coverImageUrl: '', goalAmount: '5000', currency: 'GHS', endDate: '2099-01-01', priority: 'normal',
  })
  renderForm()
  await waitFor(() => expect(someoneElse()).toBeEnabled())
  for (let step = 0; step < 3; step++) {
    const next = await screen.findByRole('button', { name: 'Continue' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
  }
  expect(screen.queryByText('On someone’s behalf')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Publish campaign' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
  expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('onBehalf')
})

it('explains a plan refusal at submit and points to the plans', async () => {
  mockOptions({ canCreateOnBehalf: true, onBehalfBlockReason: null, onBehalf: { limit: -1, active: 0, feePercent: 0 } })
  vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Your Organization plan allows 1 active campaign on behalf of others. Upgrade to run more.'), { status: 403 }))
  writePublicationDraft(publicationDraftKey('campaign', 'org-1'), {
    title: 'Clinic roof repair', category: 'medical', description: 'The clinic roof leaks every rainy season and patients get wet.',
    beneficiaries: 'Village clinic', coverImageUrl: '', goalAmount: '5000', currency: 'GHS', endDate: '2099-01-01', priority: 'normal',
    onBehalf: { beneficiaryType: 'organization', beneficiaryName: 'Osu Clinic', relationship: 'partner_organization', reason: 'The clinic serves the whole community.', payoutArrangement: 'organization' },
  })
  renderForm()
  // A restored beneficiary comes back without the email address.
  expect(await screen.findByText(/Enter the beneficiary’s email address again/)).toBeInTheDocument()
  await waitFor(() => expect(someoneElse()).toBeChecked())
  expect(screen.getByLabelText('Organization’s public name')).toHaveValue('Osu Clinic')
  expect(screen.getByLabelText('Their email address')).toHaveValue('')
  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'desk@osu.test' } })
  for (let step = 0; step < 3; step++) {
    const next = await screen.findByRole('button', { name: 'Continue' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
  }
  expect(screen.getByText('Hope Foundation, on behalf of Osu Clinic, only if they agree')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Publish campaign' }))
  expect(await screen.findByText(/allows 1 active campaign on behalf of others/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/subscription')
})

it('says the beneficiary is emailed only once our team has checked a campaign waiting for its content check', async () => {
  mockOptions({ canCreateOnBehalf: true, onBehalfBlockReason: null, onBehalf: { limit: -1, active: 0, feePercent: 0 } })
  // The API keeps the invitation unsent until staff clear the content.
  vi.mocked(api.post).mockResolvedValue({ id: 'campaign-10', status: 'pending_review', contentReviewReason: 'no_screening_consent' })
  writePublicationDraft(publicationDraftKey('campaign', 'org-1'), {
    title: 'Clinic roof repair', category: 'medical', description: 'The clinic roof leaks every rainy season and patients get wet.',
    beneficiaries: 'Village clinic', coverImageUrl: '', goalAmount: '5000', currency: 'GHS', endDate: '2099-01-01', priority: 'normal',
  })
  renderForm()
  await waitFor(() => expect(someoneElse()).toBeEnabled())
  fireEvent.click(someoneElse())
  fireEvent.change(screen.getByLabelText('Their public name'), { target: { value: 'Ama Mensah' } })
  fireEvent.change(screen.getByLabelText('Their email address'), { target: { value: 'ama@example.test' } })
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Their relationship to you' }))
  fireEvent.click(screen.getByRole('option', { name: 'Patient' }))
  fireEvent.change(screen.getByLabelText('Why are you raising money for them?'), { target: { value: 'Ama needs surgery that her family cannot pay for.' } })
  for (let step = 0; step < 3; step++) {
    const next = await screen.findByRole('button', { name: 'Continue' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
  }
  fireEvent.click(screen.getByRole('button', { name: 'Publish campaign' }))
  expect(await screen.findByText('Waiting for Ama Mensah')).toBeInTheDocument()
  expect(screen.getByText(/We will email Ama Mensah an invitation once our team has checked the campaign\./)).toBeInTheDocument()
  expect(screen.queryByText(/We emailed Ama Mensah/)).not.toBeInTheDocument()
  expect(screen.queryByText(/send the invitation again/)).not.toBeInTheDocument()
  expect(screen.getByText('Saved · Pending review')).toBeInTheDocument()
})
