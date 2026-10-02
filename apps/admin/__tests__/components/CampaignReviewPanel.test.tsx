import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CampaignReviewPanel from '@/components/CampaignReviewPanel'
import { CampaignCategory, CampaignPriority, CampaignStatus, type Campaign } from '@ubuntu-fund/types'
const state = vi.hoisted(() => ({ user: { id: 'staff' }, get: vi.fn(), put: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, put: state.put } }))
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
const campaign: Campaign = { id: 'campaign', creatorId: 'organizer', title: 'School', description: 'Full school story', currency: 'GHS', goalAmount: 300000, raisedAmount: 20, category: CampaignCategory.EDUCATION, priority: CampaignPriority.NORMAL, status: CampaignStatus.PENDING_REVIEW, beneficiaries: ['School'], imageUrls: ['https://media.example.test/photo.jpg'], startDate: new Date(), endDate: new Date(), createdAt: new Date(), updatedAt: new Date(), reviewVersion: 'a'.repeat(64) }
const reason = 'Reviewed all content and the supporting fundraising evidence.'
beforeEach(() => { vi.clearAllMocks(); state.user = { id: 'staff' }; state.get.mockResolvedValue({ items: [], total: 0 }); state.put.mockResolvedValue({}) })
function fillReview() {
  fireEvent.change(screen.getByLabelText('Decision notes (at least 20 characters)'), { target: { value: reason } })
  fireEvent.click(screen.getByRole('checkbox', { name: /complete public content/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /organizer verification/ }))
}
it('requires the full review and sends the displayed version and notes', async () => {
  const onChanged = vi.fn()
  render(<CampaignReviewPanel campaign={campaign} onChanged={onChanged} />)
  expect(screen.getByRole('button', { name: 'Approve campaign' })).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Open attachment 1' })).toHaveAttribute('href', campaign.imageUrls[0])
  fillReview()
  fireEvent.click(screen.getByRole('button', { name: 'Approve campaign' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(state.put).toHaveBeenCalledExactlyOnceWith('/campaigns/campaign/review', { action: 'approve', reason, expectedVersion: campaign.reviewVersion, contentReviewed: true, fundraisingReviewed: true })
})
it('preserves notes on a version conflict and resets acknowledgements for the new version', async () => {
  const onChanged = vi.fn()
  state.put.mockRejectedValue(new Error('The campaign changed. Reload and review the current version.'))
  const view = render(<CampaignReviewPanel campaign={campaign} onChanged={onChanged} />)
  fillReview(); fireEvent.click(screen.getByRole('button', { name: 'Approve campaign' }))
  await screen.findByText(/The campaign changed/)
  expect(onChanged).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Decision notes (at least 20 characters)')).toHaveValue(reason)
  view.rerender(<CampaignReviewPanel campaign={{ ...campaign, reviewVersion: 'b'.repeat(64) }} onChanged={onChanged} />)
  expect(screen.getByRole('checkbox', { name: /complete public content/ })).not.toBeChecked()
  expect(screen.getByLabelText('Decision notes (at least 20 characters)')).toHaveValue('')
})
it('forbids self-review and prevents an old account response refreshing the new account', async () => {
  const onChanged = vi.fn()
  let finish!: () => void
  state.put.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const view = render(<CampaignReviewPanel campaign={campaign} onChanged={onChanged} />)
  fillReview(); fireEvent.click(screen.getByRole('button', { name: 'Approve campaign' }))
  state.user = { id: 'organizer' }
  view.rerender(<CampaignReviewPanel campaign={campaign} onChanged={onChanged} />)
  finish()
  await waitFor(() => expect(screen.getByText('Another administrator must review your campaign.')).toBeVisible())
  expect(screen.getByRole('button', { name: 'Approve campaign' })).toBeDisabled()
  expect(onChanged).not.toHaveBeenCalled()
})
it('says why a campaign is waiting for a content check, only while it waits', () => {
  const held = { ...campaign, goalAmount: 500, contentReviewReason: 'new_media' as const }
  const view = render(<CampaignReviewPanel campaign={held} onChanged={vi.fn()} />)
  expect(screen.getByText('Why it is waiting')).toBeInTheDocument()
  expect(screen.getByText('Content check · New photos or video')).toBeInTheDocument()
  expect(screen.getByText('Open and inspect every attachment before approving.')).toBeInTheDocument()
  // The same attestations are still required to approve it.
  expect(screen.getByRole('checkbox', { name: /complete public content and every media attachment/ })).not.toBeChecked()
  view.rerender(<CampaignReviewPanel campaign={{ ...held, status: CampaignStatus.ACTIVE, reviewVersion: 'c'.repeat(64) }} onChanged={vi.fn()} />)
  expect(screen.queryByText('Why it is waiting')).not.toBeInTheDocument()
})
it.each([
  ['no_screening_consent', 'Content check · Not screened: no consent'],
  ['screening_flagged', 'Content check · Flagged by automated screening'],
  ['screening_unavailable', 'Content check · Automated screening unavailable'],
] as const)('names the %s content check', (contentReviewReason, label) => {
  render(<CampaignReviewPanel campaign={{ ...campaign, contentReviewReason }} onChanged={vi.fn()} />)
  expect(screen.getByText(label)).toBeInTheDocument()
})
it('adds no content reason to a campaign waiting only for its financial review', () => {
  render(<CampaignReviewPanel campaign={campaign} onChanged={vi.fn()} />)
  expect(screen.queryByText('Why it is waiting')).not.toBeInTheDocument()
})
it('drops the content check once staff cleared it, when the campaign returns to review for something else', () => {
  // Cleared, then back in review (a reopen, or the beneficiary's acceptance): the media were already approved.
  render(<CampaignReviewPanel campaign={{ ...campaign, contentReviewReason: 'new_media', contentReviewClearedAt: new Date('2026-09-30T10:00:00Z') }} onChanged={vi.fn()} />)
  expect(screen.queryByText('Why it is waiting')).not.toBeInTheDocument()
  expect(screen.queryByText(/Content check ·/)).not.toBeInTheDocument()
  // The decision itself still needs both attestations.
  expect(screen.getByRole('checkbox', { name: /complete public content/ })).not.toBeChecked()
})
it('tells staff that approving held on-behalf content sends the beneficiary invitation', async () => {
  const onBehalf = { ...campaign, creationMode: 'on_behalf' as const, contentReviewReason: 'screening_flagged' as const, onBehalf: { beneficiaryName: 'Ama Mensah', beneficiaryType: 'individual' as const, beneficiaryConfirmed: false } }
  state.get.mockImplementation(async (path: string) => (path.endsWith('/beneficiary') ? { consentStatus: 'pending', invitationStatus: 'held', nextStep: 'content_check' } : { items: [], total: 0 }))
  const view = render(<CampaignReviewPanel campaign={onBehalf} onChanged={vi.fn()} />)
  await waitFor(() => expect(state.get).toHaveBeenCalledWith('/campaigns/campaign/beneficiary'))
  expect(screen.getByText(/Nothing has been sent to the beneficiary yet\. Approving clears the content and sends their invitation/)).toBeInTheDocument()
  view.rerender(<CampaignReviewPanel campaign={{ ...onBehalf, reviewVersion: 'd'.repeat(64), contentReviewClearedAt: new Date() }} onChanged={vi.fn()} />)
  expect(screen.queryByText(/Nothing has been sent to the beneficiary yet/)).not.toBeInTheDocument()
})
it('points staff at the new beneficiary details when a change reopened the check', () => {
  const reopened = { ...campaign, creationMode: 'on_behalf' as const, contentReviewReason: 'no_screening_consent' as const, contentReviewTrigger: 'beneficiary_change' as const,
    onBehalf: { beneficiaryName: 'Kofi Asante', beneficiaryType: 'individual' as const, beneficiaryConfirmed: false } }
  const view = render(<CampaignReviewPanel campaign={reopened} onChanged={vi.fn()} />)
  expect(screen.getByText('Content check · Not screened: no consent')).toBeInTheDocument()
  expect(screen.getByText(/The organizer changed the beneficiary after the campaign was checked\. Read the new beneficiary name and reason closely/)).toBeInTheDocument()
  // Held like any content check: approving sends the new invitation.
  expect(screen.getByText(/Nothing has been sent to the beneficiary yet/)).toBeInTheDocument()
  view.rerender(<CampaignReviewPanel campaign={{ ...reopened, reviewVersion: 'e'.repeat(64), contentReviewClearedAt: new Date() }} onChanged={vi.fn()} />)
  expect(screen.queryByText(/The organizer changed the beneficiary/)).not.toBeInTheDocument()
})
it('says an invitation withdrawn when the campaign was declined must be named again, instead of promising a send', async () => {
  const returned = { ...campaign, creationMode: 'on_behalf' as const, contentReviewReason: 'new_media' as const, onBehalf: { beneficiaryName: 'Ama Mensah', beneficiaryType: 'individual' as const, beneficiaryConfirmed: false } }
  state.get.mockImplementation(async (path: string) => (path.endsWith('/beneficiary') ? { consentStatus: 'pending', invitationStatus: 'superseded', nextStep: 'name_beneficiary' } : { items: [], total: 0 }))
  render(<CampaignReviewPanel campaign={returned} onChanged={vi.fn()} />)
  expect(await screen.findByText(/No beneficiary invitation is waiting: it was withdrawn when the campaign was declined/)).toBeInTheDocument()
  expect(screen.getByText(/The organizer has to name the beneficiary again before it can be approved/)).toBeInTheDocument()
  expect(screen.queryByText(/Approving clears the content and sends their invitation/)).not.toBeInTheDocument()
})
it('reads the beneficiary only for on-behalf content that still waits for its check', async () => {
  render(<CampaignReviewPanel campaign={{ ...campaign, contentReviewReason: 'new_media' }} onChanged={vi.fn()} />)
  await waitFor(() => expect(state.get).toHaveBeenCalled())
  expect(state.get).not.toHaveBeenCalledWith('/campaigns/campaign/beneficiary')
})
