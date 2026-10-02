import { describe, expect, it } from 'vitest'
import {
  actionLabel,
  approvalClosed,
  approvalDeadline,
  approvalValidUntil,
  contextNames,
  exportText,
  formatValue,
  goalAboveLimit,
  hiddenCharacters,
  hiddenCharactersIn,
  hiddenSummary,
  humanizeKey,
  mediaHeading,
  mediaLabel,
  parseSubmission,
  publicationOf,
  reasonView,
  statusView,
  thankYouText,
} from '@/lib/publicationReview'

const campaign = {
  title: 'Neurodyne assistive tablets',
  description: 'Story line one.\n\nStory line two.',
  category: 'business',
  priority: 'critical',
  beneficiaries: ['Neurodyne', 'Accra, Kumasi'],
  goalAmount: 1000000,
  currency: 'GHS',
  endDate: '2026-10-31T00:00:00.000Z',
  onBehalf: { beneficiaryName: 'Kwame', beneficiaryType: 'individual', relationship: 'patient', reason: 'He needs a tablet.', payoutArrangement: 'beneficiary' },
}
const parse = (action: string, value: unknown, media: string[] = []) => parseSubmission(action, typeof value === 'string' ? value : JSON.stringify(value), media)
const fact = (parsed: ReturnType<typeof parseSubmission>, label: string) => parsed.facts.find(entry => entry.label === label)

describe('campaign proposals', () => {
  it('lays out every field of the canonical payload and leaves nothing over', () => {
    const parsed = parse('campaign.create', campaign)
    expect(parsed.kind).toBe('structured')
    expect(parsed.heading).toBe('Neurodyne assistive tablets')
    expect(parsed.rest).toEqual([])
    expect(fact(parsed, 'Goal')).toMatchObject({ value: 'GH₵1,000,000', amount: 1000000, currency: 'GHS', note: 'goalLimit' })
    expect(fact(parsed, 'End date')).toMatchObject({ value: '31 Oct 2026', note: 'endDate', iso: campaign.endDate })
    expect(fact(parsed, 'Category')?.value).toBe('Business')
    expect(fact(parsed, 'Priority')?.value).toBe('Critical')
    expect(fact(parsed, 'Beneficiaries')).toMatchObject({ values: ['Neurodyne', 'Accra, Kumasi'], wide: true })
    expect(parsed.texts).toEqual([expect.objectContaining({ label: 'Story', text: campaign.description, expandNoun: 'story' })])
    const [group] = parsed.groups
    expect(group.label).toBe('On behalf of someone else')
    expect(group.facts.map(entry => [entry.label, entry.value])).toEqual([['Beneficiary', 'Kwame'], ['Beneficiary type', 'Person'], ['Relationship', 'Patient'], ['Payouts', 'Paid to the beneficiary']])
    expect(group.texts[0]).toMatchObject({ label: 'Why the organizer is raising funds for them', text: 'He needs a tablet.' })
  })

  it('keeps unknown and nested unknown keys under their own labels', () => {
    const parsed = parse('campaign.create', { ...campaign, extra: 'value', onBehalf: { ...campaign.onBehalf, beneficiaryEmail: 'kwame@example.test' } })
    expect(parsed.rest.map(entry => entry.label)).toEqual(['On behalf › Beneficiary email', 'Extra'])
    expect(parsed.rest.map(entry => entry.value)).toEqual(['kwame@example.test', 'value'])
  })

  it('never drops a value of the wrong type', () => {
    const parsed = parse('campaign.create', { ...campaign, goalAmount: '1000', title: 42, onBehalf: 'yes', category: 'space' })
    expect(parsed.heading).toBeUndefined()
    expect(fact(parsed, 'Goal')).toBeUndefined()
    // The currency was not used to format an amount, so it stays visible too.
    expect(parsed.rest.map(entry => [entry.label, entry.value])).toEqual([['Title', 42], ['Goal amount', '1000'], ['Currency', 'GHS'], ['On behalf', 'yes']])
    expect(fact(parsed, 'Category')?.value).toBe('space')
  })

  it('shows an amount without a usable currency as a plain number', () => {
    const parsed = parse('campaign.create', { title: 'T', goalAmount: 5000, currency: 7 })
    expect(fact(parsed, 'Goal')).toMatchObject({ value: '5,000', caption: 'No valid currency was submitted.' })
    expect(parsed.rest.map(entry => entry.label)).toEqual(['Currency'])
  })

  it('marks an empty title and an empty beneficiary list', () => {
    const parsed = parse('campaign.create', { title: '  ', beneficiaries: [] })
    expect(parsed.headingMissing).toBe(true)
    expect(fact(parsed, 'Beneficiaries')).toMatchObject({ value: 'None listed', muted: true })
  })

  it('compares the goal with the campaign-review limit only in GHS', () => {
    expect(goalAboveLimit(1000000, 'GHS', 250000)).toBe(true)
    expect(goalAboveLimit(250000, 'GHS', 250000)).toBe(false)
    expect(goalAboveLimit(1000000, 'USD', 250000)).toBe(false)
    expect(goalAboveLimit(1000000, 'GHS')).toBe(false)
  })
})

