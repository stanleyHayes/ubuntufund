import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import type { CampaignBeneficiaryDetails } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))

import { CampaignBeneficiaryPanel } from '@/components/campaigns/CampaignBeneficiaryPanel'

/** On-behalf campaign whose content waits for a staff check: its invitation is written, not sent. */
const held: CampaignBeneficiaryDetails = {
  campaignId: 'campaign-1', creationMode: 'on_behalf', beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', relationship: 'patient',
  reason: 'Ama needs surgery that her family cannot afford.', payoutArrangement: 'beneficiary', consentStatus: 'pending', linked: false,
  invitationEmailHint: 'a•••@example.com', invitationStatus: 'held', payoutAuthority: 'none',
  publicationRequiresConsent: true, donationsRequireConsent: true, canResendInvitation: false, canChangeBeneficiary: true, canRevokeConsent: false,
  viewer: { manager: true, beneficiary: false, admin: false }, organizerName: 'Tamale Care Foundation',
}

function mount(details: CampaignBeneficiaryDetails, onChanged = vi.fn()) {
  render(<ThemeProvider theme={ujimoraTheme}>
    <CampaignBeneficiaryPanel campaignId="campaign-1" details={details} loading={false} error={null} onRetry={vi.fn()} onChanged={onChanged} ownEmail="owner@example.com" ownAccountLabel="My organization" />
  </ThemeProvider>)
  return onChanged
}

beforeEach(() => { vi.mocked(api.put).mockReset() })

