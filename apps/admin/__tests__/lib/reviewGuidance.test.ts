import { describe, expect, it } from 'vitest'
import { AUTO_PUBLISH_ACTIONS } from '@ubuntu-fund/types'
import { ApiError } from '@/lib/apiError'
import { ACTION_LABELS, parseSubmission, type PublicationReviewItem } from '@/lib/publicationReview'
import {
  AUTHOR_PUBLISHES, EXPIRED_NOT_RECORDED, PAGE_INTRO, PUBLICATION_QUEUE_INTRO, RETURNED_TO_AUTHOR, approvalEffect, autoPublishingIn, decisionConfirmation, decisionResultOf, guidanceFor,
  heldChangeNotice, heldChangeOf, pageIntro, phraseText, publicationExportText, publicationStatusLine, reviewGuidance,
} from '@/lib/reviewGuidance'

const now = Date.parse('2026-09-30T12:00:00.000Z')

describe('reviewer guidance', () => {
  it('says on the page that a decision publishes nothing by itself', () => {
    expect(PAGE_INTRO.publication).toContain('Approval publishes nothing by itself: the author must submit the same version again within 7 days of approval')
    // The record (and with it the approval) is deleted 30 days after it was created, which can come first.
    expect(PAGE_INTRO.publication).toContain('within 7 days of approval, or sooner if the proposal is deleted first (each card gives the date).')
    expect(PAGE_INTRO.content).toContain('eligible for public display straight away')
  })

  it('tells the reviewer a campaign proposal is not a campaign yet', () => {
    const guidance = reviewGuidance('campaign.create', { queue: 'publication', now, title: 'School campaign', goal: { amount: 300000, currency: 'GHS' }, campaignReviewGoalGhs: 250000, onBehalf: true, purgeAt: '2026-10-20T00:00:00.000Z' })
    expect(guidance.subtitle).toBe('Proposed campaign · not created yet')
    expect(guidance.approval.title).toBe('What approval does')
    expect(guidance.approval.lead).toMatch(/^After approval the creator must submit this same version again within 7 days; only then does the campaign appear under Campaigns\. If you approve now, that is by 7 Oct 2026, \d{2}:\d{2}\.$/)
    expect(guidance.approval.bullets).toEqual([
      'Approving creates nothing and publishes nothing.',
      'Any change, including a different cover image, needs a new review.',
      expect.stringMatching(/^Once created, the campaign may wait again under Campaigns → Pending review: goals above GH₵250,000, .* This goal is above GH₵250,000, so expect that review unless the organizer is a verified returning organizer\. It is raised on someone else’s behalf, so it may also wait for the beneficiary’s consent\.$/),
      'Approval does not authorize the goal, payouts or any movement of money.',
    ])
    expect(phraseText(guidance.confirmation.approved)).toMatch(/^Approved “School campaign”\. Nothing is published yet: the creator must submit this exact version again by 7 Oct 2026, \d{2}:\d{2}\. Only then does the campaign appear under Campaigns, where it may also wait for a campaign review because its goal is above GH₵250,000\.$/)
    // The title is the author's text: it is its own part, so the page can isolate it from the sentence.
    expect(guidance.confirmation.approved.slice(0, 3)).toEqual(['Approved “', { value: 'School campaign' }, '”.'])
    expect(phraseText(guidance.confirmation.rejected)).toBe('Declined. The author will see your notes in their Publication reviews list.')
  })

  it('falls back to "within 7 days" and "a set limit" when the API sent neither', () => {
    const guidance = reviewGuidance('campaign.create', { queue: 'publication', now, goal: { amount: 300000, currency: 'GHS' } })
    expect(guidance.approval.lead).not.toContain('If you approve now')
    expect(guidance.approval.bullets?.[2]).toContain('goals above a set limit')
    expect(guidance.approval.bullets?.[2]).not.toContain('This goal is above')
    expect(phraseText(guidance.confirmation.approved)).toBe('Approved this campaign proposal. Nothing is published yet: the creator must submit this exact version again within 7 days. Only then does the campaign appear under Campaigns.')
  })

  it('gives every publication action one sentence about what approval unlocks', () => {
    const actions = Object.keys(ACTION_LABELS).filter(action => action !== 'campaign.create' && !action.endsWith('.public_content'))
    for (const action of actions) {
      const { approval } = reviewGuidance(action, { queue: 'publication', now })
      expect(approval.title).toBeUndefined()
      expect(approval.lead).toMatch(/ within 7 days\.( Existing links keep working\.)? Any change needs a new review\.$/)
      expect(approval.lead).not.toMatch(/^Approval lets the author/)
    }
    expect(reviewGuidance('campaign.archive', { queue: 'publication', now }).approval.lead).toBe('Approval lets the author publish only this exact version, within 7 days. Any change needs a new review.')
  })

  it('uses the record’s deletion as the deadline when it comes first', () => {
    const guidance = reviewGuidance('comment.create', { queue: 'publication', now, purgeAt: '2026-10-02T08:00:00.000Z' })
    expect(guidance.approval.lead).toMatch(/^The comment appears only when the author posts it again by 2 Oct 2026, \d{2}:\d{2}\. Any change needs a new review\.$/)
    expect(phraseText(guidance.confirmation.approved)).toMatch(/^Approved\. The author can publish this exact version until 2 Oct 2026, \d{2}:\d{2}\.$/)
  })

  it('says supporter and donor content shows straight away and is not a publication', () => {
    const guidance = reviewGuidance('tip.public_content', { queue: 'content', now })
    expect(guidance.approval.lead).toBe('Approval makes this name and message eligible for public display straight away. Declining keeps them hidden; the payment is not affected.')
    expect(guidance.confirmation).toEqual({ approved: ['Approved. This name and message can now be shown publicly.'], rejected: ['Declined. This name and message stay hidden.'] })
    expect(guidance.subtitle).toBeUndefined()
  })

  it('says the content queues show names and messages as the public would see them, not as stored', () => {
    // The API sends "Anonymous" for an anonymous name and an empty message once it is hidden; the version covers what is stored.
    expect(reviewGuidance('tip.public_content', { queue: 'content', now }).boundTo).toBe('As it would appear publicly: an anonymous supporter’s name shows as “Anonymous” and a hidden message as empty. A decision applies to this content version only; a changed name or message needs a new review.')
    expect(reviewGuidance('donation.public_content', { queue: 'content', now }).boundTo).toMatch(/^As it would appear publicly: an anonymous donor’s name shows as “Anonymous”/)
    expect(reviewGuidance('tip.public_content', { queue: 'content', now }).boundTo).not.toMatch(/as stored/i)
  })

  it('describes a still-valid campaign approval', () => {
    const item = { id: 'r', actorId: 'a', action: 'campaign.create', text: JSON.stringify({ title: 'T', goalAmount: 10, currency: 'GHS' }), mediaUrls: [], status: 'approved', reason: 'media', approvalExpiresAt: '2026-10-05T10:00:00.000Z' }
    const guidance = guidanceFor(item, parseSubmission(item.action, item.text, item.mediaUrls), { queue: 'publication', now })
    expect(guidance.approvedHint).toMatch(/^The creator can publish this version until 5 Oct 2026, \d{2}:\d{2}\. Once they do, it appears under Campaigns \(search for its title\)\.$/)
  })
})

