import { describe, expect, it } from 'vitest'
import {
  PUBLICATION_ACTIONS,
  PUBLICATION_REVIEW_SUBJECT_MAX,
  describePublicationReview,
  isPublicationAction,
  parsePublicationReviewPage,
  publicationActionLabel,
  publicationReviewStage,
  publicationReviewSubject,
  type PublicationAction,
  type PublicationReviewItem,
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
})

describe('parsePublicationReviewPage', () => {
  const valid = { id: 'r1', action: 'comment.create', resourceId: 'c1', text: '{}', mediaUrls: ['https://cdn.test/a.png'], status: 'approved', reason: 'screening', createdAt: '2026-09-29T08:00:00.000Z', reviewNotes: 'Fine.', approvalExpiresAt: IN_A_WEEK }

  it('keeps the fields a card uses and drops the rest', () => {
    expect(parsePublicationReviewPage({ total: 1, items: [valid] })).toEqual({
      total: 1,
      items: [{ id: 'r1', action: 'comment.create', text: '{}', mediaUrls: ['https://cdn.test/a.png'], status: 'approved', createdAt: '2026-09-29T08:00:00.000Z', reviewNotes: 'Fine.', approvalExpiresAt: IN_A_WEEK }],
    })
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
})
