import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CampaignCategory, CampaignPriority, CampaignStatus, type Campaign, type CampaignBeneficiaryDetails } from '@ubuntu-fund/types'
import { ApiError } from '@/lib/apiError'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), user: { id: 'staff' }, canUpdate: true }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post, put: state.put } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: (_: string, action: string) => action === 'read' || state.canUpdate }) }))
import OnBehalfPanel from '@/components/OnBehalfPanel'

const campaign: Campaign = {
  id: 'campaign-1', creatorId: 'organizer', title: 'Surgery for Ama', description: 'Story', currency: 'GHS', goalAmount: 5000, raisedAmount: 0,
  category: CampaignCategory.MEDICAL, priority: CampaignPriority.NORMAL, status: CampaignStatus.PENDING_REVIEW, beneficiaries: ['Ama Mensah'],
  imageUrls: [], startDate: new Date(), endDate: new Date(), createdAt: new Date(), updatedAt: new Date(),
  creationMode: 'on_behalf', onBehalf: { beneficiaryName: 'Ama Mensah', beneficiaryType: 'individual', beneficiaryConfirmed: true },
}
const details: CampaignBeneficiaryDetails = {
  campaignId: 'campaign-1', creationMode: 'on_behalf', beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', relationship: 'family',
  reason: 'Ama needs heart surgery that her family cannot pay for.', payoutArrangement: 'beneficiary', consentStatus: 'accepted',
  consentAt: '2026-09-20T10:00:00.000Z', linked: true, invitationEmailHint: 'a•••@example.com', invitationStatus: 'accepted',
  invitationSentAt: '2026-09-19T10:00:00.000Z', invitationExpiresAt: '2026-09-26T10:00:00.000Z', payoutAuthority: 'beneficiary',
  publicationRequiresConsent: true, donationsRequireConsent: false, canResendInvitation: false, canChangeBeneficiary: false, canRevokeConsent: false,
  viewer: { manager: false, beneficiary: false, admin: true }, organizerName: 'Hope Foundation',
}
const events = [
  { event: 'invited', actorRole: 'organizer', actorId: 'organizer', payoutArrangement: 'beneficiary', consentVersion: '2026-09-29', createdAt: '2026-09-19T10:00:00.000Z' },
  { event: 'accepted', actorRole: 'beneficiary', actorId: 'ama', payoutArrangement: 'beneficiary', consentVersion: '2026-09-29', createdAt: '2026-09-20T10:00:00.000Z' },
  { event: 'declined', actorRole: 'invitee', reason: 'Wrong person', createdAt: '2026-09-18T10:00:00.000Z' },
]
const REASON = 'The organizer asked support to correct the beneficiary email.'

function mount(onChanged = vi.fn(), current: CampaignBeneficiaryDetails = details) {
  state.get.mockImplementation(async (path: string) => (path.endsWith('/events') ? events : current))
  render(<MemoryRouter><OnBehalfPanel campaign={campaign} onChanged={onChanged} /></MemoryRouter>)
  return onChanged
}

beforeEach(() => {
  vi.clearAllMocks()
  state.user = { id: 'staff' }
  state.canUpdate = true
  state.post.mockResolvedValue(null)
  state.put.mockResolvedValue(null)
})
afterEach(cleanup)