// ─── Publishing on approval ──────────────────────────────────────────────────

const review = (fields: Partial<PublicationReviewItem> = {}): PublicationReviewItem => ({ id: 'review', actorId: 'author', action: 'comment.create', text: JSON.stringify({ authorName: 'Ama', comment: 'Well done' }), mediaUrls: [], status: 'pending', reason: 'staff_requested', ...fields })
const guide = (fields: Partial<PublicationReviewItem> = {}, options: { autoPublishing?: boolean } = {}) => {
  const item = review(fields)
  return guidanceFor(item, parseSubmission(item.action, item.text, item.mediaUrls), { queue: 'publication', now, ...options })
}
const TAIL = ' If the author changed it since submitting, it won’t be published and they’ll be asked to submit the new version.'
const ago = (ms: number) => new Date(now - ms).toISOString()
const DATE_TIME = '\\d{1,2} \\w+ 2026, \\d{2}:\\d{2}'

describe('what approving does', () => {
  it('is decided only by the item’s publishOnApproval and its action', () => {
    for (const action of AUTO_PUBLISH_ACTIONS) {
      expect(approvalEffect({ action, publishOnApproval: true }), action).toBe('publishes')
      expect(approvalEffect({ action, publishOnApproval: false }), action).toBe('legacy_unlock')
      // Older APIs send no mark: the version is published by its author, as before.
      expect(approvalEffect({ action }), action).toBe('legacy_unlock')
    }
    // Live sessions and campaign proposals are never published by approval, whatever the record says.
    expect(approvalEffect({ action: 'live.start', publishOnApproval: true })).toBe('live_unlock')
    expect(approvalEffect({ action: 'campaign.create', publishOnApproval: true })).toBe('campaign_legacy')
    expect(approvalEffect({ action: 'campaign.archive', publishOnApproval: true })).toBe('legacy_unlock')
  })

  it('introduces the queue as publishing straight away only while something on it does', () => {
    expect(pageIntro('publication')).toBe(PAGE_INTRO.publication)
    expect(pageIntro('publication', true)).toBe(PUBLICATION_QUEUE_INTRO)
    expect(PUBLICATION_QUEUE_INTRO).toContain('Approving publishes it straight away, after the author’s account, sign-in, restrictions, agreement and permissions are checked again; if the author changed the item since submitting, it isn’t published.')
    expect(PUBLICATION_QUEUE_INTRO).toContain('Live-session titles, campaign proposals and versions submitted before automatic publishing aren’t published by approval; their authors submit them again.')
    expect(PUBLICATION_QUEUE_INTRO).toMatch(/Review notes are visible to the author\.$/)
    expect(pageIntro('content', true)).toBe(PAGE_INTRO.content)
  })

  it('reads publishing on approval as on only from a version that publishes by itself, and keeps what it knew when a list can’t tell', () => {
    expect(autoPublishingIn([review({ publishOnApproval: false }), review({ id: 'b', publishOnApproval: true })])).toBe(true)
    expect(autoPublishingIn([review({ status: 'approved', publishOnApproval: true })])).toBe(true)
    // Switched off (or an older API): waiting and approved versions carry no mark.
    expect(autoPublishingIn([review({ publishOnApproval: false }), review({ id: 'b' })])).toBe(false)
    expect(autoPublishingIn([review({ status: 'approved' })])).toBe(false)
    // An emptied queue, declined versions and actions it never applies to tell nothing.
    expect(autoPublishingIn([])).toBeNull()
    expect(autoPublishingIn([review({ status: 'rejected' })])).toBeNull()
    expect(autoPublishingIn([review({ action: 'live.start' }), review({ id: 'b', action: 'campaign.create' }), review({ id: 'c', action: 'tip.public_content' })])).toBeNull()
  })

  it('says what each action publishes the moment it is approved, and that a changed item is not published', () => {
    const leads: Record<string, string> = {
      'comment.create': 'Approving posts this comment on the campaign now.',
      'update.create': 'Approving posts this update now.',
      'update.edit': 'Approving replaces the current update with this edit now.',
      'campaign.slug': 'Approving changes the campaign’s web address now; existing links keep working.',
      'account.profile': 'Approving updates the public profile now.',
      'creator.profile': 'Approving updates the creator page now.',
      'organization.profile': 'Approving changes the organization’s public name and website now.',
      'thank_you.send': 'Approving emails this message to the campaign’s eligible donors now. It can’t be recalled; unsubscribed and refunded donors are skipped.',
    }
    expect(Object.keys(leads).sort()).toEqual([...AUTO_PUBLISH_ACTIONS].sort())
    for (const [action, lead] of Object.entries(leads)) {
      const { approval, confirmation, subtitle } = guide({ action, publishOnApproval: true })
      expect(approval.lead, action).toBe(`${lead}${TAIL}`)
      expect(approval.title, action).toBeUndefined()
      expect(approval.lead, action).not.toContain('Any change needs a new review')
      expect(subtitle, action).toBeUndefined()
      expect(confirmation.approved).toEqual(['Approved. Publishing is in progress; the result will show under Approved.'])
      expect(phraseText(confirmation.rejected)).toBe('Declined. The author will see your notes in their Publication reviews list.')
    }
    // Only an email that goes out at once is a warning.
    expect(guide({ action: 'thank_you.send', publishOnApproval: true }).approval.tone).toBe('warning')
    expect(guide({ action: 'comment.create', publishOnApproval: true }).approval.tone).toBeUndefined()
  })

  it('names a pinned update and a new creator page', () => {
    expect(guide({ action: 'update.create', publishOnApproval: true, applyOptions: { isPinned: true } }).approval.lead).toBe(`Approving posts this update now, pinned to the top of the campaign.${TAIL}`)
    expect(guide({ action: 'update.create', publishOnApproval: true, applyOptions: { isPinned: false } }).approval.lead).toBe(`Approving posts this update now.${TAIL}`)
    expect(guide({ action: 'creator.profile', publishOnApproval: true, baseVersion: 'new' }).approval.lead).toBe(`Approving publishes this new creator page now.${TAIL}`)
    expect(guide({ action: 'creator.profile', publishOnApproval: true, baseVersion: '3' }).approval.lead).toBe(`Approving updates the creator page now.${TAIL}`)
  })

  it('keeps live sessions, campaign proposals and earlier versions on resubmission', () => {
    const purgeAt = '2026-10-20T00:00:00.000Z'
    // Live sessions and proposals read exactly as before, whatever the record says.
    expect(guide({ action: 'live.start', text: '["Weekly broadcast",null]', publishOnApproval: true, purgeAt }, { autoPublishing: true }).approval.lead)
      .toBe(reviewGuidance('live.start', { queue: 'publication', now, purgeAt }).approval.lead)
    expect(guide({ action: 'campaign.create', text: JSON.stringify({ title: 'T' }), publishOnApproval: true }, { autoPublishing: true }).approval.title).toBe('What approval does')
    // An earlier version: today's sentence, which says so once publishing on approval is on.
    expect(guide({ purgeAt }).approval.lead).toMatch(new RegExp(`^The comment appears only when the author posts it again by ${DATE_TIME}\\. Any change needs a new review\\.$`))
    expect(guide({ purgeAt }, { autoPublishing: true }).approval.lead).toMatch(new RegExp(`^Submitted before automatic publishing: the comment appears only when the author posts it again by ${DATE_TIME}\\. Any change needs a new review\\.$`))
    expect(guide({ action: 'campaign.slug', text: 'new-address' }, { autoPublishing: true }).approval.lead).toBe('Submitted before automatic publishing: the new address takes effect only when it is saved again within 7 days. Existing links keep working. Any change needs a new review.')
    expect(phraseText(guide({ purgeAt }, { autoPublishing: true }).confirmation.approved)).toMatch(/^Approved\. The author can publish this exact version until /)
    // Not an action publishing on approval covers: no claim about it.
    expect(reviewGuidance('campaign.archive', { queue: 'publication', now, autoPublishing: true }).approval.lead).toBe('Approval lets the author publish only this exact version, within 7 days. Any change needs a new review.')
  })
})