describe('other actions', () => {
  it('reads live sessions with and without a title and target', () => {
    const live = parse('live.start', ['Friday', 5000])
    expect(live).toMatchObject({ kind: 'structured', heading: 'Friday', rest: [] })
    expect(fact(live, 'Target')?.value).toBe('GH₵5,000')
    const empty = parse('live.start', ['', null])
    expect(empty).toMatchObject({ kind: 'structured', headingMissing: true, rest: [] })
    expect(fact(empty, 'Target')).toMatchObject({ value: 'No target', muted: true })
  })

  it('reads campaign updates and falls back for any other shape', () => {
    const update = parse('update.create', ['Week one', 'We bought the tablets.', 'milestone'])
    expect(update).toMatchObject({ kind: 'structured', heading: 'Week one', rest: [] })
    expect(fact(update, 'Update type')?.value).toBe('Milestone')
    expect(update.texts[0]).toMatchObject({ label: 'Update', text: 'We bought the tablets.' })
    expect(parse('update.edit', ['Only', 'two'])).toMatchObject({ kind: 'list', values: ['Only', 'two'] })
  })

  it('never parses a web address as JSON', () => {
    const slug = parse('campaign.slug', '2026')
    expect(slug.kind).toBe('structured')
    expect(slug.facts).toEqual([{ key: 'slug', label: 'Proposed address', value: '/c/2026' }])
  })

  it('reads a comment and says where its author photo comes from', () => {
    const reviewed = parse('comment.create', { authorName: 'Ama', authorAvatarUrl: 'https://res.cloudinary.com/x/a.jpg', comment: 'Well done' })
    expect(fact(reviewed, 'Author photo')).toMatchObject({ value: 'Already reviewed', caption: 'https://res.cloudinary.com/x/a.jpg' })
    // A photo sent as media has not been reviewed: it may be new, or a legacy photo nobody inspected.
    expect(fact(parse('comment.create', { authorName: 'Ama', comment: 'Hi' }, ['https://res.cloudinary.com/x/new.jpg']), 'Author photo')?.value).toBe('Photo not yet reviewed, shown below')
    expect(fact(parse('comment.create', { authorName: 'Ama', comment: 'Hi' }), 'Author photo')).toMatchObject({ value: 'No photo', muted: true })
    expect(parse('comment.create', 'Plain comment text')).toMatchObject({ kind: 'plain' })
  })

  it('reads profiles with the image rule, formatted amounts and labels', () => {
    const photo = 'https://res.cloudinary.com/x/photo.jpg', old = 'https://res.cloudinary.com/x/old.jpg'
    const creator = parse('creator.profile', { handle: 'ama', displayName: 'Ama', tagline: '', tipsEnabled: true, presetAmounts: [10, 25.5], currency: 'GHS', avatarUrl: photo, coverUrl: old, bio: 'Bio', thankYouMessage: '' }, [photo])
    expect(creator.rest).toEqual([])
    expect(fact(creator, 'Tagline')).toMatchObject({ value: '(empty)', muted: true })
    expect(fact(creator, 'Tips')?.value).toBe('On')
    expect(fact(creator, 'Suggested amounts')?.values).toEqual(['GH₵10', 'GH₵25.5'])
    expect(fact(creator, 'Profile photo')?.value).toBe('New, shown below')
    expect(fact(creator, 'Cover image')).toMatchObject({ value: 'Unchanged (already reviewed)', caption: old })
    expect(creator.texts.map(text => text.label)).toEqual(['Bio', 'Thank-you message'])
    const account = parse('account.profile', { name: 'Kofi', country: '', publicProfile: false, avatarUrl: '', coverUrl: '' })
    expect(account.facts.map(entry => [entry.label, entry.value])).toEqual([['Name', 'Kofi'], ['Country', 'Not set'], ['Profile visibility', 'Private'], ['Profile photo', 'None'], ['Cover image', 'None']])
    expect(fact(parse('organization.profile', { organizationName: 'Neurodyne', website: '' }), 'Website')).toMatchObject({ value: 'None', muted: true })
  })

  it('reads supporter and donor content, including anonymous names and empty messages', () => {
    const tip = parse('tip.public_content', { supporterName: 'Anonymous', message: '' })
    expect(fact(tip, 'Public name')).toMatchObject({ value: 'Anonymous', caption: 'The supporter chose to stay anonymous' })
    expect(tip.texts[0]).toMatchObject({ label: 'Message', text: '', empty: 'No message' })
    const donation = parse('donation.public_content', { donorName: '', message: 'Keep going' })
    expect(fact(donation, 'Public name')).toMatchObject({ value: 'No public name', muted: true })
    expect(fact(donation, 'Public name')?.caption).toBeUndefined()
  })

  it('reads a thank-you message as donors will, keeping other keys visible', () => {
    const text = JSON.stringify({ subject: 'Thanks', body: 'Line one\nLine two', signature: 'Ama', footer: 'x' })
    const parsed = parseSubmission('thank_you.send', text, [])
    expect(parsed.letter).toBe('Subject: Thanks\n\nLine one\nLine two\n\nSigned: Ama')
    expect(parsed.rest.map(entry => entry.label)).toEqual(['Footer'])
    expect(parse('thank_you.send', { subject: { nested: true }, body: 'x' })).toMatchObject({ kind: 'fields' })
  })

  it('lists every entry of an unknown action, and keeps other text exact', () => {
    expect(parse('campaign.archive', { reason: 'Done' })).toMatchObject({ kind: 'fields', rest: [expect.objectContaining({ label: 'Reason', value: 'Done' })] })
    expect(parse('campaign.archive', [1, 2])).toMatchObject({ kind: 'list', values: [1, 2] })
    expect(parse('campaign.archive', '"just a string"')).toMatchObject({ kind: 'plain' })
    expect(actionLabel('campaign.archive')).toBe('Campaign archive')
    expect(actionLabel('thank_you.send')).toBe('Donor thank-you message')
  })
})