it('shows who the campaign is for, the consent state and the consent history', async () => {
  mount()
  const panel = await screen.findByRole('region', { name: 'On behalf of Ama Mensah' })
  expect(state.get).toHaveBeenCalledWith('/campaigns/campaign-1/beneficiary')
  expect(state.get).toHaveBeenCalledWith('/admin/campaigns/campaign-1/beneficiary/events')
  expect(within(panel).getByText('Person · Family member')).toBeVisible()
  expect(within(panel).getByText(details.reason)).toBeVisible()
  expect(within(panel).getByText('a•••@example.com')).toBeVisible()
  expect(within(panel).getByText('Linked to an Ujimora account')).toBeVisible()
  expect(within(panel).getByText('The beneficiary')).toBeVisible()
  expect(within(panel).getByRole('link', { name: /Hope Foundation/ })).toHaveAttribute('href', '/users/organizer')
  expect(within(panel).getByRole('link', { name: 'Audit log for this campaign' })).toHaveAttribute('href', '/audit?search=campaign-1')
  const history = within(panel).getByRole('list', { name: 'Consent history' })
  expect(within(history).getAllByRole('listitem')).toHaveLength(3)
  expect(within(history).getByText('Invitation sent')).toBeVisible()
  expect(within(history).getByText('Beneficiary accepted')).toBeVisible()
  expect(within(history).getByText('Reason: Wrong person')).toBeVisible()
})

it('reassigns the beneficiary only with a staff reason and sends the full beneficiary', async () => {
  const onChanged = mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Reassign beneficiary' }))
  const dialog = await screen.findByRole('dialog', { name: 'Reassign beneficiary' })
  expect(within(dialog).getByText(/consent and any payout authority are cleared/)).toBeVisible()
  const submit = within(dialog).getByRole('button', { name: 'Reassign and invite' })
  expect(submit).toBeDisabled()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Beneficiary email' }), { target: { value: ' ama.new@example.com ' } })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Staff reason (at least 20 characters)' }), { target: { value: 'Too short' } })
  expect(submit).toBeDisabled()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Staff reason (at least 20 characters)' }), { target: { value: REASON } })
  expect(submit).toBeEnabled()
  fireEvent.click(submit)
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(state.post).toHaveBeenCalledExactlyOnceWith('/admin/campaigns/campaign-1/beneficiary/reassign', {
    beneficiaryType: 'individual',
    beneficiaryName: 'Ama Mensah',
    beneficiaryEmail: 'ama.new@example.com',
    relationship: 'family',
    reason: details.reason,
    payoutArrangement: 'beneficiary',
    staffReason: REASON,
  })
  expect(onChanged.mock.calls[0][0]).toMatch(/invited to accept/)
})

it('changes payout authority with a written reason', async () => {
  const onChanged = mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Change payout authority' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change payout authority' })
  const submit = within(dialog).getByRole('button', { name: 'Change payout authority' })
  expect(submit).toBeDisabled()
  fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Who can request payouts' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Nobody' }))
  expect(submit).toBeDisabled()
  fireEvent.change(await within(dialog).findByRole('textbox', { name: 'Staff reason (at least 20 characters)' }), { target: { value: REASON } })
  expect(submit).toBeEnabled()
  fireEvent.click(submit)
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(state.put).toHaveBeenCalledExactlyOnceWith('/admin/campaigns/campaign-1/payout-authority', { target: 'none', staffReason: REASON })
})