describe('decision confirmation', () => {
  const publishes = review({ publishOnApproval: true })
  const confirm = (response: unknown, item: PublicationReviewItem = publishes, decision: 'approved' | 'rejected' = 'approved') => {
    const result = decisionResultOf(response)
    const decided = result ? { ...item, publishOnApproval: result.publishOnApproval } : item
    return decisionConfirmation(decided, decision, result, guidanceFor(decided, parseSubmission(item.action, item.text, item.mediaUrls), { queue: 'publication', now }))
  }
  const text = (confirmation: { message: Parameters<typeof phraseText>[0] }) => phraseText(confirmation.message)

  it('reads the decision answer leniently', () => {
    for (const response of [undefined, null, {}, [], 'ok', { reviewed: true }, { publishOnApproval: 'yes' }]) expect(decisionResultOf(response)).toBeNull()
    expect(decisionResultOf({ reviewed: true, publishOnApproval: false })).toEqual({ publishOnApproval: false })
    expect(decisionResultOf({ reviewed: true, publishOnApproval: true, publication: { state: 'not_published', reason: 'restricted', at: '2026-09-30T12:00:00.000Z' } })).toEqual({ publishOnApproval: true, publication: { state: 'not_published', reason: 'restricted' } })
    // A malformed publication is dropped, never the answer.
    expect(decisionResultOf({ publishOnApproval: true, publication: { state: 7 } })).toEqual({ publishOnApproval: true })
  })

  it('confirms an approval by how publishing went', () => {
    expect(confirm({ reviewed: true, publishOnApproval: true, publication: { state: 'published' } })).toEqual({ severity: 'success', message: ['Approved and published.'] })
    expect(confirm({ publishOnApproval: true, publication: { state: 'published' } }, review({ action: 'thank_you.send', text: '{"subject":"Thanks","body":"Hi"}', publishOnApproval: true })))
      .toEqual({ severity: 'success', message: ['Approved. The message is queued and the campaign’s eligible donors are being emailed.'] })
    expect(confirm({ publishOnApproval: true, publication: { state: 'publishing' } })).toEqual({ severity: 'info', message: ['Approved. Publishing is in progress; the result will show under Approved.'] })
    const refused = confirm({ publishOnApproval: true, publication: { state: 'not_published', reason: 'credentials_changed' } })
    expect(refused.severity).toBe('warning')
    expect(text(refused)).toBe("Approved, but not published: the author's password or two-step verification changed after they submitted it. The author has been told.")
    expect(text(confirm({ publishOnApproval: true, publication: { state: 'not_published', reason: 'something_new' } }))).toBe('Approved, but not published: it could not be published. The author has been told.')
    // A closed account gets no notice, so the page never says the author was told.
    expect(confirm({ publishOnApproval: true, publication: { state: 'not_published', reason: 'account_unavailable' } })).toEqual({ severity: 'warning', message: ["Approved, but not published: the author's account is closed or unavailable."] })
    expect(confirm({ publishOnApproval: true, publication: { state: 'superseded', reason: 'edited_since_submitted' } })).toEqual({ severity: 'info', message: ['Approved, but not published: the author changed it after submitting.'] })
    expect(text(confirm({ publishOnApproval: true, publication: { state: 'superseded', reason: 'newer_version_submitted' } }))).toBe('Approved, but not published: a newer version replaced it.')
    expect(confirm({ publishOnApproval: true, publication: { state: 'withdrawn', reason: 'withdrawn_by_author' } })).toEqual({ severity: 'info', message: ['Approved, but not published: the author withdrew it.'] })
  })

  it('falls back to what approving does when the answer has no outcome', () => {
    // An older API: the item's own mark decides.
    expect(confirm(undefined)).toEqual({ severity: 'info', message: ['Approved. Publishing is in progress; the result will show under Approved.'] })
    const legacy = review({ purgeAt: '2026-10-02T08:00:00.000Z' })
    const manual = confirm({}, legacy)
    expect(manual.severity).toBe('success')
    expect(text(manual)).toMatch(new RegExp(`^Approved\\. The author can publish this exact version until ${DATE_TIME}\\.$`))
    // Switched off after the list loaded: the answer, not the stale mark, says the author publishes it.
    expect(text(confirm({ reviewed: true, publishOnApproval: false }, review({ publishOnApproval: true, purgeAt: '2026-10-02T08:00:00.000Z' })))).toBe(text(manual))
    // A repeated decision on a version its author published since.
    expect(confirm({ reviewed: true, publishOnApproval: false, publication: { state: 'published' } }, legacy)).toEqual({ severity: 'success', message: ['Approved and published.'] })
  })

  it('confirms a decline the same way whatever publishing does', () => {
    expect(confirm({ reviewed: true, publishOnApproval: false }, publishes, 'rejected')).toEqual({ severity: 'success', message: ['Declined. The author will see your notes in their Publication reviews list.'] })
  })
})