describe('text', () => {
  it('formats a thank-you exactly as before', () => {
    expect(thankYouText(JSON.stringify({ subject: 'Thank you from Ama', body: 'Your gifts paid for my surgery.\nI am home now.', signature: 'Ama' }))).toBe('Subject: Thank you from Ama\n\nYour gifts paid for my surgery.\nI am home now.\n\nSigned: Ama')
    expect(thankYouText(JSON.stringify({ subject: 'Hi', body: 'Body' }))).toBe('Subject: Hi\n\nBody')
    expect(thankYouText('not json')).toBeNull()
    expect(thankYouText('[1]')).toBeNull()
  })

  it('exports nested values as JSON instead of [object Object]', () => {
    const text = exportText('campaign.create', JSON.stringify(campaign))
    expect(text).not.toContain('[object Object]')
    expect(text).toContain('beneficiaries: Neurodyne, Accra, Kumasi')
    expect(text).toContain('onBehalf: {"beneficiaryName":"Kwame"')
    expect(exportText('creator.profile', JSON.stringify({ presetAmounts: [10, 25] }))).toBe('presetAmounts: [10,25]')
    expect(exportText('donation.public_content', JSON.stringify({ donorName: 'Donor 25', message: 'Community support 25' }))).toBe('donorName: Donor 25\n\nmessage: Community support 25')
    expect(exportText('update.create', JSON.stringify(['T', 'Body', 'general']))).toBe('T\n\nBody\n\nUpdate type: general')
    expect(exportText('campaign.slug', '2026')).toBe('2026')
  })

  it('names media as before, plus campaign, update and comment labels', () => {
    const photo = 'p', cover = 'c'
    const profile = JSON.stringify({ avatarUrl: photo, coverUrl: cover })
    expect(mediaLabel('creator.profile', profile, photo, 0)).toBe('Photo')
    expect(mediaLabel('account.profile', profile, cover, 1)).toBe('Cover')
    expect(mediaLabel('creator.profile', JSON.stringify({ avatarUrl: photo, coverUrl: photo }), photo, 0)).toBe('Photo and cover')
    expect(mediaLabel('account.profile', 'not json', photo, 0)).toBe('Media 1')
    expect(mediaLabel('creator.profile', profile, 'other', 2)).toBe('Media 3')
    expect(mediaLabel('campaign.create', '{}', 'a', 0)).toBe('Cover image')
    expect(mediaLabel('campaign.create', '{}', 'b', 1)).toBe('Image 2')
    expect(mediaLabel('update.edit', '[]', 'a', 0)).toBe('Photo 1')
    expect(mediaLabel('comment.create', '{"comment":"x"}', 'a', 0)).toBe('Author photo')
    expect(mediaLabel('comment.create', 'plain', 'a', 0)).toBe('Media 1')
    expect(mediaHeading('campaign.create', 1)).toBe('Image')
    expect(mediaHeading('update.create', 3)).toBe('Photos (3)')
    expect(mediaHeading('campaign.archive', 2)).toBe('Attachments (2)')
  })

  it('flags invisible and text-direction characters but not emoji joiners', () => {
    expect(hiddenCharacters(JSON.stringify({ comment: 'abc\u202Edef\u202E' }))).toEqual([{ codePoint: 'U+202E', name: 'right-to-left override', count: 2 }])
    expect(hiddenCharacters('family 👨‍👩‍👧 and ❤️')).toEqual([])
    expect(hiddenCharacters('zero\u200Bwidth')).toEqual([{ codePoint: 'U+200B', name: 'zero-width space', count: 1 }])
    // An escaped character in JSON is decoded before counting.
    expect(hiddenCharacters('{"comment":"a\\u202eb"}')).toEqual([{ codePoint: 'U+202E', name: 'right-to-left override', count: 1 }])
  })

  it('flags every bidi control and default-ignorable character, including the Arabic letter mark', () => {
    // Renders as "024 1234 555" in Chromium while the stored text says "024 555 1234".
    expect(hiddenCharacters('Send MoMo to 024 \u061c555 1234 today')).toEqual([{ codePoint: 'U+061C', name: 'Arabic letter mark', count: 1 }])
    expect(hiddenCharacters('a\u034fb\u206ac\u{1d173}d\ufff0')).toEqual([
      { codePoint: 'U+034F', name: 'combining grapheme joiner', count: 1 },
      { codePoint: 'U+206A', name: 'inhibit symmetric swapping', count: 1 },
      { codePoint: 'U+1D173', name: 'musical format control', count: 1 },
      { codePoint: 'U+FFF0', name: 'unassigned invisible character', count: 1 },
    ])
    expect(hiddenCharacters('bell\u0007 and escape\u001b')).toEqual([{ codePoint: 'U+0007', name: 'control character', count: 1 }, { codePoint: 'U+001B', name: 'control character', count: 1 }])
    expect(hiddenCharacters('Tabs\tand\r\nline breaks')).toEqual([])
  })

  it('counts tag characters and spare variation selectors, which can carry a hidden payload, but not emoji', () => {
    const tags = (text: string) => Array.from(text, char => String.fromCodePoint(0xe0000 + char.charCodeAt(0))).join('')
    const england = `\u{1f3f4}${tags('gbeng')}\u{e007f}`
    expect(hiddenCharacters(`Go ${england} and ❤️ 1️⃣ 👍🏽 葛\u{e0100}`)).toEqual([])
    // Tags after a black flag that is not a flag emoji: an invisible ASCII payload.
    expect(hiddenCharacters(`\u{1f3f4}${tags('pay')}\u{e007f}`)).toEqual([
      { codePoint: 'U+E0070', name: 'tag character', count: 1 },
      { codePoint: 'U+E0061', name: 'tag character', count: 1 },
      { codePoint: 'U+E0079', name: 'tag character', count: 1 },
      { codePoint: 'U+E007F', name: 'cancel tag', count: 1 },
    ])
    expect(hiddenCharacters(`plain ${tags('x')}`)).toEqual([{ codePoint: 'U+E0078', name: 'tag character', count: 1 }])
    // One selector after a visible character picks a variant; a run of them, or one with nothing before it, varies nothing.
    expect(hiddenCharacters('A\ufe0f\ufe00\u{e0101}')).toEqual([{ codePoint: 'U+FE00', name: 'variation selector with nothing to vary', count: 1 }, { codePoint: 'U+E0101', name: 'variation selector with nothing to vary', count: 1 }])
    expect(hiddenCharacters('\ufe0fstart')).toEqual([{ codePoint: 'U+FE0F', name: 'variation selector with nothing to vary', count: 1 }])
  })

  it('scans the names around a submission and summarises at most six kinds', () => {
    const item = { id: 'r', actorId: 'a', action: 'organization.profile', text: '{}', mediaUrls: [], status: 'pending', reason: 'staff_requested',
      author: { id: 'a', name: 'Acme', email: 'team@acme.test', organizationName: 'Acme Foundation\u2069\u202e' }, campaign: { id: 'c', title: 'Water', slug: 'water' }, recipient: { kind: 'creator', id: 'p', name: 'Page', handle: 'page' } }
    expect(contextNames(item)).toEqual(['Acme', 'team@acme.test', 'Acme Foundation\u2069\u202e', 'Water', 'water', 'Page', 'page'])
    expect(hiddenCharactersIn(contextNames(item))).toEqual([{ codePoint: 'U+2069', name: 'pop directional isolate', count: 1 }, { codePoint: 'U+202E', name: 'right-to-left override', count: 1 }])
    expect(hiddenSummary(hiddenCharacters('\u202e\u202e\u200b'))).toBe('3 invisible or text-direction characters (U+202E right-to-left override ×2, U+200B zero-width space ×1)')
    expect(hiddenSummary(hiddenCharacters('\u200b\u200c\u200e\u200f\u202a\u202b\u202c\u202d'))).toBe('8 invisible or text-direction characters (U+200B zero-width space ×1, U+200C zero-width non-joiner ×1, U+200E left-to-right mark ×1, U+200F right-to-left mark ×1, U+202A left-to-right embedding ×1, U+202B right-to-left embedding ×1, 2 more kinds)')
  })
})

