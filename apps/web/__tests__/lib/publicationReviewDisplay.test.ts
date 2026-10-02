import { describe, expect, it } from 'vitest'
import {
  AUTO_PUBLISH_ACTIONS,
  PUBLICATION_ACTIONS,
  PUBLICATION_NOT_PUBLISHED_REASONS,
  PUBLICATION_PUBLISHING_SLOW_MS,
  PUBLICATION_REVIEW_SUBJECT_MAX,
  describePublicationReview,
  isPublicationAction,
  parsePublicationReviewPage,
  publicationActionLabel,
  publicationReasonCopy,
  publicationReviewStage,
  publicationReviewSubject,
  publishesWhenApproved,
  waitingThankYou,
  type AutoPublishAction,
  type PublicationAction,
  type PublicationReviewItem,
  type PublicationReviewPublication,
} from '@ubuntu-fund/types'

const NOW = new Date('2026-09-30T12:00:00.000Z')
const IN_A_WEEK = '2026-10-07T12:00:00.000Z'
/** Deterministic dates, so the copy is checked without depending on the machine's locale. */
const options = { now: NOW, formatDate: (date: Date) => `day ${date.toISOString()}`, formatDateTime: (date: Date) => `time ${date.toISOString()}` }
const review = (fields: Partial<PublicationReviewItem> = {}): PublicationReviewItem => ({ id: 'r1', action: 'campaign.create', text: '{}', status: 'pending', ...fields })

/** The text each action binds for review, built the way the API builds it. */
const SUBMISSIONS: Record<PublicationAction, { label: string; text: string; mediaUrls?: string[]; subject: string }> = {
  'campaign.create': {
    label: 'New campaign',
    text: JSON.stringify({ title: 'Clean water for Tamale', description: 'Private campaign story', category: 'health', priority: 'high', beneficiaries: 'Families', goalAmount: 5000, currency: 'GHS', endDate: '2026-12-01T00:00:00.000Z' }),
    subject: 'Clean water for Tamale',
  },
  'campaign.slug': { label: 'Campaign link', text: 'clean-water-tamale', subject: 'clean-water-tamale' },
  'live.start': { label: 'Live session title', text: JSON.stringify(['Friday fundraiser', 500]), subject: 'Friday fundraiser' },
  'account.profile': {
    label: 'Profile',
    text: JSON.stringify({ name: 'Ama Mensah', avatarUrl: 'https://cdn.test/new-avatar.png', coverUrl: 'https://cdn.test/old-cover.png', country: 'Ghana', publicProfile: true }),
    mediaUrls: ['https://cdn.test/new-avatar.png'],
    subject: 'Ama Mensah, new photo',
  },
  'creator.profile': {
    label: 'Creator page',
    text: JSON.stringify({ handle: 'amacooks', displayName: "Ama's Kitchen", tagline: 'Recipes', bio: 'Private biography', avatarUrl: 'https://cdn.test/a.png', coverUrl: 'https://cdn.test/c.png', tipsEnabled: true, presetAmounts: [10, 25], currency: 'GHS', thankYouMessage: 'Thanks' }),
    mediaUrls: ['https://cdn.test/a.png', 'https://cdn.test/c.png'],
    subject: "Ama's Kitchen, new photo and cover",
  },
  'organization.profile': { label: 'Organization details', text: JSON.stringify({ organizationName: 'Helping Hands Foundation', website: 'https://helping.test' }), subject: 'Helping Hands Foundation' },
  'comment.create': { label: 'Comment', text: JSON.stringify({ authorName: 'Kofi', comment: 'Praying for you.\n\nStay strong!' }), subject: 'Praying for you. Stay strong!' },
  'update.create': { label: 'Campaign update', text: JSON.stringify(['We reached 50%', 'Private update body', 'milestone']), subject: 'We reached 50%' },
  'update.edit': { label: 'Edited campaign update', text: JSON.stringify(['Corrected totals', 'Private update body', 'general']), subject: 'Corrected totals' },
  'thank_you.send': { label: 'Thank-you message', text: JSON.stringify({ subject: 'Thank you all', body: 'Private message body', signature: 'Ama' }), subject: 'Thank you all' },
}

/** How each form asks for the same version again, after "If …,". */
const APPROVED_HINTS: Record<PublicationAction, string> = {
  'campaign.create': "Approved. If it isn't public yet, submit it again unchanged before",
  'campaign.slug': "Approved. If it isn't public yet, save it again unchanged before",
  'live.start': "Approved. If you haven't gone live yet, start the session again with the same title and goal before",
  'account.profile': "Approved. If it isn't public yet, save it again unchanged before",
  'creator.profile': "Approved. If it isn't public yet, save it again unchanged before",
  'organization.profile': "Approved. If it isn't public yet, save it again unchanged before",
  'comment.create': "Approved. If it isn't public yet, post it again unchanged before",
  'update.create': "Approved. If it isn't public yet, post it again unchanged before",
  'update.edit': "Approved. If it isn't public yet, save it again unchanged before",
  'thank_you.send': "Approved. If you haven't sent it yet, send the same message again before",
}

const MALFORMED = ['', 'not json', '{', '[]', '{}', 'null', '42', '"just text"', '[null, 5]', '[{}]', JSON.stringify({ title: 42, subject: null, comment: ['x'], name: {}, displayName: false, handle: 7, organizationName: true, avatarUrl: 5 })]