describe('decided card status line', () => {
  const approved = (fields: Partial<PublicationReviewItem>) => review({ status: 'approved', reviewedAt: ago(3 * 3600000), approvalExpiresAt: new Date(now + 6 * 86400000).toISOString(), ...fields })
  const line = (fields: Partial<PublicationReviewItem>) => publicationStatusLine(approved(fields), now)

  it('says when and how a version was published', () => {
    const at = ago(2 * 3600000)
    expect(line({ publishOnApproval: true, publication: { state: 'published', at, via: 'approval', attempts: 1, resourceId: 'c'.repeat(24) } })).toEqual({ tone: 'success', text: expect.stringMatching(new RegExp(`^Published ${DATE_TIME} \\(2 hours ago\\) · by approval$`)) })
    // The author's own resubmission publishes earlier versions too.
    expect(line({ publication: { state: 'published', at, via: 'author' } })?.text).toMatch(/ · by the author$/)
    expect(line({ publication: { state: 'published' } })).toEqual({ tone: 'success', text: 'Published' })
  })

  it('shows a publication still being attempted, and when it is tried next', () => {
    expect(line({ publishOnApproval: true, publication: { state: 'queued', attempts: 0, nextAttemptAt: ago(1000) } })).toEqual({ tone: 'info', text: 'Publishing…' })
    expect(line({ publishOnApproval: true, publication: { state: 'queued', attempts: 2, nextAttemptAt: new Date(now + 5 * 60000).toISOString() } })?.text).toMatch(new RegExp(`^Publishing… attempt 2, next try ${DATE_TIME} \\(in 5 minutes\\)$`))
    expect(line({ publishOnApproval: true, publication: { state: 'queued', attempts: 3 } })?.text).toBe('Publishing… attempt 3')
    expect(line({ publishOnApproval: true, publication: { state: 'applying', attempts: 3 } })).toEqual({ tone: 'info', text: 'Publishing now, attempt 3' })
  })

  it('gives the reason a version was not published, in the shared staff wording', () => {
    expect(line({ publishOnApproval: true, publication: { state: 'not_published', reason: 'credentials_changed' } })).toEqual({ tone: 'warning', text: "Not published: the author's password or two-step verification changed after they submitted it" })
    expect(line({ publishOnApproval: true, publication: { state: 'not_published', reason: 'thank_you_limit_reached' } })?.text).toBe('Not published: the campaign has reached its thank-you message limit')
    expect(line({ publishOnApproval: true, publication: { state: 'not_published', reason: 'from_the_future' } })?.text).toBe('Not published: it could not be published')
    expect(line({ publishOnApproval: true, publication: { state: 'superseded', reason: 'edited_since_submitted' } })).toEqual({ tone: 'neutral', text: 'Not published: the author changed it after submitting' })
  })

  it('says a version was replaced or withdrawn', () => {
    expect(line({ publishOnApproval: true, publication: { state: 'superseded', reason: 'newer_version_submitted' }, supersededBy: 'e'.repeat(24) })).toEqual({ tone: 'neutral', text: 'Replaced by a newer version' })
    expect(line({ publishOnApproval: true, publication: { state: 'withdrawn', reason: 'withdrawn_by_author' } })).toEqual({ tone: 'neutral', text: 'Withdrawn by the author' })
  })

  it('hands a waiting approval back to its author while publishing on approval is switched off', () => {
    expect(line({ publishOnApproval: false, publication: { state: 'queued', attempts: 1 } })).toEqual({ tone: 'neutral', text: RETURNED_TO_AUTHOR })
    expect(RETURNED_TO_AUTHOR).toBe('Returned to the author: publishing on approval is switched off, so they publish it by submitting it again.')
    // An attempt already running ends by itself.
    expect(line({ publishOnApproval: false, publication: { state: 'applying', attempts: 1 } })?.text).toBe('Publishing now, attempt 1')
  })

  it('says an approval without publishing on approval is the author’s to use, while it lasts', () => {
    // Before publishing on approval, decided while it was off, or handed back: all read the same. An approval
    // from before the deploy may already have been used without a record, so the line never says "not published".
    expect(line({})).toEqual({ tone: 'neutral', text: AUTHOR_PUBLISHES })
    expect(AUTHOR_PUBLISHES).toBe('Not published by its approval: the author publishes it by submitting it again.')
    expect(AUTHOR_PUBLISHES).not.toMatch(/not published yet/i)
    expect(line({ approvalExpiresAt: ago(60000) })).toBeNull()
    expect(line({ approvalExpiresAt: undefined })).toBeNull()
    // A malformed publication reads as none.
    expect(line({ publication: { state: 7 } as unknown as PublicationReviewItem['publication'] })).toEqual({ tone: 'neutral', text: AUTHOR_PUBLISHES })
    // Approved to publish by itself but no state yet (an API mid-deploy): nothing to claim.
    expect(line({ publishOnApproval: true })).toBeNull()
  })

  it('adds nothing for waiting or declined versions, live sessions, campaign proposals or unknown states', () => {
    expect(publicationStatusLine(review({ publishOnApproval: true }), now)).toBeNull()
    expect(publicationStatusLine(review({ status: 'rejected', publication: { state: 'published' } }), now)).toBeNull()
    expect(line({ action: 'live.start', text: '["Live",null]' })).toBeNull()
    expect(line({ action: 'campaign.create', text: '{"title":"T"}' })).toBeNull()
    expect(line({ publishOnApproval: true, publication: { state: 'archived' } })).toBeNull()
  })

  it('exports the same line with UTC times, and what approving does for waiting versions', () => {
    expect(publicationExportText(review({ publishOnApproval: true }), now)).toBe('Publishes on approval')
    expect(publicationExportText(review({}), now)).toBe('Author submits it again after approval')
    expect(publicationExportText(approved({ publishOnApproval: true, publication: { state: 'published', at: '2026-09-30T10:00:00.000Z', via: 'approval' } }), now)).toBe('Published 30 Sept 2026, 10:00 UTC · by approval')
    expect(publicationExportText(approved({ publishOnApproval: true, publication: { state: 'queued', attempts: 1, nextAttemptAt: '2026-09-30T12:15:00.000Z' } }), now)).toBe('Publishing… attempt 1, next try 30 Sept 2026, 12:15 UTC')
    expect(publicationExportText(approved({ publishOnApproval: true, publication: { state: 'not_published', reason: 'restricted' } }), now)).toBe('Not published: publishing is restricted for the author')
    expect(publicationExportText(approved({}), now)).toBe(AUTHOR_PUBLISHES)
    // A compliance export never records as unpublished what may have been published before publications were recorded.
    expect(publicationExportText(approved({ approvalExpiresAt: ago(60000) }), now)).toBe(EXPIRED_NOT_RECORDED)
    expect(EXPIRED_NOT_RECORDED).toBe('Approval expired; no publication recorded')
    expect(publicationExportText(review({ status: 'rejected' }), now)).toBe('')
    expect(publicationExportText(approved({ action: 'live.start', text: '["Live",null]' }), now)).toBe('')
  })
})