describe('labels and values', () => {
  it('turns submitted keys into sentence-case labels', () => {
    expect(humanizeKey('beneficiaryEmail')).toBe('Beneficiary email')
    expect(humanizeKey('image_url')).toBe('Image URL')
    expect(humanizeKey('creator-id')).toBe('Creator ID')
    expect(humanizeKey('amountGhs')).toBe('Amount GHS')
    // Only URL, ID and GHS stay upper case; other acronyms read as sentence case.
    expect(humanizeKey('XMLHttpRequest')).toBe('Xml http request')
    expect(humanizeKey('onBehalf')).toBe('On behalf')
    expect(humanizeKey(0)).toBe('Item 1')
    expect(humanizeKey('')).toBe('Unnamed field')
  })

  it('formats each kind of submitted value', () => {
    expect(formatValue('')).toEqual({ kind: 'text', text: '(empty)', muted: true })
    expect(formatValue('2026-10-31T00:00:00.000Z')).toEqual({ kind: 'text', text: '31 Oct 2026, 00:00 UTC' })
    expect(formatValue('2026-10-31')).toEqual({ kind: 'text', text: '31 Oct 2026' })
    expect(formatValue('Hello')).toEqual({ kind: 'text', text: 'Hello' })
    expect(formatValue('x'.repeat(201))).toEqual({ kind: 'long', text: 'x'.repeat(201) })
    expect(formatValue(1500, { key: 'targetAmount', siblings: { currency: 'GHS' } })).toEqual({ kind: 'text', text: 'GH₵1,500' })
    expect(formatValue(1500, { key: 'count', siblings: { currency: 'GHS' } })).toEqual({ kind: 'text', text: '1,500' })
    expect(formatValue(true)).toEqual({ kind: 'text', text: 'Yes' })
    expect(formatValue(null)).toEqual({ kind: 'text', text: 'Not set', muted: true })
    expect(formatValue(['a', 'b'])).toEqual({ kind: 'items', items: [{ kind: 'text', text: 'a' }, { kind: 'text', text: 'b' }] })
    expect(formatValue([])).toEqual({ kind: 'text', text: 'None', muted: true })
    expect(formatValue({ mode: 'fast' })).toEqual({ kind: 'fields', entries: [{ key: 'mode', label: 'Mode', value: { kind: 'text', text: 'fast' } }] })
    expect(formatValue([{ a: 1 }])).toMatchObject({ kind: 'fields', entries: [{ label: 'Item 1', value: { kind: 'fields' } }] })
    const deep = { a: { b: { c: { d: 1 } } } }
    expect(JSON.stringify(formatValue(deep))).toContain(JSON.stringify(JSON.stringify({ d: 1 }, null, 2)))
  })
})