describe('publication action labels', () => {
  it('covers every action the API can hold', () => {
    expect(Object.keys(SUBMISSIONS).sort()).toEqual([...PUBLICATION_ACTIONS].sort())
    for (const action of PUBLICATION_ACTIONS) expect(isPublicationAction(action)).toBe(true)
    expect(isPublicationAction('campaign')).toBe(false)
  })

  it.each(PUBLICATION_ACTIONS)('names %s and reads its subject from the submitted text', action => {
    const { label, text, mediaUrls, subject } = SUBMISSIONS[action]
    expect(publicationActionLabel(action)).toBe(label)
    expect(publicationReviewSubject({ action, text, mediaUrls })).toBe(subject)
  })

  it('names an action this client does not know yet in plain words', () => {
    expect(publicationActionLabel('donation.message_edit')).toBe('Donation message edit')
    expect(publicationActionLabel('')).toBe('Submission')
    expect(publicationReviewSubject({ action: 'donation.message', text: JSON.stringify({ title: 'Hidden' }) })).toBe('')
  })
})

describe('publication review subject', () => {
  it.each(PUBLICATION_ACTIONS.flatMap(action => MALFORMED.map(text => [action, text] as const)))('never throws on malformed %s text %j', (action, text) => {
    const subject = publicationReviewSubject({ action, text, mediaUrls: ['https://cdn.test/a.png'] })
    // A link is the text itself (clipped like any subject); everything else is structured and yields nothing usable here.
    const line = text.replace(/\s+/g, ' ').trim()
    expect(subject).toBe(action !== 'campaign.slug' ? '' : line.length <= 80 ? line : `${line.slice(0, 79)}…`)
  })

  it('survives values the API contract does not allow', () => {
    expect(publicationReviewSubject({ action: 'comment.create', text: undefined as unknown as string })).toBe('')
    expect(publicationReviewSubject({ action: 'account.profile', text: SUBMISSIONS['account.profile'].text, mediaUrls: 'x' as unknown as string[] })).toBe('Ama Mensah')
  })

  it('keeps a comment excerpt within 80 characters, breaking between words', () => {
    const subject = publicationReviewSubject({ action: 'comment.create', text: JSON.stringify({ authorName: 'Kofi', comment: 'We are praying for your recovery '.repeat(10) }) })
    expect(PUBLICATION_REVIEW_SUBJECT_MAX).toBe(80)
    expect(subject).toBe('We are praying for your recovery We are praying for your recovery We are…')
    expect(subject.length).toBeLessThanOrEqual(80)
  })

  it('cuts one long word at the limit and never splits an emoji', () => {
    const word = publicationReviewSubject({ action: 'comment.create', text: JSON.stringify({ comment: 'x'.repeat(200) }) })
    expect(word).toBe(`${'x'.repeat(79)}…`)
    const emoji = publicationReviewSubject({ action: 'comment.create', text: JSON.stringify({ comment: '😀'.repeat(200) }) })
    const chars = Array.from(emoji)
    expect(chars).toHaveLength(80)
    expect(chars.slice(0, -1).every(char => char === '😀')).toBe(true)
  })

  it('puts a title with line breaks on one line', () => {
    expect(publicationReviewSubject({ action: 'campaign.create', text: JSON.stringify({ title: '  Clean\n\nwater\tfor all  ' }) })).toBe('Clean water for all')
  })

  it('mentions only the images the API lists as newly proposed', () => {
    const account = SUBMISSIONS['account.profile'].text
    expect(publicationReviewSubject({ action: 'account.profile', text: account, mediaUrls: [] })).toBe('Ama Mensah')
    expect(publicationReviewSubject({ action: 'account.profile', text: account })).toBe('Ama Mensah')
    expect(publicationReviewSubject({ action: 'account.profile', text: JSON.stringify({ name: '', avatarUrl: 'https://cdn.test/p.png' }), mediaUrls: ['https://cdn.test/p.png'] })).toBe('New photo')
    expect(publicationReviewSubject({ action: 'account.profile', text: JSON.stringify({ name: 'Ama', avatarUrl: '' }), mediaUrls: [''] })).toBe('Ama')
    expect(publicationReviewSubject({ action: 'creator.profile', text: JSON.stringify({ handle: 'amacooks', displayName: '', coverUrl: 'https://cdn.test/c.png' }), mediaUrls: ['https://cdn.test/c.png'] })).toBe('@amacooks, new cover')
  })

  it('leaves the subject empty when a live session has no title', () => {
    expect(publicationReviewSubject({ action: 'live.start', text: JSON.stringify(['', 200]) })).toBe('')
  })
})