it('never says a held invitation was sent, and offers no resend', () => {
  mount(held)
  expect(screen.getByText('We will email Ama Mensah an invitation once our team has checked the campaign.')).toBeInTheDocument()
  expect(screen.getByText('Not sent yet. It goes to a•••@example.com once our team has checked the campaign.')).toBeInTheDocument()
  expect(screen.queryByText(/We emailed|Sent to/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Send invitation again' })).not.toBeInTheDocument()
})

it('keeps a corrected beneficiary’s invitation waiting for the same check', async () => {
  vi.mocked(api.put).mockResolvedValue({ invitationHeld: true })
  const onChanged = mount(held)
  fireEvent.click(screen.getByRole('button', { name: 'Change beneficiary' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change beneficiary' })
  expect(within(dialog).getByText('The invitation goes to the new beneficiary once our team has checked the campaign.')).toBeInTheDocument()
  // Our team's check covers the change, so there is no screening choice to make.
  expect(within(dialog).queryByRole('checkbox', { name: /Use OpenAI/ })).not.toBeInTheDocument()
  fireEvent.change(within(dialog).getByLabelText(/Their email address/), { target: { value: 'ama.k@example.com' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(onChanged).toHaveBeenCalledWith('Beneficiary updated. We will email Ama Mensah an invitation once our team has checked the campaign.')
  expect(vi.mocked(api.put).mock.calls[0][1]).not.toHaveProperty('automatedReviewConsent')
})

it('keeps the sent wording once the invitation has gone out', () => {
  mount({ ...held, invitationStatus: 'pending', invitationSentAt: '2026-10-01T10:00:00.000Z', invitationExpiresAt: '2026-10-04T10:00:00.000Z', canResendInvitation: true })
  expect(screen.getByText('We emailed Ama Mensah an invitation. They have not answered yet.')).toBeInTheDocument()
  expect(screen.getByText(/^Sent to a•••@example\.com on /)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send invitation again' })).toBeInTheDocument()
})

/** The invitation went out: a change now is new content, checked before anyone is invited. */
const sent: CampaignBeneficiaryDetails = { ...held, invitationStatus: 'pending', invitationSentAt: '2026-10-01T10:00:00.000Z', invitationExpiresAt: '2026-10-04T10:00:00.000Z', canResendInvitation: true, nextStep: 'staff_after_consent' }

it('says what happens after the beneficiary accepts, as the campaign\'s rules say', () => {
  const view = render(<ThemeProvider theme={ujimoraTheme}>
    <CampaignBeneficiaryPanel campaignId="campaign-1" details={sent} loading={false} error={null} onRetry={vi.fn()} onChanged={vi.fn()} ownAccountLabel="My organization" />
  </ThemeProvider>)
  expect(screen.getByText(/When Ama Mensah accepts, our team checks the campaign before it goes live\./)).toBeInTheDocument()
  view.rerender(<ThemeProvider theme={ujimoraTheme}>
    <CampaignBeneficiaryPanel campaignId="campaign-1" details={{ ...sent, nextStep: 'consent' }} loading={false} error={null} onRetry={vi.fn()} onChanged={vi.fn()} ownAccountLabel="My organization" />
  </ThemeProvider>)
  expect(screen.getByText(/The campaign goes live as soon as Ama Mensah accepts\./)).toBeInTheDocument()
  view.rerender(<ThemeProvider theme={ujimoraTheme}>
    <CampaignBeneficiaryPanel campaignId="campaign-1" details={{ ...sent, consentStatus: 'accepted', linked: true, invitationStatus: 'accepted', canChangeBeneficiary: false, canResendInvitation: false, nextStep: 'staff' }} loading={false} error={null} onRetry={vi.fn()} onChanged={vi.fn()} ownAccountLabel="My organization" />
  </ThemeProvider>)
  expect(screen.getByText('Our team is checking the campaign before it goes live. We will let you know when it has been reviewed.')).toBeInTheDocument()
})

it('offers screening for a changed beneficiary and confirms what happens next', async () => {
  vi.mocked(api.put).mockResolvedValue({ invitationHeld: false, nextStep: 'staff_after_consent' })
  const onChanged = mount(sent)
  fireEvent.click(screen.getByRole('button', { name: 'Change beneficiary' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change beneficiary' })
  expect(within(dialog).getByText(/The new name and reason are checked before anyone is invited: by automated screening if you allow it below, otherwise by our team/)).toBeInTheDocument()
  expect(within(dialog).queryByText(/until the new beneficiary accepts/)).not.toBeInTheDocument()
  const consent = within(dialog).getByRole('checkbox', { name: /Use OpenAI to check this public text/ })
  expect(consent).not.toBeChecked()
  fireEvent.click(consent)
  fireEvent.change(within(dialog).getByLabelText(/Their email address/), { target: { value: 'kofi@example.com' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ beneficiaryEmail: 'kofi@example.com', automatedReviewConsent: true })
  expect(onChanged).toHaveBeenCalledWith('Beneficiary updated. We emailed Ama Mensah an invitation. When they accept, our team checks the campaign before it goes live.')
})

it('says the new invitation waits when our team has to check the change first', async () => {
  vi.mocked(api.put).mockResolvedValue({ invitationHeld: true, nextStep: 'content_check' })
  const onChanged = mount(sent)
  fireEvent.click(screen.getByRole('button', { name: 'Change beneficiary' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change beneficiary' })
  fireEvent.change(within(dialog).getByLabelText(/Their email address/), { target: { value: 'kofi@example.com' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ automatedReviewConsent: false })
  expect(onChanged).toHaveBeenCalledWith('Beneficiary updated. We will email Ama Mensah an invitation once our team has checked the campaign.')
})

/** Declined while its content waited, then returned to review: the held invitation was withdrawn unsent. */
const withdrawn: CampaignBeneficiaryDetails = { ...held, invitationEmailHint: undefined, invitationStatus: 'superseded', nextStep: 'name_beneficiary' }

it('asks for the beneficiary again once the invitation was withdrawn, and keeps the change for our team’s check', async () => {
  vi.mocked(api.put).mockResolvedValue({ invitationHeld: true, nextStep: 'content_check' })
  const onChanged = mount(withdrawn)
  expect(screen.getByText('No invitation is waiting for Ama Mensah. Change the beneficiary to send a new one.')).toBeInTheDocument()
  expect(screen.getByText(/Our team can finish checking the campaign once you name the beneficiary again\./)).toBeInTheDocument()
  expect(screen.queryByText(/We emailed|Sent to|Not sent yet/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Change beneficiary' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change beneficiary' })
  // The outstanding check covers the change, so screening is not offered.
  expect(within(dialog).getByText('The invitation goes to the new beneficiary once our team has checked the campaign.')).toBeInTheDocument()
  expect(within(dialog).queryByRole('checkbox', { name: /Use OpenAI/ })).not.toBeInTheDocument()
  fireEvent.change(within(dialog).getByLabelText(/Their email address/), { target: { value: 'ama.k@example.com' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(vi.mocked(api.put).mock.calls[0][1]).not.toHaveProperty('automatedReviewConsent')
  expect(onChanged).toHaveBeenCalledWith('Beneficiary updated. We will email Ama Mensah an invitation once our team has checked the campaign.')
})

it('does not point to a change it can no longer make once the campaign ended', () => {
  mount({ ...withdrawn, nextStep: undefined, canChangeBeneficiary: false })
  expect(screen.getByText('No invitation is waiting for Ama Mensah.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Change beneficiary' })).not.toBeInTheDocument()
})
