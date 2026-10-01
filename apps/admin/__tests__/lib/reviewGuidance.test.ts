import { describe, expect, it } from 'vitest'
import { ACTION_LABELS, parseSubmission } from '@/lib/publicationReview'
import { PAGE_INTRO, guidanceFor, phraseText, reviewGuidance } from '@/lib/reviewGuidance'

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