describe('status and approval dates', () => {
  const now = Date.parse('2026-09-30T12:00:00.000Z')
  it('describes the review status', () => {
    expect(statusView({ status: 'pending' }, now)).toEqual({ label: 'Waiting for review', color: 'var(--text-warning)' })
    expect(statusView({ status: 'approved', approvalExpiresAt: '2026-10-05T00:00:00.000Z' }, now)).toEqual({ label: 'Approved', color: 'var(--text-success)' })
    expect(statusView({ status: 'approved', approvalExpiresAt: '2026-09-29T00:00:00.000Z' }, now)).toEqual({ label: 'Approval expired', color: 'text.secondary' })
    expect(statusView({ status: 'approved', approvalExpiresAt: '2026-10-05T00:00:00.000Z', purgeAt: '2026-09-30T00:00:00.000Z' }, now).label).toBe('Approval expired')
    expect(statusView({ status: 'approved' }, now).label).toBe('Approved')
    expect(statusView({ status: 'rejected' }, now)).toEqual({ label: 'Declined', color: 'var(--text-error)' })
    // Every submission with media goes to staff, including photos an edited update keeps, so the reason does not say "new".
    expect(reasonView('media')).toEqual({ label: 'Has media', color: 'var(--text-info)', explanation: 'Submissions with images always need a person to inspect them.' })
    expect(reasonView('something_new')).toEqual({ label: 'Something new', color: 'text.secondary' })
  })

  it('caps an approval at the deletion of its record', () => {
    expect(approvalDeadline(now)).toBe('2026-10-07T12:00:00.000Z')
    expect(approvalDeadline(now, '2026-10-02T08:00:00.000Z')).toBe('2026-10-02T08:00:00.000Z')
    expect(approvalDeadline(now, '2026-11-30T00:00:00.000Z')).toBe('2026-10-07T12:00:00.000Z')
    expect(approvalDeadline(now, 'not a date')).toBe('2026-10-07T12:00:00.000Z')
    expect(approvalValidUntil({ approvalExpiresAt: '2026-10-07T00:00:00.000Z', purgeAt: '2026-10-02T00:00:00.000Z' })).toBe('2026-10-02T00:00:00.000Z')
    expect(approvalValidUntil({ approvalExpiresAt: '2026-10-07T00:00:00.000Z' })).toBe('2026-10-07T00:00:00.000Z')
    expect(approvalValidUntil({})).toBeUndefined()
  })

  it('never calls a used or closed approval expired', () => {
    const past = { status: 'approved', approvalExpiresAt: '2026-09-29T00:00:00.000Z' }
    for (const state of ['published', 'superseded', 'withdrawn']) {
      expect(statusView({ ...past, publication: { state } }, now), state).toEqual({ label: 'Approved', color: 'var(--text-success)' })
      expect(approvalClosed({ publication: { state } }), state).toBe(true)
    }
    // Not published, or still publishing: the approval can run out unused.
    expect(statusView({ ...past, publication: { state: 'not_published', reason: 'restricted' } }, now).label).toBe('Approval expired')
    expect(approvalClosed({ publication: { state: 'queued' } })).toBe(false)
    expect(approvalClosed({})).toBe(false)
  })
})

