// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, it, expect, vi } from 'vitest'
import PublicationReviewsPage from '@/pages/PublicationReviewsPage'
import { ApiError } from '@/lib/apiError'
const { get, put, auth, permissions } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), auth: { user: { id: 'reviewer' } }, permissions: { granted: [] as string[] } }))
vi.mock('@/lib/api', () => ({ api: { get, put } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: (resource: string, action: string) => permissions.granted.includes(`${resource}:${action}`) }) }))
beforeEach(() => { permissions.granted = [] })
const renderPage = () => render(<MemoryRouter><PublicationReviewsPage /></MemoryRouter>)
const photo = 'https://res.cloudinary.com/ujimora/image/upload/v1/avatars/photo.jpg', cover = 'https://res.cloudinary.com/ujimora/image/upload/v1/covers/cover.jpg'
it.each([
  { action: 'account.profile', text: JSON.stringify({ name: 'Full proposed content', country: 'Ghana', publicProfile: true }) },
  { action: 'organization.profile', text: JSON.stringify({ organizationName: 'Full proposed content', website: 'https://example.test' }) },
  { action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', bio: 'Full proposed content', tipsEnabled: false }) },
  { action: 'update.create', text: JSON.stringify(['Update title', 'Full proposed content', 'general']) },
  { action: 'campaign.create', text: JSON.stringify({ title: 'School campaign', description: 'Full proposed content', beneficiaries: ['School community'], goalAmount: 300000, currency: 'GHS' }) },
])('requires notes and approves only the displayed $action version without publishing it', async ({ action, text }) => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'review', actorId: 'author', action, text, mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 })
  put.mockResolvedValue({})
  renderPage()
  const approve = await screen.findByRole('button', { name: 'Approve this version' })
  expect(approve).toBeDisabled()
  expect(screen.getByText(/Full proposed content/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the complete proposed public text.' } })
  get.mockResolvedValue({ items: [], total: 0 })
  fireEvent.click(approve)
  await waitFor(() => expect(put).toHaveBeenCalledExactlyOnceWith('/admin/publication-reviews/review/review', { decision: 'approved', notes: 'Reviewed the complete proposed public text.' }))
  expect(await screen.findByText('No submissions in this queue.')).toBeInTheDocument()
})
it('submits the exact supporter content version through the separate payment-content queue', async () => {
  vi.clearAllMocks()
  get.mockImplementation(async path => path.includes('tip-content-reviews') ? { items: [{ id: 'tip', version: 'version-hash', actorId: 'Guest', action: 'tip.public_content', text: JSON.stringify({ supporterName: 'Guest name', message: 'Review this message' }), mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 } : { items: [], total: 0 })
  put.mockResolvedValue({})
  renderPage()
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Content queue' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Supporter names and messages' }))
  const approve = await screen.findByRole('button', { name: 'Approve this version' })
  expect(screen.getByText(/Review this message/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the exact supporter name and message.' } })
  fireEvent.click(approve)
  await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/tip-content-reviews/tip/review', { decision: 'approved', notes: 'Reviewed the exact supporter name and message.', version: 'version-hash' }))
})
it.each([['tip-content-reviews', 'Supporter names and messages'], ['donation-content-reviews', 'Campaign donor names and messages']])('opens %s from the action-center link', async (queue, label) => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [], total: 0 })
  window.history.replaceState({}, '', `/publication-reviews?queue=${queue}`)
  try {
    renderPage()
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/admin/${queue}?status=pending&page=1&pageSize=12`))
    expect(screen.getByRole('combobox', { name: 'Content queue' })).toHaveTextContent(label)
  } finally { window.history.replaceState({}, '', '/') }
})
it('previews Cloudinary profile media labelled as the proposed photo and cover', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'profile', actorId: 'author', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', avatarUrl: photo, coverUrl: cover }), mediaUrls: [cover, photo], status: 'pending', reason: 'staff_requested' }], total: 1 })
  renderPage()
  expect(await screen.findByAltText('Photo preview')).toHaveAttribute('src', photo)
  expect(screen.getByAltText('Cover preview')).toHaveAttribute('src', cover)
  expect(screen.getByAltText('Photo preview')).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(screen.getByRole('link', { name: 'Open original Cover' })).toHaveAttribute('href', cover)
  expect(screen.queryByText(/^Media \d/)).toBeNull()
})
it('labels one image proposed as both photo and cover', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'profile', actorId: 'author', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', avatarUrl: photo, coverUrl: photo }), mediaUrls: [photo, photo], status: 'pending', reason: 'staff_requested' }], total: 1 })
  renderPage()
  expect(await screen.findAllByAltText('Photo and cover preview')).toHaveLength(2)
  expect(screen.queryByAltText('Photo preview')).toBeNull()
})
it('falls back to numbered labels when the profile text is not structured', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'profile', actorId: 'author', action: 'account.profile', text: 'not json', mediaUrls: [photo], status: 'pending', reason: 'staff_requested' }], total: 1 })
  renderPage()
  expect(await screen.findByAltText('Media 1 preview')).toHaveAttribute('src', photo)
})
it('does not load media hosted outside Cloudinary', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'comment', actorId: 'author', action: 'comment.create', text: 'Look at this', mediaUrls: ['https://media.example.test/photo.jpg'], status: 'pending', reason: 'staff_requested' }], total: 1 })
  renderPage()
  expect(await screen.findByText(/not hosted in Ujimora image storage/)).toBeInTheDocument()
  expect(screen.getByText('https://media.example.test/photo.jpg')).toBeInTheDocument()
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.queryByRole('link', { name: /Open original/ })).toBeNull()
})
it('explains and blocks review of the signed-in administrator\'s own pending submission', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [
    { id: 'own', actorId: 'reviewer', action: 'comment.create', text: 'My own comment', mediaUrls: [], status: 'pending', reason: 'staff_requested' },
    { id: 'other', actorId: 'author', action: 'comment.create', text: 'Another author comment', mediaUrls: [], status: 'pending', reason: 'staff_requested' },
    { id: 'decided', actorId: 'reviewer', action: 'comment.create', text: 'My decided comment', mediaUrls: [], status: 'approved', reason: 'staff_requested', reviewNotes: 'Reviewed by another administrator.' },
  ], total: 3 })
  put.mockResolvedValue({})
  renderPage()
  expect(await screen.findByText('You submitted this. Another administrator must review it.')).toBeInTheDocument()
  expect(screen.getAllByText('You submitted this. Another administrator must review it.')).toHaveLength(1)
  const [ownNotes, otherNotes] = screen.getAllByLabelText('Review notes (at least 20 characters)')
  const [ownApprove, otherApprove] = screen.getAllByRole('button', { name: 'Approve this version' })
  const [ownDecline, otherDecline] = screen.getAllByRole('button', { name: 'Decline this version' })
  fireEvent.change(ownNotes, { target: { value: 'Trying to review my own submission.' } })
  fireEvent.change(otherNotes, { target: { value: 'Reviewed the other author comment.' } })
  expect(ownApprove).toBeDisabled()
  expect(ownDecline).toBeDisabled()
  expect(otherApprove).toBeEnabled()
  expect(otherDecline).toBeEnabled()
  fireEvent.click(otherDecline)
  await waitFor(() => expect(put).toHaveBeenCalledExactlyOnceWith('/admin/publication-reviews/other/review', { decision: 'rejected', notes: 'Reviewed the other author comment.' }))
})
it('names a held donor thank-you message and shows it the way donors would read it', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'thanks', actorId: 'author', action: 'thank_you.send', text: JSON.stringify({ subject: 'Thank you from Ama', body: 'Your gifts paid for my surgery.\nI am home now.', signature: 'Ama' }), mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 })
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Donor thank-you message' })).toBeInTheDocument()
  expect(screen.getByText('Staff requested')).toBeInTheDocument()
  expect(screen.queryByText(/thank_you/)).toBeNull()
  const text = screen.getByText(/Subject: Thank you from Ama/)
  expect(text.textContent).toBe('Subject: Thank you from Ama\n\nYour gifts paid for my surgery.\nI am home now.\n\nSigned: Ama')
  expect(screen.queryByText(/"subject"/)).toBeNull()
})

const objectId = (char: string) => char.repeat(24)
const comment = (fields: Record<string, unknown>) => ({ id: 'comment', actorId: 'author', action: 'comment.create', text: 'A comment', mediaUrls: [], status: 'pending', reason: 'staff_requested', ...fields })

it('summarises authors, linking an account only when staff can open accounts and the account is open', async () => {
  vi.clearAllMocks()
  const author = { id: objectId('a'), name: 'Kofi Mensah', email: 'kofi@example.test', accountType: 'user', verificationLevel: 2, emailVerified: true, closed: false }
  const closed = { ...author, id: objectId('b'), name: 'Closed Author', emailVerified: false, closed: true }
  get.mockResolvedValue({ items: [
    comment({ id: 'open', actorId: author.id, author }),
    comment({ id: 'closed', actorId: closed.id, author: closed }),
    comment({ id: 'legacy', actorId: 'account' }),
    comment({ id: 'guest', actorId: 'Guest' }),
    comment({ id: 'missing', actorId: objectId('c'), author: null }),
  ], total: 5 })
  permissions.granted = ['users:read']
  const view = renderPage()
  expect(await screen.findByRole('link', { name: 'Kofi Mensah' })).toHaveAttribute('href', `/users/${author.id}`)
  // The email is the author's text: an isolated element inside the line of labels.
  const [email] = screen.getAllByText('kofi@example.test')
  expect(email.tagName).toBe('BDI')
  // Ordinary text needs only the <bdi>, so it wraps with the line instead of moving to a line of its own.
  expect(getComputedStyle(email).display).not.toBe('inline-block')
  expect(email.parentElement).toHaveTextContent(/^kofi@example\.test · Individual account · Verification: National ID$/)
  expect(screen.queryByRole('link', { name: /kofi@example/ })).toBeNull()
  expect(screen.getByText('Closed Author')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Closed Author' })).toBeNull()
  expect(screen.getByText(/Email not verified · Closed account/)).toBeInTheDocument()
  expect(screen.getByText('Account account')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Account account' })).toBeNull()
  expect(screen.getByText('Guest (no account)')).toBeInTheDocument()
  expect(screen.getByText('Account not found')).toBeInTheDocument()
  view.unmount()
  permissions.granted = []
  renderPage()
  expect(await screen.findByText('Kofi Mensah')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Kofi Mensah' })).toBeNull()
})
it('names the campaign a comment belongs to and links it for staff who can open campaigns', async () => {
  vi.clearAllMocks()
  const campaign = { id: objectId('c'), title: 'Neurodyne tablets', slug: 'neurodyne', status: 'blocked', creatorId: 'owner', deleted: false }
  get.mockResolvedValue({ items: [comment({ resourceId: campaign.id, campaign, text: JSON.stringify({ authorName: 'Ama', comment: 'Great work' }) })], total: 1 })
  permissions.granted = ['campaigns:read']
  renderPage()
  expect(await screen.findByRole('link', { name: 'Neurodyne tablets' })).toHaveAttribute('href', `/campaigns/${campaign.id}`)
  expect(screen.getByText('Blocked')).toBeInTheDocument()
  expect(screen.getByText('Shown as')).toBeInTheDocument()
  expect(screen.getByText('Great work')).toBeInTheDocument()
})
it('shows when a submission arrived only when the date is known', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [comment({ id: 'dated', createdAt: '2026-09-28T14:05:00.000Z' }), comment({ id: 'undated' })], total: 2 })
  const view = renderPage()
  expect(await screen.findAllByRole('heading', { name: 'Campaign comment' })).toHaveLength(2)
  // "Submitted <relative time> · <exact time>": the relative part is its own <time> element.
  expect(screen.getAllByText(/^Submitted · /)).toHaveLength(1)
  expect(view.container.querySelector('time[datetime="2026-09-28T14:05:00.000Z"]')).not.toBeNull()
  expect(screen.queryByText(/Invalid Date|NaN|undefined/)).toBeNull()
})
it('warns when an undecided proposal is about to be deleted', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [comment({ id: 'soon', purgeAt: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString() }), comment({ id: 'later', purgeAt: new Date(Date.now() + 20 * 86400000).toISOString() })], total: 2 })
  renderPage()
  expect(await screen.findByText('in 3 days')).toBeInTheDocument()
  expect(screen.getAllByText(/^Proposal deleted/)).toHaveLength(1)
})
it('keeps the exact submitted record one click away, and out of the page until then', async () => {
  vi.clearAllMocks()
  const text = JSON.stringify({ title: 'School campaign', description: 'Story', goalAmount: 300000, currency: 'GHS' })
  get.mockResolvedValue({ items: [{ id: 'proposal', actorId: 'author', resourceId: 'author', action: 'campaign.create', text, mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 })
  renderPage()
  const toggle = await screen.findByRole('button', { name: 'Show submitted text' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText(text)).toBeNull()
  expect(screen.queryByText('campaign.create')).toBeNull()
  fireEvent.click(toggle)
  expect(screen.getByRole('button', { name: 'Hide submitted text' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText(text)).toBeInTheDocument()
  expect(screen.getAllByText('campaign.create')).toHaveLength(1)
})
it('shows a failed decision once, on its card, and clears it when the queue is refreshed', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [comment({})], total: 1 })
  put.mockRejectedValue(new ApiError('Another reviewer already decided this submission', 409, { review: ['decided'] }))
  renderPage()
  fireEvent.change(await screen.findByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the complete comment text.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Approve this version' }))
  const message = await screen.findByText('Another reviewer already decided this submission')
  expect(screen.getAllByText('Another reviewer already decided this submission')).toHaveLength(1)
  expect(within(screen.getByRole('article')).getByText('Already decided')).toBeInTheDocument()
  expect(screen.getByRole('article')).toContainElement(message)
  // The buttons were disabled while saving, which drops focus: it comes to the explanation, not the page body.
  await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
  expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await waitFor(() => expect(screen.queryByText('Another reviewer already decided this submission')).toBeNull())
  expect(await screen.findByLabelText('Review notes (at least 20 characters)')).toHaveValue('Reviewed the complete comment text.')
  // The reload replaced the card; focus goes to its title.
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Campaign comment', level: 2 })).toHaveFocus())
})
it.each([
  [{ review: ['author_restricted'] }, 'This supporter cannot publish content.', 'Supporter can’t publish'],
  [{ review: ['changed'] }, 'The content changed. Refresh before reviewing.', 'Content changed'],
  // An API that names no reason (one deployed before this admin) gets a neutral title.
  [undefined, 'This supporter cannot publish content.', 'Decision not saved'],
])('titles a refused decision by the reason the API gives (%j)', async (errors, message, title) => {
  vi.clearAllMocks()
  get.mockImplementation(async path => path.includes('tip-content-reviews') ? { items: [{ id: 'tip', version: 'v'.repeat(64), actorId: 'supporter', action: 'tip.public_content', ownerId: 'creator', text: JSON.stringify({ supporterName: 'Ama', message: 'For you' }), mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 } : { items: [], total: 0 })
  put.mockRejectedValue(new ApiError(message, 409, errors))
  window.history.replaceState({}, '', '/publication-reviews?queue=tip-content-reviews')
  try {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the exact supporter name and message.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve this version' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(title)).toBeInTheDocument()
    expect(within(alert).getByText(message)).toBeInTheDocument()
    expect(within(alert).queryByText(/Already decided/)).toBeNull()
  } finally { window.history.replaceState({}, '', '/') }
})
it('explains that an approved campaign proposal is not a campaign yet, before and after approval', async () => {
  vi.clearAllMocks()
  const purgeAt = new Date(Date.now() + 20 * 86400000).toISOString()
  get.mockResolvedValueOnce({ items: [{ id: 'proposal', actorId: 'author', action: 'campaign.create', text: JSON.stringify({ title: 'School campaign', description: 'Story', goalAmount: 300000, currency: 'GHS', endDate: '2026-10-31T00:00:00.000Z' }), mediaUrls: [], status: 'pending', reason: 'staff_requested', purgeAt }], total: 1, campaignReviewGoalGhs: 250000 })
  get.mockResolvedValue({ items: [], total: 0 })
  put.mockResolvedValue({})
  renderPage()
  expect(await screen.findByRole('heading', { name: 'School campaign' })).toBeInTheDocument()
  expect(screen.getByText('Proposed campaign · not created yet')).toBeInTheDocument()
  expect(screen.getByText(/within 7 days; only then does the campaign appear under Campaigns/)).toBeInTheDocument()
  expect(screen.getByText('Above the GH₵250,000 campaign-review limit')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed every field of this proposal.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Approve this version' }))
  const confirmation = await screen.findByText((_, element) => !!element?.classList.contains('MuiAlert-message') && /^Approved “School campaign”\. Nothing is published yet: the creator must submit this exact version again by /.test(element.textContent ?? ''))
  expect(confirmation.textContent).toMatch(/Only then does the campaign appear under Campaigns, where it may also wait for a campaign review because its goal is above GH₵250,000\.$/)
  // The quoted title is the author's text, isolated from the sentence around it.
  expect(within(confirmation).getByText('School campaign').tagName).toBe('BDI')
  await waitFor(() => expect(confirmation.closest('.MuiAlert-root')).toHaveFocus())
  expect(await screen.findByText('No submissions in this queue.')).toBeInTheDocument()
  // Closing the confirmation of an emptied queue leaves focus on the toolbar, not the page body.
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.getByRole('button', { name: 'Refresh publication reviews' })).toHaveFocus()
})
it('copies the full reference and says so', async () => {
  vi.clearAllMocks()
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  try {
    get.mockResolvedValue({ items: [comment({ id: '6abd48b1c2d3e4f5a6b7c8d9' })], total: 1 })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Copy reference' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('6abd48b1c2d3e4f5a6b7c8d9'))
    expect(await screen.findByText('Copied')).toBeInTheDocument()
    writeText.mockRejectedValueOnce(new Error('Denied'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy reference' }))
    expect(await screen.findByText('Copy unavailable. Select the reference instead.')).toBeInTheDocument()
  } finally { Reflect.deleteProperty(navigator, 'clipboard') }
})
it('shows who approved a version, until when the approval works, and the audit record for staff who can read it', async () => {
  vi.clearAllMocks()
  const now = Date.now()
  const approved = comment({ id: 'approved', status: 'approved', reviewNotes: 'Reviewed the complete comment text.', reviewedBy: 'admin', reviewer: { id: 'admin', name: 'Abena Owusu', automated: false }, reviewedAt: new Date(now - 3600000).toISOString(), approvalExpiresAt: new Date(now + 6 * 86400000).toISOString() })
  get.mockResolvedValue({ items: [approved], total: 1 })
  permissions.granted = ['audit_log:read']
  const view = renderPage()
  expect(await screen.findByText(/^Approved by Abena Owusu/)).toBeInTheDocument()
  expect(screen.getByText(/^Approval valid until/)).toBeInTheDocument()
  expect(screen.getByText('Reviewed the complete comment text.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Audit record' })).toHaveAttribute('href', '/audit?search=approved')
  expect(screen.queryByLabelText('Review notes (at least 20 characters)')).toBeNull()
  view.unmount()
  permissions.granted = []
  renderPage()
  expect(await screen.findByText(/^Approved by Abena Owusu/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Audit record' })).toBeNull()
})
it('says an approval expired once its record is deleted, even before its own expiry', async () => {
  vi.clearAllMocks()
  const now = Date.now()
  get.mockResolvedValue({ items: [comment({ status: 'approved', reviewedBy: 'automated:openai', approvalExpiresAt: new Date(now + 6 * 86400000).toISOString(), purgeAt: new Date(now - 60000).toISOString() })], total: 1 })
  renderPage()
  expect(await screen.findByText(/^Approved by automated screening/)).toBeInTheDocument()
  expect(screen.getByText('Approval expired')).toBeInTheDocument()
  expect(screen.getByText(/^Approval expired \d/)).toBeInTheDocument()
})
it('blocks review of supporter content sent to the reviewer\'s own creator page', async () => {
  vi.clearAllMocks()
  get.mockImplementation(async path => path.includes('tip-content-reviews') ? { items: [{ id: 'tip', version: 'v1', actorId: 'Guest', action: 'tip.public_content', ownerId: 'reviewer', recipient: { kind: 'creator', id: 'reviewer', name: 'My page', handle: 'mine' }, text: JSON.stringify({ supporterName: 'Ama', message: 'For you' }), mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 } : { items: [], total: 0 })
  window.history.replaceState({}, '', '/publication-reviews?queue=tip-content-reviews')
  try {
    renderPage()
    expect(await screen.findByText('This was sent to your own campaign or creator page. Another administrator must review it.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Trying to review content sent to me.' } })
    expect(screen.getByRole('button', { name: 'Approve this version' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decline this version' })).toBeDisabled()
    expect(screen.getByText('My page')).toBeInTheDocument()
    expect(screen.getByText('Guest (no account)')).toBeInTheDocument()
    expect(screen.queryByText('Staff requested')).toBeNull()
    expect(screen.getByText(/not shown to the supporter/)).toBeInTheDocument()
  } finally { window.history.replaceState({}, '', '/') }
})
it('warns about invisible and text-direction characters in the submission', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [comment({ text: JSON.stringify({ authorName: 'Ama', comment: 'Pay to \u202Eemankcab\u202C now' }) })], total: 1 })
  renderPage()
  expect(await screen.findByText(/contains 2 invisible or text-direction characters \(U\+202E right-to-left override ×1, U\+202C pop directional formatting ×1\)/)).toBeInTheDocument()
})
it('starts a changed supporter message with empty notes, so notes about the old text cannot approve the new one', async () => {
  vi.clearAllMocks()
  const id = 'a'.repeat(24), v1 = '1'.repeat(64), v2 = '2'.repeat(64)
  const tip = (version: string, message: string) => ({ id, version, actorId: 'Guest', action: 'tip.public_content', ownerId: 'creator', text: JSON.stringify({ supporterName: 'Ama', message }), mediaUrls: [], status: 'pending', reason: 'staff_requested' })
  get.mockResolvedValueOnce({ items: [tip(v1, 'Thanks for the books')], total: 1 })
  get.mockResolvedValue({ items: [tip(v2, 'Send money to 0244 000 000 for a prize')], total: 1 })
  put.mockRejectedValueOnce(new ApiError('The content changed. Refresh before reviewing.', 409, { review: ['changed'] }))
  put.mockResolvedValue({})
  window.history.replaceState({}, '', '/publication-reviews?queue=tip-content-reviews')
  try {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Checked: a friendly thank-you about books.' } })
    expect(screen.queryByText(/so those notes were not carried over/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Approve this version' }))
    expect(await screen.findByText('Content changed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('Send money to 0244 000 000 for a prize')).toBeInTheDocument()
    expect(screen.getByLabelText('Review notes (at least 20 characters)')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Approve this version' })).toBeDisabled()
    expect(screen.getByText('This name or message changed after you wrote notes on it, so those notes were not carried over. Read it again and write notes for this version.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Checked the new message: it asks for money.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Decline this version' }))
    await waitFor(() => expect(put).toHaveBeenLastCalledWith(`/admin/tip-content-reviews/${id}/review`, { decision: 'rejected', notes: 'Checked the new message: it asks for money.', version: v2 }))
    expect(put.mock.calls[0][1]).toEqual({ decision: 'approved', notes: 'Checked: a friendly thank-you about books.', version: v1 })
  } finally { window.history.replaceState({}, '', '/') }
})
it('keeps the status filter fixed while a decision saves, so the reload matches the filter shown', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [comment({})], total: 1 })
  let finish: (value: unknown) => void = () => {}
  put.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  renderPage()
  fireEvent.change(await screen.findByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the complete comment text.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Approve this version' }))
  expect(screen.getByRole('combobox', { name: 'Review status' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('combobox', { name: 'Content queue' })).toHaveAttribute('aria-disabled', 'true')
  finish({})
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Review status' })).not.toHaveAttribute('aria-disabled'))
  expect(get).toHaveBeenLastCalledWith('/admin/publication-reviews?status=pending&page=1&pageSize=12')
})
it('words the status filter the way the cards do', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [], total: 0 })
  renderPage()
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Review status' }))
  expect((await screen.findAllByRole('option')).map(option => option.getAttribute('aria-label'))).toEqual(['Waiting for review', 'Approved', 'Declined'])
  fireEvent.click(screen.getByRole('option', { name: 'Declined' }))
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/admin/publication-reviews?status=rejected&page=1&pageSize=12'))
  expect(screen.getByRole('combobox', { name: 'Review status' })).toHaveTextContent('Declined')
})
it.each([
  ['tip-content-reviews', 'tip.public_content', { supporterName: 'Ama', message: 'For you' }, 'Tip sent'],
  ['donation-content-reviews', 'donation.public_content', { donorName: 'Akosua', message: 'Keep going' }, 'Donation made'],
])('dates %s by the payment, which can be older than its message', async (queue, action, fields, label) => {
  vi.clearAllMocks()
  get.mockImplementation(async path => path.includes(queue) ? { items: [{ id: 'content', version: 'c'.repeat(64), actorId: 'Guest', action, createdAt: '2026-06-01T10:00:00.000Z', text: JSON.stringify(fields), mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 } : { items: [], total: 0 })
  window.history.replaceState({}, '', `/publication-reviews?queue=${queue}`)
  try {
    renderPage()
    expect(await screen.findByText(new RegExp(`^${label} `))).toBeInTheDocument()
    // Only the "Submitted by" label remains; the date line names the payment.
    expect(screen.queryByText(/^Submitted (?!by$)/)).toBeNull()
  } finally { window.history.replaceState({}, '', '/') }
})
it('isolates account names from the labels beside them and warns about hidden characters in names', async () => {
  vi.clearAllMocks()
  // An unmatched U+2069 then a right-to-left override: without isolation the override reverses the labels after the name.
  const organization = { id: objectId('d'), name: 'Acme', email: 'team@acme.test', accountType: 'organization', organizationName: 'Acme Foundation\u2069\u202e', verificationLevel: 0, emailVerified: false, closed: false }
  get.mockResolvedValue({ items: [{ id: 'org', actorId: organization.id, resourceId: organization.id, action: 'organization.profile', author: organization, text: JSON.stringify({ organizationName: 'Acme Foundation', website: '' }), mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 })
  renderPage()
  const name = await screen.findByText('Acme Foundation\u2069\u202e')
  expect(name.tagName).toBe('BDI')
  // Direction controls in the name: also an inline block, which a stray U+2069 cannot escape.
  expect(getComputedStyle(name).display).toBe('inline-block')
  expect(name).not.toHaveTextContent('Email not verified')
  expect(name.parentElement).toHaveTextContent(/Organization account · Acme Foundation.. · Verification: None · Email not verified$/)
  expect(screen.getByText('The names on this card contain 2 invisible or text-direction characters (U+2069 pop directional isolate ×1, U+202E right-to-left override ×1). They can hide or reorder text. Check the names before deciding.')).toBeInTheDocument()
})
it('tells staff how to find an approved campaign proposal once its creator publishes it', async () => {
  vi.clearAllMocks()
  const now = Date.now()
  get.mockResolvedValue({ items: [{ id: 'proposal', actorId: 'author', action: 'campaign.create', text: JSON.stringify({ title: 'School campaign', goalAmount: 1000, currency: 'GHS' }), mediaUrls: [], status: 'approved', reason: 'staff_requested', reviewedBy: 'admin', reviewer: { id: 'admin', name: 'Abena Owusu', automated: false }, reviewedAt: new Date(now - 3600000).toISOString(), approvalExpiresAt: new Date(now + 6 * 86400000).toISOString(), reviewNotes: 'Reviewed every field of this proposal.' }], total: 1 })
  permissions.granted = ['campaigns:read']
  const view = renderPage()
  expect(await screen.findByText(/^The creator can publish this version until .+\. Once they do, it appears under Campaigns \(search for its title\)\.$/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open Campaigns' })).toHaveAttribute('href', '/campaigns')
  view.unmount()
  permissions.granted = []
  renderPage()
  expect(await screen.findByText(/^The creator can publish this version until/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Open Campaigns' })).toBeNull()
})
it('announces only failures: static guidance and warnings are notes, and decision areas are not duplicate landmarks', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [
    { id: 'proposal', actorId: 'reviewer', action: 'campaign.create', text: JSON.stringify({ title: 'School \u202ecampaign', goalAmount: 1000, currency: 'GHS' }), mediaUrls: ['https://media.example.test/cover.jpg'], status: 'pending', reason: 'media' },
    comment({ id: 'other' }),
  ], total: 2 })
  put.mockRejectedValue(new ApiError('Another reviewer already decided this submission', 409, { review: ['decided'] }))
  const view = renderPage()
  expect(await screen.findByText('What approval does')).toBeInTheDocument()
  // The approval guidance, the media and hidden-character warnings and the self-review notice.
  expect(screen.getAllByRole('note')).toHaveLength(5)
  expect(screen.queryAllByRole('alert')).toHaveLength(0)
  expect(screen.queryAllByRole('region', { name: 'Your decision' })).toHaveLength(0)
  expect(screen.getAllByRole('heading', { name: 'Your decision', level: 3 })).toHaveLength(2)
  // Media labels sit under the h3 of the media section.
  expect(screen.getByRole('heading', { name: 'Image', level: 3 })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Cover image', level: 4 })).toBeInTheDocument()
  expect(view.container.querySelectorAll('article h5, article h6')).toHaveLength(0)
  fireEvent.change(screen.getAllByLabelText('Review notes (at least 20 characters)')[1], { target: { value: 'Reviewed the complete comment text.' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Approve this version' })[1])
  expect(await screen.findByRole('alert')).toHaveTextContent('Another reviewer already decided this submission')
})
it('returns keyboard focus to the queue when the confirmation is closed or the toolbar refreshes', async () => {
  vi.clearAllMocks()
  get.mockResolvedValueOnce({ items: [comment({ id: 'first' }), comment({ id: 'second', text: 'Second comment' })], total: 2 })
  get.mockResolvedValue({ items: [comment({ id: 'second', text: 'Second comment' })], total: 1 })
  put.mockResolvedValue({})
  renderPage()
  const [notes] = await screen.findAllByLabelText('Review notes (at least 20 characters)')
  fireEvent.change(notes, { target: { value: 'Reviewed the complete comment text.' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Approve this version' })[0])
  const confirmation = await screen.findByText(/^Approved\. The author can publish this exact version /)
  await waitFor(() => expect(confirmation.closest('.MuiAlert-root')).toHaveFocus())
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.getByRole('heading', { name: 'Campaign comment', level: 2 })).toHaveFocus()
  expect(screen.queryByText(/^Approved\./)).toBeNull()
  const refresh = screen.getByRole('button', { name: 'Refresh publication reviews' })
  fireEvent.click(refresh)
  await waitFor(() => expect(refresh).toBeEnabled())
  await waitFor(() => expect(refresh).toHaveFocus())
})