it('only offers payout authority options the beneficiary’s consent allows', async () => {
  mount(vi.fn(), { ...details, consentStatus: 'pending', linked: false, payoutAuthority: 'none', consentAt: undefined })
  fireEvent.click(await screen.findByRole('button', { name: 'Change payout authority' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change payout authority' })
  expect(within(dialog).getByText('Beneficiary and Organizer become available once the beneficiary accepts.')).toBeVisible()
  fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Who can request payouts' }))
  expect(await screen.findByRole('option', { name: 'Beneficiary' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('option', { name: 'Organizer' })).toHaveAttribute('aria-disabled', 'true')
})

it('shows why the API refused a change and keeps the dialog open', async () => {
  const onChanged = mount()
  state.put.mockRejectedValueOnce(new ApiError('Another administrator must decide payout authority for a campaign you are part of.', 403))
  fireEvent.click(await screen.findByRole('button', { name: 'Change payout authority' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change payout authority' })
  fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Who can request payouts' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Organizer' }))
  fireEvent.change(await within(dialog).findByRole('textbox', { name: 'Staff reason (at least 20 characters)' }), { target: { value: REASON } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Change payout authority' }))
  expect(await within(dialog).findByText('Not allowed')).toBeVisible()
  expect(within(dialog).getByText('Another administrator must decide payout authority for a campaign you are part of.')).toBeVisible()
  expect(onChanged).not.toHaveBeenCalled()

  state.post.mockRejectedValueOnce(new ApiError('This campaign is not run on someone\'s behalf.', 409))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Reassign beneficiary' }))
  const reassign = await screen.findByRole('dialog', { name: 'Reassign beneficiary' })
  fireEvent.change(within(reassign).getByRole('textbox', { name: 'Beneficiary email' }), { target: { value: 'ama@example.com' } })
  fireEvent.change(within(reassign).getByRole('textbox', { name: 'Staff reason (at least 20 characters)' }), { target: { value: REASON } })
  fireEvent.click(within(reassign).getByRole('button', { name: 'Reassign and invite' }))
  expect(await within(reassign).findByText('Not possible in the campaign’s current state')).toBeVisible()
  expect(onChanged).not.toHaveBeenCalled()
})

it('stops staff acting on a campaign they created', async () => {
  state.user = { id: 'organizer' }
  mount()
  expect(await screen.findByText(/Another administrator must reassign its beneficiary/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reassign beneficiary' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Change payout authority' })).toBeDisabled()
})

it('stops staff acting on a campaign they benefit from', async () => {
  mount(vi.fn(), { ...details, viewer: { manager: false, beneficiary: true, admin: true } })
  expect(await screen.findByText(/Another administrator must reassign its beneficiary/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Change payout authority' })).toBeDisabled()
})

it('hides the staff actions from read-only roles but keeps the audit link', async () => {
  state.canUpdate = false
  mount()
  expect(await screen.findByRole('link', { name: 'Audit log for this campaign' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Reassign beneficiary' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Change payout authority' })).toBeNull()
})

it('retries the details after a failed load', async () => {
  state.get.mockRejectedValue(new Error('Beneficiary service unavailable'))
  render(<MemoryRouter><OnBehalfPanel campaign={campaign} onChanged={vi.fn()} /></MemoryRouter>)
  expect(await screen.findByText('Beneficiary service unavailable')).toBeVisible()
  state.get.mockImplementation(async (path: string) => (path.endsWith('/events') ? events : details))
  fireEvent.click(screen.getByRole('button', { name: 'Retry beneficiary details' }))
  expect(await screen.findByRole('region', { name: 'On behalf of Ama Mensah' })).toBeVisible()
})

it('shows an invitation held for the content check as not sent, and says a reassignment waits for it too', async () => {
  const held: CampaignBeneficiaryDetails = { ...details, consentStatus: 'pending', consentAt: undefined, linked: false, invitationStatus: 'held', invitationSentAt: undefined, invitationExpiresAt: undefined, payoutAuthority: 'none' }
  const onChanged = mount(vi.fn(), held)
  const panel = await screen.findByRole('region', { name: 'On behalf of Ama Mensah' })
  expect(within(panel).getByText('Not sent: waits for the content check')).toBeVisible()
  expect(within(panel).getByText('Invitation to')).toBeVisible()
  expect(within(panel).queryByText('Invitation sent to')).not.toBeInTheDocument()
  fireEvent.click(within(panel).getByRole('button', { name: 'Reassign beneficiary' }))
  const dialog = await screen.findByRole('dialog', { name: 'Reassign beneficiary' })
  expect(within(dialog).getByText(/invitation waits for the campaign’s content check/)).toBeVisible()
  expect(within(dialog).queryByText(/is emailed an invitation/)).not.toBeInTheDocument()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Beneficiary email' }), { target: { value: 'ama.new@example.com' } })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Staff reason (at least 20 characters)' }), { target: { value: REASON } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reassign and invite' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(onChanged.mock.calls[0][0]).toMatch(/invitation is sent once the content check is cleared/)
})

it('shows an invitation withdrawn when the campaign was declined as withdrawn and never sent, and holds a reassignment for the check', async () => {
  const withdrawn: CampaignBeneficiaryDetails = { ...details, consentStatus: 'pending', consentAt: undefined, linked: false, invitationEmailHint: undefined, invitationStatus: 'superseded', invitationSentAt: undefined, invitationExpiresAt: undefined, payoutAuthority: 'none', nextStep: 'name_beneficiary' }
  state.post.mockResolvedValue({ invitationHeld: true })
  const onChanged = mount(vi.fn(), withdrawn)
  const panel = await screen.findByRole('region', { name: 'On behalf of Ama Mensah' })
  expect(within(panel).getByText('Withdrawn: no invitation is waiting')).toBeVisible()
  expect(within(panel).queryByText('Replaced by a newer invitation')).not.toBeInTheDocument()
  fireEvent.click(within(panel).getByRole('button', { name: 'Reassign beneficiary' }))
  const dialog = await screen.findByRole('dialog', { name: 'Reassign beneficiary' })
  expect(within(dialog).getByText(/invitation waits for the campaign’s content check/)).toBeVisible()
  expect(within(dialog).queryByText(/is emailed an invitation/)).not.toBeInTheDocument()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Beneficiary email' }), { target: { value: 'ama.new@example.com' } })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Staff reason (at least 20 characters)' }), { target: { value: REASON } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reassign and invite' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(onChanged.mock.calls[0][0]).toMatch(/invitation is sent once the content check is cleared/)
})

it('confirms a reassignment from the API\'s answer', async () => {
  // The panel's details still show the old pending invitation, but the API held the new one.
  const pending: CampaignBeneficiaryDetails = { ...details, consentStatus: 'pending', consentAt: undefined, linked: false, invitationStatus: 'pending', payoutAuthority: 'none' }
  state.post.mockResolvedValue({ invitationHeld: true })
  const onChanged = mount(vi.fn(), pending)
  const panel = await screen.findByRole('region', { name: 'On behalf of Ama Mensah' })
  fireEvent.click(within(panel).getByRole('button', { name: 'Reassign beneficiary' }))
  const dialog = await screen.findByRole('dialog', { name: 'Reassign beneficiary' })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Beneficiary email' }), { target: { value: 'ama.new@example.com' } })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Staff reason (at least 20 characters)' }), { target: { value: REASON } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reassign and invite' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(onChanged.mock.calls[0][0]).toMatch(/invitation is sent once the content check is cleared/)
})

it('says how a changed beneficiary\'s new details were admitted, and flags a change nobody checked', async () => {
  const changes = [
    { event: 'beneficiary_changed', actorRole: 'organizer', actorId: 'organizer', admission: 'screening', createdAt: '2026-09-21T10:00:00.000Z' },
    { event: 'beneficiary_changed', actorRole: 'organizer', actorId: 'organizer', admission: 'staff_review', reason: 'The invitation waits for our team to check the campaign.', createdAt: '2026-09-22T10:00:00.000Z' },
    // Recorded before changes were checked like new content.
    { event: 'beneficiary_changed', actorRole: 'organizer', actorId: 'organizer', createdAt: '2026-09-18T10:00:00.000Z' },
  ]
  state.get.mockImplementation(async (path: string) => (path.endsWith('/events') ? changes : details))
  render(<MemoryRouter><OnBehalfPanel campaign={campaign} onChanged={vi.fn()} /></MemoryRouter>)
  const history = await screen.findByRole('list', { name: 'Consent history' })
  expect(within(history).getByText('New details: Cleared by automated screening')).toBeVisible()
  expect(within(history).getByText('New details: Checked by our team in the campaign review')).toBeVisible()
  expect(within(history).getByText(/New details: Not checked/)).toBeVisible()
})