describe('the administrator’s own held change', () => {
  const automatic = 'Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.'
  const manual = 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.'

  it('recognises a hold by its marker, or by its message from an older API', () => {
    expect(heldChangeOf(new ApiError(automatic, 409, { publication: ['held', 'publishes_on_approval'], saved: ['private'] }))).toEqual({ message: automatic, publishesOnApproval: true, savedPrivate: true })
    expect(heldChangeOf(new ApiError(manual, 409, { publication: ['held'] }))).toEqual({ message: manual, publishesOnApproval: false, savedPrivate: false })
    expect(heldChangeOf(new Error(manual))).toEqual({ message: manual, publishesOnApproval: false, savedPrivate: false })
    expect(heldChangeOf(new ApiError('Name must contain at least 2 characters', 400))).toBeNull()
    expect(heldChangeOf(new ApiError('This version is already published.', 409, { publication: ['published'] }))).toBeNull()
    expect(heldChangeOf('Saved privately for safety review.')).toBeNull()
  })

  it('asks for the same version again only when approval does not publish it', () => {
    expect(heldChangeNotice({ message: automatic, publishesOnApproval: true, savedPrivate: true })).toBe(`Your other changes are saved. ${automatic}`)
    expect(heldChangeNotice({ message: manual, publishesOnApproval: false, savedPrivate: false })).toBe(`${manual} After approval, save the same version here.`)
  })
})