describe('publication review stage', () => {
  const states = (item: PublicationReviewItem) => publicationReviewStage(item, options).steps.map(step => step.state)
  const labels = (item: PublicationReviewItem) => publicationReviewStage(item, options).steps.map(step => step.label)

  it('shows a pending version as in review, with a person checking it', () => {
    const stage = publicationReviewStage(review(), options)
    expect(stage).toMatchObject({ phase: 'in_review', label: 'In review', hint: 'A person is checking it.' })
    expect(states(review())).toEqual(['complete', 'current', 'upcoming'])
    expect(labels(review())).toEqual(['Submitted', 'In review', 'Approved'])
    expect(stage.steps[2].detail).toBeUndefined()
    expect(stage.support).toBeUndefined()
  })

  it('dates the Submitted step only when the submission date is known and valid', () => {
    expect(publicationReviewStage(review({ createdAt: '2026-09-29T08:00:00.000Z' }), options).steps[0].detail).toBe('day 2026-09-29T08:00:00.000Z')
    expect(publicationReviewStage(review(), options).steps[0].detail).toBeUndefined()
    expect(publicationReviewStage(review({ createdAt: 'yesterday' }), options).steps[0].detail).toBeUndefined()
  })

  it.each(PUBLICATION_ACTIONS)('tells the author of an approved %s how to publish it and by when', action => {
    const stage = publicationReviewStage(review({ action, status: 'approved', approvalExpiresAt: IN_A_WEEK }), options)
    expect(stage.phase).toBe('approved')
    expect(stage.label).toBe('Approved')
    expect(stage.steps.map(step => [step.label, step.state])).toEqual([['Submitted', 'complete'], ['In review', 'complete'], ['Approved', 'complete']])
    expect(stage.steps[2].detail).toBeUndefined()
    expect(stage.hint).toBe(`${APPROVED_HINTS[action]} time ${IN_A_WEEK}.`)
    expect(stage.support).toBeUndefined()
  })

  it('treats an approval at or past its deadline as expired', () => {
    for (const approvalExpiresAt of ['2026-09-30T11:59:00.000Z', NOW.toISOString()]) {
      const stage = publicationReviewStage(review({ status: 'approved', approvalExpiresAt }), options)
      expect(stage.phase).toBe('approval_expired')
      expect(stage.label).toBe('Approval expired')
      // The tracker itself says so, not only the hint.
      expect(stage.steps[2]).toEqual({ key: 'decision', label: 'Approved', state: 'complete', detail: 'Expired' })
      expect(stage.hint).toBe("Approval expired. If it isn't public yet, submit it again to request a new review.")
    }
    expect(states(review({ status: 'approved', approvalExpiresAt: '2026-09-01T00:00:00.000Z' }))).toEqual(['complete', 'complete', 'complete'])
    expect(publicationReviewStage(review({ action: 'live.start', status: 'approved', approvalExpiresAt: '2026-09-01T00:00:00.000Z' }), options).hint)
      .toBe("Approval expired. If you haven't gone live yet, start the session again to request a new review.")
  })

  it('treats an approval without a readable deadline as expired, like the API', () => {
    expect(publicationReviewStage(review({ status: 'approved' }), options).phase).toBe('approval_expired')
    expect(publicationReviewStage(review({ status: 'approved', approvalExpiresAt: 'soon' }), options).phase).toBe('approval_expired')
  })

  it('shows a declined version with how to go on and the reference support needs', () => {
    const stage = publicationReviewStage(review({ id: '64f0c0ffee', status: 'rejected' }), options)
    expect(stage).toMatchObject({ phase: 'declined', label: 'Declined', hint: 'Declined. Change it before you submit it again.', support: 'Questions? support@ujimora.com, reference 64f0c0ffee' })
    expect(stage.steps.map(step => [step.label, step.state])).toEqual([['Submitted', 'complete'], ['In review', 'complete'], ['Declined', 'failed']])
    expect(publicationReviewStage(review({ action: 'comment.create', status: 'rejected' }), options).hint).toBe('Declined. Change it before you post it again.')
    expect(publicationReviewStage(review({ action: 'thank_you.send', status: 'rejected' }), options).hint).toBe('Declined. Change it before you send it again.')
  })

  it('shows a status this client does not know yet without guessing what it means', () => {
    const stage = publicationReviewStage(review({ status: 'publish_failed' }), options)
    expect(stage).toMatchObject({ phase: 'other', label: 'Publish failed', hint: '' })
    expect(stage.steps.map(step => [step.label, step.state])).toEqual([['Submitted', 'complete'], ['In review', 'complete'], ['Publish failed', 'current']])
    expect(stage.support).toBeUndefined()
    expect(publicationReviewStage(review({ status: '' }), options).label).toBe('Updated')
  })

  it('formats dates in the device locale by default', () => {
    const stage = publicationReviewStage(review({ status: 'approved', approvalExpiresAt: IN_A_WEEK, createdAt: '2026-09-29T08:00:00.000Z' }), { now: NOW })
    const deadline = new Date(IN_A_WEEK).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    expect(stage.hint).toBe(`Approved. If it isn't public yet, submit it again unchanged before ${deadline}.`)
    expect(stage.steps[0].detail).toBe(new Date('2026-09-29T08:00:00.000Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
  })
})

describe('publication review stage, publishing on approval', () => {
  const SUBMITTED_AT = '2026-09-29T08:00:00.000Z'
  /** An approved comment its approval publishes by itself; `publication` says how far that got. */
  const approved = (publication: PublicationReviewPublication | undefined, fields: Partial<PublicationReviewItem> = {}) =>
    review({ action: 'comment.create', status: 'approved', approvalExpiresAt: IN_A_WEEK, publishOnApproval: true, canWithdraw: false, publication, ...fields })
  /** Each step as [key, label, state] plus its detail when it has one. */
  const tracker = (item: PublicationReviewItem) =>
    publicationReviewStage(item, options).steps.map(({ key, label, state, detail }) => [key, label, state, ...(detail ? [detail] : [])])
  const APPROVED = [['submitted', 'Submitted', 'complete'], ['review', 'In review', 'complete'], ['decision', 'Approved', 'complete']]
  const MINUTE = 60_000
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

  it.each(AUTO_PUBLISH_ACTIONS)('tells the author of a waiting %s that its approval publishes it', action => {
    const item = review({ action, publishOnApproval: true, canWithdraw: true, createdAt: SUBMITTED_AT })
    const stage = publicationReviewStage(item, options)
    expect(stage).toMatchObject({ phase: 'in_review', label: 'In review', hint: "A person is checking it. It's published automatically once approved." })
    expect(stage.support).toBeUndefined()
    expect(tracker(item)).toEqual([
      ['submitted', 'Submitted', 'complete', `day ${SUBMITTED_AT}`],
      ['review', 'In review', 'current'],
      ['decision', 'Approved', 'upcoming'],
      ['publish', 'Published', 'upcoming'],
    ])
  })

  it('keeps three steps for a waiting version its author publishes', () => {
    for (const publishOnApproval of [false, undefined]) {
      const item = review({ action: 'comment.create', publishOnApproval })
      expect(publicationReviewStage(item, options).hint).toBe('A person is checking it.')
      expect(tracker(item)).toEqual([['submitted', 'Submitted', 'complete'], ['review', 'In review', 'current'], ['decision', 'Approved', 'upcoming']])
    }
  })

  it('shows an approved version being published', () => {
    const item = approved({ state: 'publishing', at: ago(MINUTE) })
    const stage = publicationReviewStage(item, options)
    expect(stage).toMatchObject({ phase: 'publishing', label: 'Publishing', hint: 'Approved. Publishing now.' })
    expect(stage.support).toBeUndefined()
    expect(tracker(item)).toEqual([...APPROVED, ['publish', 'Publishing', 'current']])
  })

  it('says publishing is taking longer than usual once ten minutes have passed, judged against the given moment', () => {
    const SLOW = "Approved. Publishing is taking longer than usual; we'll keep trying."
    const hint = (at: string | undefined, now = NOW) => publicationReviewStage(approved({ state: 'publishing', ...(at ? { at } : {}) }), { ...options, now }).hint
    expect(PUBLICATION_PUBLISHING_SLOW_MS).toBe(10 * MINUTE)
    expect(hint(ago(10 * MINUTE - 1000))).toBe('Approved. Publishing now.')
    expect(hint(ago(10 * MINUTE))).toBe(SLOW)
    expect(hint(ago(180 * MINUTE))).toBe(SLOW)
    // The same attempt, looked at nine minutes later.
    expect(hint(ago(MINUTE), new Date(NOW.getTime() + 9 * MINUTE))).toBe(SLOW)
    // Without a readable start, or with one ahead of this device's clock, it is never called slow.
    expect(hint(undefined)).toBe('Approved. Publishing now.')
    expect(hint('a while ago')).toBe('Approved. Publishing now.')
    expect(hint(ago(-30 * MINUTE))).toBe('Approved. Publishing now.')
    // Only the words change; the tracker stays the same.
    expect(tracker(approved({ state: 'publishing', at: ago(30 * MINUTE) }))).toEqual([...APPROVED, ['publish', 'Publishing', 'current']])
  })

  const PUBLISHED_HINTS: Record<AutoPublishAction, string> = {
    'account.profile': 'Approved and now on your public profile.',
    'creator.profile': 'Approved and now on your creator page.',
    'organization.profile': "Approved and now on the organization's public page.",
    'comment.create': 'Approved and posted on the campaign.',
    'update.create': 'Approved and posted on the campaign.',
    'update.edit': 'Approved; the campaign update now shows your changes.',
    'thank_you.send': "Approved; we're emailing your donors and will send you a delivery summary.",
    'campaign.slug': 'Approved; the campaign now uses its new web address. Existing links keep working.',
  }

  it.each(AUTO_PUBLISH_ACTIONS)('shows a published %s with its date and what it changed', action => {
    const at = '2026-09-30T11:00:00.000Z'
    const item = approved({ state: 'published', at }, { action })
    expect(publicationReviewStage(item, options)).toMatchObject({ phase: 'published', label: 'Published', hint: PUBLISHED_HINTS[action] })
    expect(tracker(item)).toEqual([...APPROVED, ['publish', 'Published', 'complete', `day ${at}`]])
  })

  it('shows a published version as published for good, however it got there', () => {
    // Its approval has run out since; or its author published it by submitting it again, which needs no publishOnApproval.
    for (const fields of [{ approvalExpiresAt: '2026-09-01T00:00:00.000Z' }, { approvalExpiresAt: undefined }, { publishOnApproval: false }, { publishOnApproval: undefined }]) {
      expect(publicationReviewStage(approved({ state: 'published' }, fields), options)).toMatchObject({ phase: 'published', hint: 'Approved and posted on the campaign.' })
    }
    // Without a readable date, the step says no more.
    expect(tracker(approved({ state: 'published' })).at(-1)).toEqual(['publish', 'Published', 'complete'])
    expect(tracker(approved({ state: 'published', at: 'today' })).at(-1)).toEqual(['publish', 'Published', 'complete'])
  })

  it('says why a version was not published, and how to publish it while the approval lasts', () => {
    const SIGN_IN = 'Your sign-in details changed since you submitted it (a password or two-step verification change).'
    const item = approved({ state: 'not_published', reason: 'credentials_changed', at: ago(5 * MINUTE) }, { action: 'account.profile' })
    const stage = publicationReviewStage(item, options)
    expect(stage).toMatchObject({ phase: 'not_published', label: 'Not published', hint: `${SIGN_IN} Save it again before time ${IN_A_WEEK} to publish it straight away.` })
    expect(stage.support).toBeUndefined()
    expect(tracker(item)).toEqual([...APPROVED, ['publish', "Couldn't publish", 'failed']])
  })

  it('once the approval has run out, says the same version only goes back for a new review, like the API', () => {
    const SIGN_IN = 'Your sign-in details changed since you submitted it (a password or two-step verification change).'
    // Run out, or without a readable deadline: the API reopens the version for a fresh decision instead of publishing it.
    for (const approvalExpiresAt of [NOW.toISOString(), '2026-09-01T00:00:00.000Z', undefined, 'soon']) {
      for (const [action, verb] of [['account.profile', 'Save'], ['comment.create', 'Post'], ['thank_you.send', 'Send']]) {
        const item = approved({ state: 'not_published', reason: 'credentials_changed' }, { action, approvalExpiresAt })
        expect(publicationReviewStage(item, options).hint).toBe(`${SIGN_IN} ${verb} it again to request a new review.`)
        // The tracker marks the approval as over, as it does for a plain approval that expired.
        expect(tracker(item)).toEqual([...APPROVED.slice(0, 2), ['decision', 'Approved', 'complete', 'Expired'], ['publish', "Couldn't publish", 'failed']])
      }
    }
    // Reasons with nothing to submit again read the same either way.
    const restricted = approved({ state: 'not_published', reason: 'restricted' }, { approvalExpiresAt: '2026-09-01T00:00:00.000Z' })
    expect(publicationReviewStage(restricted, options).hint).toBe('Publishing is restricted on this account. Contact support@ujimora.com to appeal.')
  })

  it.each(['comment.create', 'update.create'])('never promises that posting a %s again publishes it, since its form was cleared', action => {
    // Only a word-for-word repost would use the approval; the card shows just a one-line subject.
    const hint = (approvalExpiresAt?: string) => publicationReviewStage(approved({ state: 'not_published', reason: 'unavailable' }, { action, approvalExpiresAt }), options).hint
    expect(hint(IN_A_WEEK)).toBe('Something went wrong on our side while publishing it. Post it again if you still want it published.')
    expect(hint('2026-09-01T00:00:00.000Z')).toBe('Something went wrong on our side while publishing it. Post it again to request a new review.')
  })

  it("words the next step in each form's own terms", () => {
    const hint = (action: string, reason: string) => publicationReviewStage(approved({ state: 'not_published', reason }, { action }), options).hint
    expect(hint('account.profile', 'terms_not_accepted')).toBe(`You need to accept the current account agreement before it can be published. Save it again before time ${IN_A_WEEK} to publish it straight away.`)
    expect(hint('thank_you.send', 'thank_you_no_donors')).toBe(`The campaign has no donors to email yet. Send it again before time ${IN_A_WEEK} to publish it straight away.`)
    expect(hint('creator.profile', 'handle_taken')).toBe('Someone else has that handle now. Submit your latest version if it still needs review.')
    expect(hint('campaign.slug', 'approval_expired')).toBe('The approval ran out before it could be published. Submit your latest version if it still needs review.')
    expect(hint('update.create', 'restricted')).toBe('Publishing is restricted on this account. Contact support@ujimora.com to appeal.')
    expect(hint('organization.profile', 'permission_changed')).toBe("You no longer have permission to make this change. Ask the account's owner if it's still needed.")
  })

  it.each(PUBLICATION_NOT_PUBLISHED_REASONS)('explains %s with the shared reason copy and its next step', reason => {
    const { author, resubmit } = publicationReasonCopy(reason)
    const next = {
      same_version: `Save it again before time ${IN_A_WEEK} to publish it straight away.`,
      new_version: 'Submit your latest version if it still needs review.',
      none: '',
    }[resubmit]
    expect(publicationReviewStage(approved({ state: 'not_published', reason }, { action: 'creator.profile' }), options).hint).toBe(next ? `${author} ${next}` : author)
  })

  it('reads a reason this client does not know yet, or none, as a generic one', () => {
    for (const reason of ['reason_from_a_newer_api', undefined]) {
      const stage = publicationReviewStage(approved({ state: 'not_published', ...(reason ? { reason } : {}) }), options)
      expect(stage.phase).toBe('not_published')
      expect(stage.hint).toBe("It couldn't be published. Submit your latest version if it still needs review.")
    }
  })

  it('shows an approved version that changed since it was submitted, or was replaced, as replaced', () => {
    const edited = approved({ state: 'superseded', reason: 'edited_since_submitted', at: ago(5 * MINUTE) }, { action: 'update.edit' })
    expect(publicationReviewStage(edited, options)).toMatchObject({
      phase: 'superseded',
      label: 'Replaced',
      hint: "It changed after you submitted it, so this version wasn't published. Submit your latest version if it still needs review.",
    })
    expect(tracker(edited)).toEqual([...APPROVED, ['publish', 'Replaced', 'skipped']])
    const newer = approved({ state: 'superseded', reason: 'newer_version_submitted' }, { action: 'creator.profile' })
    expect(publicationReviewStage(newer, options)).toMatchObject({ phase: 'superseded', label: 'Replaced', hint: 'You (or your team) submitted a newer version.' })
    expect(tracker(newer)).toEqual([...APPROVED, ['publish', 'Replaced', 'skipped']])
  })

  it('shows a version replaced before any decision in two steps', () => {
    for (const publication of [{ state: 'superseded', reason: 'newer_version_submitted', at: ago(5 * MINUTE) }, undefined]) {
      const item = review({ action: 'creator.profile', status: 'superseded', createdAt: SUBMITTED_AT, publishOnApproval: true, canWithdraw: false, publication })
      const stage = publicationReviewStage(item, options)
      expect(stage).toMatchObject({ phase: 'superseded', label: 'Replaced', hint: 'You (or your team) submitted a newer version.' })
      expect(stage.support).toBeUndefined()
      expect(tracker(item)).toEqual([['submitted', 'Submitted', 'complete', `day ${SUBMITTED_AT}`], ['decision', 'Replaced', 'skipped']])
    }
  })

  it('shows a withdrawn version, before or after its approval', () => {
    const WITHDRAWN = "You withdrew it. It won't be published."
    for (const publication of [{ state: 'withdrawn', reason: 'withdrawn_by_author' }, undefined]) {
      const before = review({ action: 'comment.create', status: 'withdrawn', publication })
      expect(publicationReviewStage(before, options)).toMatchObject({ phase: 'withdrawn', label: 'Withdrawn', hint: WITHDRAWN })
      expect(tracker(before)).toEqual([['submitted', 'Submitted', 'complete'], ['decision', 'Withdrawn', 'skipped']])
    }
    const after = approved({ state: 'withdrawn', reason: 'withdrawn_by_author', at: ago(MINUTE) })
    expect(publicationReviewStage(after, options)).toMatchObject({ phase: 'withdrawn', label: 'Withdrawn', hint: WITHDRAWN })
    expect(tracker(after)).toEqual([...APPROVED, ['publish', 'Withdrawn', 'skipped']])
  })

  it('keeps the three-step approval while its author publishes it by submitting it again', () => {
    // A live session, a version held before publishing on approval, a screening approval, or one waiting while it is switched off.
    const item = review({ action: 'comment.create', status: 'approved', approvalExpiresAt: IN_A_WEEK, publishOnApproval: true })
    expect(publicationReviewStage(item, options)).toMatchObject({ phase: 'approved', label: 'Approved', hint: `Approved. If it isn't public yet, post it again unchanged before time ${IN_A_WEEK}.` })
    expect(tracker(item)).toEqual(APPROVED)
    expect(publicationReviewStage({ ...item, approvalExpiresAt: '2026-09-01T00:00:00.000Z' }, options)).toMatchObject({
      phase: 'approval_expired',
      hint: "Approval expired. If it isn't public yet, post it again to request a new review.",
    })
  })

  it('leaves a declined version as it was', () => {
    const item = review({ id: '64f0c0ffee', action: 'comment.create', status: 'rejected', publishOnApproval: true, canWithdraw: false })
    expect(publicationReviewStage(item, options)).toMatchObject({
      phase: 'declined',
      label: 'Declined',
      hint: 'Declined. Change it before you post it again.',
      support: 'Questions? support@ujimora.com, reference 64f0c0ffee',
    })
    expect(tracker(item)).toEqual([['submitted', 'Submitted', 'complete'], ['review', 'In review', 'complete'], ['decision', 'Declined', 'failed']])
  })

  it('reads exactly as before when the API reports publishing on approval switched off', () => {
    // Switched off, the API sends publishOnApproval false, and no publication for a version waiting for a decision or to be published.
    for (const status of ['pending', 'approved', 'rejected', 'publish_failed']) {
      for (const action of PUBLICATION_ACTIONS) {
        for (const approvalExpiresAt of [IN_A_WEEK, '2026-09-01T00:00:00.000Z']) {
          const fields = { action, status, approvalExpiresAt, createdAt: SUBMITTED_AT }
          expect(publicationReviewStage(review({ ...fields, publishOnApproval: false, canWithdraw: false }), options)).toEqual(publicationReviewStage(review(fields), options))
        }
      }
    }
  })

  it('shows a publication state this client does not know yet as itself, without guessing', () => {
    const item = approved({ state: 'scheduled_for_later', reason: 'reason_from_a_newer_api' })
    expect(publicationReviewStage(item, options)).toMatchObject({ phase: 'other', label: 'Scheduled for later', hint: '' })
    expect(tracker(item)).toEqual([...APPROVED, ['publish', 'Scheduled for later', 'current']])
  })

  it('goes by the review status first', () => {
    // The API reports publishing only for approved versions and ones closed before a decision.
    expect(publicationReviewStage(review({ publication: { state: 'published' } }), options).phase).toBe('in_review')
    expect(publicationReviewStage(review({ status: 'rejected', publication: { state: 'published' } }), options).phase).toBe('declined')
    expect(publicationReviewStage(review({ status: 'publish_failed', publication: { state: 'published' } }), options).phase).toBe('other')
  })
})

describe('describePublicationReview', () => {
  it('describes a card without the submitted content itself', () => {
    const { label, subject, note, stage } = describePublicationReview(review({ text: SUBMISSIONS['campaign.create'].text, status: 'approved', approvalExpiresAt: IN_A_WEEK, reviewNotes: '  Reviewed safely.  ' }), options)
    expect({ label, subject, note, phase: stage.phase }).toEqual({ label: 'New campaign', subject: 'Clean water for Tamale', note: 'Reviewed safely.', phase: 'approved' })
    expect(JSON.stringify(describePublicationReview(review({ text: SUBMISSIONS['campaign.create'].text }), options))).not.toContain('Private campaign story')
  })

  it('leaves out an empty note', () => {
    expect(describePublicationReview(review({ reviewNotes: '   ' }), options)).not.toHaveProperty('note')
    expect(describePublicationReview(review(), options)).not.toHaveProperty('note')
  })

  it('describes where publishing stands without the submitted content', () => {
    const item = review({
      action: 'update.create', text: SUBMISSIONS['update.create'].text, status: 'approved', approvalExpiresAt: IN_A_WEEK,
      publishOnApproval: true, canWithdraw: true, publication: { state: 'not_published', reason: 'credentials_changed' },
    })
    const { label, subject, stage } = describePublicationReview(item, options)
    expect({ label, subject, phase: stage.phase, steps: stage.steps.length }).toEqual({ label: 'Campaign update', subject: 'We reached 50%', phase: 'not_published', steps: 4 })
    expect(JSON.stringify(describePublicationReview(item, options))).not.toContain('Private update body')
  })
})

describe('parsePublicationReviewPage', () => {
  const valid = { id: 'r1', action: 'comment.create', resourceId: 'c1', text: '{}', mediaUrls: ['https://cdn.test/a.png'], status: 'approved', reason: 'screening', createdAt: '2026-09-29T08:00:00.000Z', reviewNotes: 'Fine.', approvalExpiresAt: IN_A_WEEK }

  it('keeps the fields a card uses and drops the rest', () => {
    expect(parsePublicationReviewPage({ total: 1, items: [valid] })).toEqual({
      total: 1,
      items: [{ id: 'r1', action: 'comment.create', resourceId: 'c1', text: '{}', mediaUrls: ['https://cdn.test/a.png'], status: 'approved', createdAt: '2026-09-29T08:00:00.000Z', reviewNotes: 'Fine.', approvalExpiresAt: IN_A_WEEK }],
    })
  })

  it.each([[null], [5], [''], [{}]])('leaves out a malformed resourceId (%j) and still lists the version', resourceId => {
    const page = parsePublicationReviewPage({ total: 1, items: [{ ...valid, resourceId }] })
    expect(page?.items[0]).not.toHaveProperty('resourceId')
    expect(page?.items[0]).toMatchObject({ id: 'r1', action: 'comment.create', status: 'approved' })
  })

  it('treats missing or null optional fields as absent', () => {
    expect(parsePublicationReviewPage({ total: 1, items: [{ id: 'r1', action: 'live.start', text: '[]', status: 'pending', mediaUrls: null, reviewNotes: null, approvalExpiresAt: null }] }))
      .toEqual({ total: 1, items: [{ id: 'r1', action: 'live.start', text: '[]', status: 'pending' }] })
  })

  it.each([
    [], null, 'items', { items: [], total: -1 }, { items: [], total: 1.5 }, { items: {}, total: 0 }, { items: [null], total: 1 },
    { items: [{ id: 'bad', action: null, text: '', status: 'pending' }], total: 1 },
    { items: [{ ...valid, reviewNotes: 5 }], total: 1 },
    { items: [{ ...valid, mediaUrls: 'https://cdn.test/a.png' }], total: 1 },
    { items: [{ ...valid, mediaUrls: [1] }], total: 1 },
  ])('rejects a malformed page: %j', value => {
    expect(parsePublicationReviewPage(value)).toBeNull()
  })

  it('keeps the publishing fields', () => {
    const publication = { state: 'not_published', reason: 'credentials_changed', at: '2026-09-30T11:00:00.000Z' }
    expect(parsePublicationReviewPage({ total: 1, items: [{ ...valid, publishOnApproval: true, publication, canWithdraw: true }] })).toEqual({
      total: 1,
      items: [{
        id: 'r1', action: 'comment.create', resourceId: 'c1', text: '{}', mediaUrls: ['https://cdn.test/a.png'], status: 'approved', createdAt: '2026-09-29T08:00:00.000Z',
        reviewNotes: 'Fine.', approvalExpiresAt: IN_A_WEEK, publishOnApproval: true, publication, canWithdraw: true,
      }],
    })
    // False is an answer too, not a missing field.
    expect(parsePublicationReviewPage({ total: 1, items: [{ ...valid, publishOnApproval: false, canWithdraw: false }] })?.items[0]).toMatchObject({ publishOnApproval: false, canWithdraw: false })
  })

  it('keeps a publication state or reason this client does not know yet, for the tracker to show as it is', () => {
    const page = parsePublicationReviewPage({ total: 1, items: [{ ...valid, publication: { state: 'scheduled_for_later', reason: 'reason_from_a_newer_api', extra: true } }] })
    expect(page?.items[0].publication).toEqual({ state: 'scheduled_for_later', reason: 'reason_from_a_newer_api' })
    expect(publicationReviewStage(page!.items[0], options).label).toBe('Scheduled for later')
  })

  it.each([
    ['publishOnApproval', 'yes'], ['publishOnApproval', 1], ['publishOnApproval', null],
    ['canWithdraw', 'true'], ['canWithdraw', 0], ['canWithdraw', null], ['canWithdraw', {}],
    ['publication', null], ['publication', 'published'], ['publication', 5], ['publication', true], ['publication', []], ['publication', ['published']],
    ['publication', {}], ['publication', { state: 5 }], ['publication', { state: '' }], ['publication', { state: null, reason: 'credentials_changed' }],
  ])('leaves out a malformed %s (%j) and still lists the version', (field, value) => {
    const page = parsePublicationReviewPage({ total: 1, items: [{ ...valid, [field]: value }] })
    expect(page?.total).toBe(1)
    expect(page?.items[0]).not.toHaveProperty(field)
    expect(page?.items[0]).toMatchObject({ id: 'r1', action: 'comment.create', status: 'approved', approvalExpiresAt: IN_A_WEEK })
  })

  it('leaves out a malformed reason or date but keeps the state', () => {
    const publicationOf = (publication: unknown) => parsePublicationReviewPage({ total: 1, items: [{ ...valid, publication }] })?.items[0].publication
    expect(publicationOf({ state: 'published', reason: 7, at: {} })).toEqual({ state: 'published' })
    expect(publicationOf({ state: 'not_published', reason: '', at: '' })).toEqual({ state: 'not_published' })
    expect(publicationOf({ state: 'not_published', reason: null, at: 1727690000000 })).toEqual({ state: 'not_published' })
  })

  it('reads every shape the API sends an author', () => {
    const at = '2026-09-30T10:00:00.000Z'
    const approved = { status: 'approved', approvalExpiresAt: IN_A_WEEK, publishOnApproval: true }
    /** [name, the projection's own fields, phase, steps], as publication-apply-core's projection test pins them. */
    const shapes: [string, Record<string, unknown>, string, number][] = [
      ['waiting, published on approval', { status: 'pending', publishOnApproval: true, canWithdraw: true }, 'in_review', 4],
      ['waiting, held before the switch', { status: 'pending', publishOnApproval: false, canWithdraw: true }, 'in_review', 3],
      ['queued or applying', { ...approved, publication: { state: 'publishing', at }, canWithdraw: true }, 'publishing', 4],
      ['published', { ...approved, publication: { state: 'published', at }, canWithdraw: false }, 'published', 4],
      ['not published', { ...approved, publication: { state: 'not_published', reason: 'credentials_changed', at }, canWithdraw: true }, 'not_published', 4],
      ['replaced after approval', { ...approved, publication: { state: 'superseded', reason: 'newer_version_submitted', at }, canWithdraw: false }, 'superseded', 4],
      ['withdrawn after approval', { ...approved, publication: { state: 'withdrawn', reason: 'withdrawn_by_author', at }, canWithdraw: false }, 'withdrawn', 4],
      ['replaced before a decision', { status: 'superseded', publishOnApproval: true, publication: { state: 'superseded', reason: 'newer_version_submitted', at }, canWithdraw: false }, 'superseded', 2],
      ['withdrawn before a decision', { status: 'withdrawn', publishOnApproval: true, publication: { state: 'withdrawn', reason: 'withdrawn_by_author', at }, canWithdraw: false }, 'withdrawn', 2],
      ['approved, its author publishes it', { status: 'approved', approvalExpiresAt: IN_A_WEEK, publishOnApproval: false, canWithdraw: false }, 'approved', 3],
      ['declined', { status: 'rejected', reviewNotes: 'Not for this campaign.', publishOnApproval: false, canWithdraw: false }, 'declined', 3],
    ]
    const items = shapes.map(([id, fields]) => ({
      id, action: 'comment.create', resourceId: 'c1', text: '{"comment":"Hi"}', mediaUrls: [], reason: 'staff_requested', createdAt: '2026-09-29T08:00:00.000Z', ...fields,
    }))
    const page = parsePublicationReviewPage({ total: items.length, items })
    expect(page?.items.map(item => [item.id, publicationReviewStage(item, options).phase, publicationReviewStage(item, options).steps.length]))
      .toEqual(shapes.map(([id, , phase, steps]) => [id, phase, steps]))
  })

  it('lists every version when one has malformed publishing fields, reading that one as before', () => {
    const page = parsePublicationReviewPage({ total: 2, items: [
      { ...valid, id: 'a', publishOnApproval: true, publication: { state: 'published', at: '2026-09-30T11:00:00.000Z' }, canWithdraw: false },
      { ...valid, id: 'b', publishOnApproval: 'yes', publication: 'published', canWithdraw: 'maybe' },
    ] })
    expect(page?.items.map(item => item.id)).toEqual(['a', 'b'])
    expect(page?.items.map(item => publicationReviewStage(item, options).phase)).toEqual(['published', 'approved'])
  })
})

describe('a version its approval is still to publish', () => {
  const waiting = (fields: Partial<PublicationReviewItem>) => review({ action: 'thank_you.send', resourceId: 'camp1', ...fields })

  it('is one waiting for a decision that publishes it, or approved and publishing now', () => {
    expect(publishesWhenApproved(waiting({ status: 'pending', publishOnApproval: true }))).toBe(true)
    expect(publishesWhenApproved(waiting({ status: 'approved', publication: { state: 'publishing' } }))).toBe(true)
    // Switched off, held before the switch, already published or ended, closed, or declined.
    for (const fields of [
      { status: 'pending', publishOnApproval: false }, { status: 'pending' },
      { status: 'approved' }, { status: 'approved', publication: { state: 'published' } }, { status: 'approved', publication: { state: 'not_published', reason: 'unavailable' } },
      { status: 'withdrawn', publication: { state: 'withdrawn' } }, { status: 'superseded', publishOnApproval: true }, { status: 'rejected', publishOnApproval: true },
    ]) expect(publishesWhenApproved(waiting(fields)), JSON.stringify(fields)).toBe(false)
  })

  it("finds the campaign's thank-you message its approval is still to send", () => {
    const message = { subject: 'Thank you all', body: 'We did it together.', signature: 'Ama' }
    const reviews = [
      waiting({ id: 'other-campaign', resourceId: 'camp2', status: 'pending', publishOnApproval: true, text: JSON.stringify({ ...message, subject: 'Elsewhere' }) }),
      waiting({ id: 'comment', action: 'comment.create', status: 'pending', publishOnApproval: true, text: '{"comment":"Hi"}' }),
      waiting({ id: 'published', status: 'approved', publication: { state: 'published' }, text: JSON.stringify({ ...message, subject: 'Sent before' }) }),
      waiting({ id: 'waiting', status: 'pending', publishOnApproval: true, text: JSON.stringify(message) }),
    ]
    expect(waitingThankYou(reviews, 'camp1')).toEqual(message)
    expect(waitingThankYou(reviews, 'camp3')).toBeNull()
    // Switched off nothing is sent by its approval, so nothing waits.
    expect(waitingThankYou(reviews.map(item => ({ ...item, publishOnApproval: false })), 'camp1')).toBeNull()
    // A message without a signature, and text that can't be read.
    expect(waitingThankYou([waiting({ status: 'pending', publishOnApproval: true, text: '{"subject":"Thanks","body":"Thank you all."}' })], 'camp1')).toEqual({ subject: 'Thanks', body: 'Thank you all.', signature: '' })
    expect(waitingThankYou([waiting({ status: 'pending', publishOnApproval: true, text: 'not json' })], 'camp1')).toBeNull()
    expect(waitingThankYou([waiting({ status: 'pending', publishOnApproval: true, text: '{"subject":5,"body":"x"}' })], 'camp1')).toBeNull()
  })
})