describe('publication of an approved version', () => {
  it('keeps every well-formed field', () => {
    const publication = { state: 'published', reason: 'credentials_changed', at: '2026-09-30T10:00:00.000Z', via: 'approval', attempts: 2, nextAttemptAt: '2026-09-30T10:05:00.000Z', resourceId: 'c'.repeat(24) }
    expect(publicationOf({ publication })).toEqual(publication)
    // States and reasons this console does not know yet pass through; the guidance decides how to word them.
    expect(publicationOf({ publication: { state: 'archived', reason: 'from_the_future' } })).toEqual({ state: 'archived', reason: 'from_the_future' })
  })

  it('drops a malformed field, and reads a publication without a state as none', () => {
    expect(publicationOf({ publication: { state: 'queued', reason: 3, at: 'soon', via: '', attempts: -1, nextAttemptAt: null, resourceId: {} } })).toEqual({ state: 'queued' })
    expect(publicationOf({ publication: { state: 'queued', attempts: Number.NaN } })).toEqual({ state: 'queued' })
    expect(publicationOf({ publication: { state: 'queued', attempts: 0 } })).toEqual({ state: 'queued', attempts: 0 })
    for (const publication of [undefined, null, 'published', ['published'], {}, { state: '' }, { state: 5 }]) expect(publicationOf({ publication }), JSON.stringify(publication)).toBeNull()
  })
})
