import { formatMoney } from '@/lib/money'
import { ARRANGEMENT_LABELS, RELATIONSHIP_LABELS, TYPE_LABELS } from '@/lib/onBehalfLabels'
import { formatUtcDate, formatUtcDateTime } from '@/lib/reviewDates'

/*
 * Publication review cards: what a submission is, and how each submitted field
 * is shown to the reviewer. Pure: no React, no clock, no network.
 *
 * Safety rules the parser keeps:
 * - every submitted key is shown, either by a recognised field or under
 *   "Other submitted fields" (a value of the wrong type is never dropped);
 * - author values stay plain strings for React text nodes, never markup or links.
 */

const DAY_MS = 86_400_000

// ─── Types ───────────────────────────────────────────────────────────────────
// Everything beyond the original queue shape is optional, so the page keeps
// working against an API that does not send the admin context yet.

export interface AccountSummary {
  id: string
  name?: string
  email?: string
  accountType?: string
  organizationName?: string
  verificationLevel?: number
  emailVerified?: boolean
  closed?: boolean
}

export interface CampaignSummary {
  id: string
  title?: string
  slug?: string
  status?: string
  creatorId?: string
  deleted?: boolean
}

export interface ReviewerSummary {
  id?: string
  name?: string
  automated?: boolean
}

export interface RecipientSummary {
  kind: string
  id: string
  name?: string
  handle?: string
}

/** Where an approved version stands on its way to publication, as the admin list sends it (raw state). */
export interface ItemPublication {
  /** queued, applying, published, not_published, superseded or withdrawn. */
  state: string
  /** Why it was not published or was replaced: a code from @ubuntu-fund/types. */
  reason?: string
  at?: string
  /** Who published it: the approval itself, or the author submitting it again. */
  via?: string
  /** Publishing attempts so far. */
  attempts?: number
  nextAttemptAt?: string
  /** What the publication created or changed. */
  resourceId?: string
}

export interface PublicationReviewItem {
  id: string
  action: string
  actorId: string
  text: string
  mediaUrls: string[]
  status: string
  reason: string
  /** Tip and donation content: the exact content version a decision binds to. */
  version?: string
  resourceId?: string
  reviewNotes?: string
  createdAt?: string
  approvalExpiresAt?: string
  reviewedBy?: string
  reviewedAt?: string
  /** When the record, and an undecided proposal, is deleted. */
  purgeAt?: string
  baseVersion?: string
  /** Admin context: absent from older APIs, null when the record was not found. */
  author?: AccountSummary | null
  profileAccount?: AccountSummary | null
  campaign?: CampaignSummary | null
  reviewer?: ReviewerSummary | null
  /** Tip and donation content: who owns the page or campaign the content was sent to. */
  ownerId?: string
  recipient?: RecipientSummary
  /**
   * Publishing on approval: approving publishes this version by itself (and,
   * once approved, it did). False while publishing on approval is switched
   * off; absent from older APIs. Read it through `approvalEffect`.
   */
  publishOnApproval?: boolean
  /** Approved versions of the publish-on-approval actions. Read it through `publicationOf`. */
  publication?: ItemPublication
  /** update.create: how the update is published (not reviewed content). */
  applyOptions?: { isPinned?: boolean }
  /** The review that replaced this version. */
  supersededBy?: string
}

export type ReviewQueue = 'publication' | 'content'

// ─── Actions, reasons and statuses ───────────────────────────────────────────

export const ACTION_LABELS: Record<string, string> = {
  'campaign.create': 'New campaign proposal',
  'update.create': 'Campaign update',
  'update.edit': 'Edited campaign update',
  'live.start': 'Live session',
  'campaign.slug': 'Campaign web address change',
  'comment.create': 'Campaign comment',
  'thank_you.send': 'Donor thank-you message',
  'account.profile': 'Account profile change',
  'creator.profile': 'Creator page',
  'organization.profile': 'Organization identity change',
  'tip.public_content': 'Supporter name and message',
  'donation.public_content': 'Donor name and message',
}

/** Actions whose card heading is the proposed title (the action label becomes the eyebrow), and the heading when it is empty. */
const UNTITLED: Record<string, string> = {
  'campaign.create': 'Untitled campaign proposal',
  'update.create': 'Untitled update',
  'update.edit': 'Untitled update',
  'live.start': 'Untitled live session',
}

/** Actions that act on a campaign: their resource is the campaign (or, for update.edit, one of its updates). */
export const CAMPAIGN_SCOPED_ACTIONS = new Set(['comment.create', 'update.create', 'update.edit', 'live.start', 'campaign.slug', 'thank_you.send'])

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? (action ? humanizeKey(action) : 'Submission')
}

export function untitledHeading(action: string): string | undefined {
  return UNTITLED[action]
}

export interface ChipView {
  label: string
  color: string
  explanation?: string
}

export const REASON_VIEW: Record<string, ChipView> = {
  // Any submission with media goes to staff, including photos an edited update keeps from its reviewed version.
  media: { label: 'Has media', color: 'var(--text-info)', explanation: 'Submissions with images always need a person to inspect them.' },
  staff_requested: { label: 'Staff requested', color: 'text.secondary', explanation: 'The author did not allow automated screening, so a person reviews it.' },
  screening: { label: 'Automated screening', color: 'text.secondary', explanation: 'Automated screening did not finish. Review it yourself.' },
  flagged: { label: 'Flagged by screening', color: 'var(--text-error)', explanation: 'Automated screening flagged this text. Read it closely.' },
  unavailable: { label: 'Screening unavailable', color: 'var(--text-warning)', explanation: 'Automated screening could not run, so a person reviews it.' },
}

export function reasonView(reason: string): ChipView {
  return REASON_VIEW[reason] ?? { label: reason ? humanizeKey(reason) : 'No reason given', color: 'text.secondary' }
}

/**
 * When an approval stops letting the author publish: its own expiry, or the
 * deletion of the record if that comes first (the approval is deleted with it).
 */
export function approvalValidUntil(item: Pick<PublicationReviewItem, 'approvalExpiresAt' | 'purgeAt'>): string | undefined {
  const expires = Date.parse(item.approvalExpiresAt ?? '')
  if (!Number.isFinite(expires)) return undefined
  const purge = Date.parse(item.purgeAt ?? '')
  return Number.isFinite(purge) && purge < expires ? item.purgeAt : item.approvalExpiresAt
}

/** The last moment an approval given at `now` could be used: seven days later, or sooner if the record is deleted first. */
export function approvalDeadline(now: number, purgeAt?: string): string {
  const week = now + 7 * DAY_MS
  const purge = Date.parse(purgeAt ?? '')
  return new Date(Number.isFinite(purge) ? Math.min(week, purge) : week).toISOString()
}

/** Publish states after which an approval can never publish again: its expiry no longer matters. */
const CLOSED_PUBLISH_STATES = new Set(['published', 'superseded', 'withdrawn'])

const isoString = (value: unknown): string | undefined => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined)
const plainString = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined)

/**
 * The item's publication, read leniently: a malformed field is dropped, and a
 * publication without a state is no publication. Unknown states and reasons
 * pass through; the guidance decides how (or whether) to word them.
 */
export function publicationOf(item: { publication?: unknown }): ItemPublication | null {
  const value = item.publication
  if (!isPlainObject(value)) return null
  const state = plainString(value.state)
  if (!state) return null
  const attempts = value.attempts
  const reason = plainString(value.reason), at = isoString(value.at), via = plainString(value.via)
  const nextAttemptAt = isoString(value.nextAttemptAt), resourceId = plainString(value.resourceId)
  return {
    state,
    ...(reason ? { reason } : {}),
    ...(at ? { at } : {}),
    ...(via ? { via } : {}),
    ...(isFiniteNumber(attempts) && attempts >= 0 ? { attempts } : {}),
    ...(nextAttemptAt ? { nextAttemptAt } : {}),
    ...(resourceId ? { resourceId } : {}),
  }
}

/** The approval was used or closed (published, replaced or withdrawn), so it can never publish again. */
export function approvalClosed(item: { publication?: unknown }): boolean {
  const publication = publicationOf(item)
  return !!publication && CLOSED_PUBLISH_STATES.has(publication.state)
}

export function statusView(item: Pick<PublicationReviewItem, 'status' | 'approvalExpiresAt' | 'purgeAt' | 'publication'>, now: number): ChipView {
  if (item.status === 'pending') return { label: 'Waiting for review', color: 'var(--text-warning)' }
  if (item.status === 'approved') {
    const validUntil = Date.parse(approvalValidUntil(item) ?? '')
    // A used or closed approval did not expire unused: its card says where it ended.
    const expired = Number.isFinite(validUntil) && validUntil <= now && !approvalClosed(item)
    return expired ? { label: 'Approval expired', color: 'text.secondary' } : { label: 'Approved', color: 'var(--text-success)' }
  }
  if (item.status === 'rejected') return { label: 'Declined', color: 'var(--text-error)' }
  return { label: item.status ? humanizeKey(item.status) : 'Unknown status', color: 'text.secondary' }
}

export function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
}

/** A GHS goal above the campaign-review limit the API sent (no limit known: never). */
export function goalAboveLimit(amount: number, currency: string, limit?: number): boolean {
  return limit !== undefined && currency.toUpperCase() === 'GHS' && amount > limit
}

// ─── Labels and values for any submitted field ───────────────────────────────

const KNOWN_LABELS: Record<string, string> = {
  onBehalf: 'On behalf',
  goalAmount: 'Goal amount',
  avatarUrl: 'Profile photo URL',
  coverUrl: 'Cover image URL',
  authorAvatarUrl: 'Author photo URL',
  presetAmounts: 'Suggested amounts',
  tipsEnabled: 'Tips',
  publicProfile: 'Profile visibility',
  thankYouMessage: 'Thank-you message',
}
const UPPER_WORDS: Record<string, string> = { url: 'URL', urls: 'URLs', id: 'ID', ids: 'IDs', ghs: 'GHS' }

/** A submitted key as a sentence-case label: "beneficiaryEmail" → "Beneficiary email", "image_url" → "Image URL". */
export function humanizeKey(key: string | number): string {
  if (typeof key === 'number') return `Item ${key + 1}`
  if (Object.hasOwn(KNOWN_LABELS, key)) return KNOWN_LABELS[key]
  // Fixed-width patterns only: unknown keys are author-controlled, so no backtracking.
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])(?=[A-Z][a-z])/g, '$1 ')
    .split(/[\s_.-]+/)
    .filter(Boolean)
  if (!words.length) return key || 'Unnamed field'
  return words.map((word, index) => {
    const lower = word.toLowerCase()
    if (Object.hasOwn(UPPER_WORDS, lower)) return UPPER_WORDS[lower]
    return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower
  }).join(' ')
}

export type FormattedValue =
  | { kind: 'text'; text: string; muted?: boolean }
  /** A string over 200 characters: shown as an evidence tile. */
  | { kind: 'long'; text: string }
  | { kind: 'items'; items: FormattedValue[] }
  | { kind: 'fields'; entries: FormattedEntry[] }
  /** Nested deeper than the view lays out: the exact JSON. */
  | { kind: 'json'; text: string }

export interface FormattedEntry {
  key: string
  label: string
  value: FormattedValue
}

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const MONEY_KEY = /amount|goal|target|price/i
const MAX_DEPTH = 3

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isScalar = (value: unknown) => value === null || typeof value !== 'object'

/** How one submitted value reads on the card. Nothing becomes markup or a link. */
export function formatValue(value: unknown, context: { key?: string | number; siblings?: Record<string, unknown>; depth?: number } = {}): FormattedValue {
  const depth = context.depth ?? 0
  if (value === null || value === undefined) return { kind: 'text', text: 'Not set', muted: true }
  if (typeof value === 'string') {
    if (!value) return { kind: 'text', text: '(empty)', muted: true }
    const date = ISO_DATETIME.test(value) ? formatUtcDateTime(value) : DATE_ONLY.test(value) ? formatUtcDate(value) : null
    if (date) return { kind: 'text', text: date }
    return value.length > 200 ? { kind: 'long', text: value } : { kind: 'text', text: value }
  }
  if (typeof value === 'number') {
    const currency = context.siblings?.currency
    if (typeof context.key === 'string' && MONEY_KEY.test(context.key) && typeof currency === 'string' && currency.trim()) return { kind: 'text', text: formatMoney(value, currency.trim()) }
    return { kind: 'text', text: value.toLocaleString('en-GH') }
  }
  if (typeof value === 'boolean') return { kind: 'text', text: value ? 'Yes' : 'No' }
  if (Array.isArray(value)) {
    if (!value.length) return { kind: 'text', text: 'None', muted: true }
    if (value.every(isScalar)) return { kind: 'items', items: value.map((item, index) => formatValue(item, { key: index, depth: depth + 1 })) }
    if (depth >= MAX_DEPTH) return { kind: 'json', text: JSON.stringify(value, null, 2) }
    return { kind: 'fields', entries: value.map((item, index) => ({ key: String(index), label: humanizeKey(index), value: formatValue(item, { key: index, depth: depth + 1 }) })) }
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
    if (!entries.length) return { kind: 'text', text: 'No fields', muted: true }
    if (depth >= MAX_DEPTH) return { kind: 'json', text: JSON.stringify(value, null, 2) }
    return { kind: 'fields', entries: entries.map(([key, item]) => ({ key, label: humanizeKey(key), value: formatValue(item, { key, siblings: value, depth: depth + 1 }) })) }
  }
  return { kind: 'text', text: String(value) }
}

// ─── Field specs ─────────────────────────────────────────────────────────────

export type FieldKind = 'title' | 'text' | 'longText' | 'boolean' | 'money' | 'moneyList' | 'utcDate' | 'choice' | 'list' | 'image' | 'reviewedImage' | 'group'

export interface FieldSpec {
  key: string | number
  label: string
  kind: FieldKind
  choices?: Record<string, string>
  /** Boolean labels. */
  yes?: string
  no?: string
  /** Shown (muted) for an empty string, an empty list or a null amount. */
  empty?: string
  /** Sibling key holding the ISO currency of an amount. */
  currencyKey?: string
  fields?: FieldSpec[]
  /** "Show full {noun}" on long text. */
  expandNoun?: string
  caption?: string
  wide?: boolean
  note?: 'goalLimit' | 'endDate'
  /** Shown under a public name that reads exactly "Anonymous". */
  anonymousCaption?: string
}

const CATEGORY_LABELS: Record<string, string> = { medical: 'Medical', education: 'Education', emergency: 'Emergency', business: 'Business', community: 'Community', religious: 'Religious', creative: 'Creative' }
const PRIORITY_LABELS: Record<string, string> = { normal: 'Normal', urgent: 'Urgent', critical: 'Critical' }
const UPDATE_TYPES: Record<string, string> = { milestone: 'Milestone', general: 'General', thank_you: 'Thank-you', urgent: 'Urgent' }

const UPDATE_SPECS: FieldSpec[] = [
  { key: 0, label: 'Title', kind: 'title' },
  { key: 2, label: 'Update type', kind: 'choice', choices: UPDATE_TYPES },
  { key: 1, label: 'Update', kind: 'longText', expandNoun: 'update' },
]

/** One table drives every structured renderer. Order within an action is display order. */
export const FIELD_SPECS: Record<string, FieldSpec[]> = {
  'campaign.create': [
    { key: 'title', label: 'Title', kind: 'title' },
    { key: 'goalAmount', label: 'Goal', kind: 'money', currencyKey: 'currency', note: 'goalLimit' },
    { key: 'endDate', label: 'End date', kind: 'utcDate', note: 'endDate' },
    { key: 'category', label: 'Category', kind: 'choice', choices: CATEGORY_LABELS },
    { key: 'priority', label: 'Priority', kind: 'choice', choices: PRIORITY_LABELS },
    { key: 'beneficiaries', label: 'Beneficiaries', kind: 'list', empty: 'None listed', wide: true },
    { key: 'description', label: 'Story', kind: 'longText', expandNoun: 'story' },
    {
      key: 'onBehalf', label: 'On behalf of someone else', kind: 'group',
      caption: 'Shown publicly on the campaign page. The beneficiary’s email is not part of this review.',
      fields: [
        { key: 'beneficiaryName', label: 'Beneficiary', kind: 'text' },
        { key: 'beneficiaryType', label: 'Beneficiary type', kind: 'choice', choices: TYPE_LABELS },
        { key: 'relationship', label: 'Relationship', kind: 'choice', choices: RELATIONSHIP_LABELS },
        { key: 'payoutArrangement', label: 'Payouts', kind: 'choice', choices: ARRANGEMENT_LABELS },
        { key: 'reason', label: 'Why the organizer is raising funds for them', kind: 'longText', expandNoun: 'reason' },
      ],
    },
  ],
  'update.create': UPDATE_SPECS,
  'update.edit': UPDATE_SPECS,
  'live.start': [
    { key: 0, label: 'Title', kind: 'title' },
    { key: 1, label: 'Target', kind: 'money', empty: 'No target' },
  ],
  'comment.create': [
    { key: 'authorName', label: 'Shown as', kind: 'text' },
    { key: 'authorAvatarUrl', label: 'Author photo', kind: 'reviewedImage' },
    { key: 'comment', label: 'Comment', kind: 'longText', expandNoun: 'comment' },
  ],
  'account.profile': [
    { key: 'name', label: 'Name', kind: 'text' },
    { key: 'country', label: 'Country', kind: 'text', empty: 'Not set' },
    { key: 'publicProfile', label: 'Profile visibility', kind: 'boolean', yes: 'Public', no: 'Private' },
    { key: 'avatarUrl', label: 'Profile photo', kind: 'image' },
    { key: 'coverUrl', label: 'Cover image', kind: 'image' },
  ],
  'creator.profile': [
    { key: 'handle', label: 'Handle', kind: 'text' },
    { key: 'displayName', label: 'Display name', kind: 'text' },
    { key: 'tagline', label: 'Tagline', kind: 'text' },
    { key: 'tipsEnabled', label: 'Tips', kind: 'boolean', yes: 'On', no: 'Off' },
    { key: 'presetAmounts', label: 'Suggested amounts', kind: 'moneyList', currencyKey: 'currency', empty: 'None' },
    { key: 'avatarUrl', label: 'Profile photo', kind: 'image' },
    { key: 'coverUrl', label: 'Cover image', kind: 'image' },
    { key: 'bio', label: 'Bio', kind: 'longText', expandNoun: 'bio' },
    { key: 'thankYouMessage', label: 'Thank-you message', kind: 'longText', expandNoun: 'message' },
  ],
  'organization.profile': [
    { key: 'organizationName', label: 'Organization name', kind: 'text' },
    { key: 'website', label: 'Website', kind: 'text', empty: 'None' },
  ],
  'tip.public_content': [
    { key: 'supporterName', label: 'Public name', kind: 'text', empty: 'No public name', anonymousCaption: 'The supporter chose to stay anonymous' },
    { key: 'message', label: 'Message', kind: 'longText', empty: 'No message', expandNoun: 'message' },
  ],
  'donation.public_content': [
    { key: 'donorName', label: 'Public name', kind: 'text', empty: 'No public name', anonymousCaption: 'The donor chose to stay anonymous' },
    { key: 'message', label: 'Message', kind: 'longText', empty: 'No message', expandNoun: 'message' },
  ],
}

/** Array-shaped submissions and their exact element types. Any other shape uses the generic view. */
const ARRAY_SHAPES: Record<string, (parts: unknown[]) => boolean> = {
  'update.create': parts => parts.length === 3 && parts.every(part => typeof part === 'string'),
  'update.edit': parts => parts.length === 3 && parts.every(part => typeof part === 'string'),
  'live.start': parts => parts.length === 2 && typeof parts[0] === 'string' && (parts[1] === null || isFiniteNumber(parts[1])),
}

/** What the reviewer should know about the scope of a submission, under the card's fields. */
export const ACTION_CAPTIONS: Record<string, string> = {
  'account.profile': 'The private biography and phone number are not part of this review.',
  'organization.profile': 'Changes the public organization name and website.',
}

/** Shown with the attachments of an action. */
export const MEDIA_CAPTIONS: Record<string, string> = {
  'update.edit': 'Every photo of the edited update is listed, including unchanged ones.',
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

export interface ParsedFact {
  key: string
  label: string
  /** The formatted value; empty when `values` holds a list. */
  value: string
  values?: string[]
  /** The value is a placeholder such as "None", not submitted text. */
  muted?: boolean
  /** Plain-text detail under the value, such as an unchanged image URL. */
  caption?: string
  wide?: boolean
  note?: 'goalLimit' | 'endDate'
  amount?: number
  currency?: string
  iso?: string
}

export interface ParsedText {
  key: string
  label: string
  text: string
  /** Shown, muted, when the text is empty. */
  empty?: string
  expandNoun?: string
}

export interface ParsedGroup {
  key: string
  label: string
  caption?: string
  facts: ParsedFact[]
  texts: ParsedText[]
}

export interface ParsedMedia {
  url: string
  label: string
}

/** A submitted value no renderer recognised, with the label of its path. */
export interface RestEntry {
  key: string
  label: string
  value: unknown
  siblings?: Record<string, unknown>
}

export interface ParsedSubmission {
  /**
   * structured: a known action in its expected shape; fields: an unknown JSON
   * object; list: an unknown JSON array; plain: text that is not JSON, or a JSON
   * primitive.
   */
  kind: 'structured' | 'fields' | 'list' | 'plain'
  /** The proposed title of a titled action. */
  heading?: string
  /** A titled action whose title is empty. */
  headingMissing?: boolean
  facts: ParsedFact[]
  texts: ParsedText[]
  groups: ParsedGroup[]
  /** A thank-you message exactly as donors read it. */
  letter?: string
  media: ParsedMedia[]
  /** Unrecognised or wrongly typed values (kind structured) or every entry (kind fields). */
  rest: RestEntry[]
  /** kind list: the submitted array. */
  values?: unknown[]
}

interface Consumed {
  heading?: string
  headingMissing?: boolean
  facts: ParsedFact[]
  texts: ParsedText[]
  groups: ParsedGroup[]
  rest: RestEntry[]
}

function moneyCurrency(spec: FieldSpec, source: Record<string, unknown>): string | null {
  if (!spec.currencyKey) return 'GHS'
  const currency = source[spec.currencyKey]
  return typeof currency === 'string' && currency.trim() ? currency.trim() : null
}

/**
 * Lay out the recognised fields of one object (or array) and return the rest.
 * A key counts as shown only when its value has the type its field expects;
 * anything else stays in `rest`, so a wrong-typed or unknown key is never lost.
 */
function consume(specs: FieldSpec[], source: Record<string, unknown>, mediaUrls: readonly string[], path: string[]): Consumed {
  const out: Consumed = { facts: [], texts: [], groups: [], rest: [] }
  const shown = new Set<string>()
  const currencyKeys = new Set<string>()
  for (const spec of specs) {
    const key = String(spec.key)
    if (!Object.hasOwn(source, key)) continue
    const value = source[key]
    const id = [...path, key].join('.')
    const fact = (view: Omit<ParsedFact, 'key' | 'label' | 'wide'>) => out.facts.push({ key: id, label: spec.label, wide: spec.wide, ...view })
    switch (spec.kind) {
      case 'title':
        if (typeof value !== 'string') continue
        if (value.trim()) out.heading = value
        else out.headingMissing = true
        break
      case 'text':
        if (typeof value !== 'string') continue
        if (!value) fact({ value: spec.empty ?? '(empty)', muted: true })
        else fact({ value, caption: spec.anonymousCaption && value === 'Anonymous' ? spec.anonymousCaption : undefined })
        break
      case 'longText':
        if (typeof value !== 'string') continue
        out.texts.push({ key: id, label: spec.label, text: value, empty: spec.empty, expandNoun: spec.expandNoun })
        break
      case 'boolean':
        if (typeof value !== 'boolean') continue
        fact({ value: value ? spec.yes ?? 'Yes' : spec.no ?? 'No' })
        break
      case 'choice':
        if (typeof value !== 'string') continue
        if (!value) fact({ value: spec.empty ?? '(empty)', muted: true })
        else fact({ value: spec.choices && Object.hasOwn(spec.choices, value) ? spec.choices[value] : value })
        break
      case 'utcDate': {
        const date = typeof value === 'string' ? formatUtcDate(value) : null
        if (!date) continue
        fact({ value: date, note: spec.note, iso: value as string })
        break
      }
      case 'list':
        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) continue
        if (!value.length) fact({ value: spec.empty ?? 'None', muted: true })
        else fact({ value: '', values: value })
        break
      case 'money': {
        if (value === null && spec.empty) { fact({ value: spec.empty, muted: true }); break }
        if (!isFiniteNumber(value)) continue
        const currency = moneyCurrency(spec, source)
        if (currency && spec.currencyKey) currencyKeys.add(spec.currencyKey)
        if (currency) fact({ value: formatMoney(value, currency), note: spec.note, amount: value, currency })
        else fact({ value: value.toLocaleString('en-GH'), caption: 'No valid currency was submitted.' })
        break
      }
      case 'moneyList': {
        if (!Array.isArray(value) || !value.every(isFiniteNumber)) continue
        if (!value.length) { fact({ value: spec.empty ?? 'None', muted: true }); break }
        const currency = moneyCurrency(spec, source)
        if (currency && spec.currencyKey) currencyKeys.add(spec.currencyKey)
        fact({ value: '', values: value.map(amount => (currency ? formatMoney(amount, currency) : amount.toLocaleString('en-GH'))) })
        break
      }
      case 'image':
        if (typeof value !== 'string') continue
        if (!value) fact({ value: 'None', muted: true })
        else if (mediaUrls.includes(value)) fact({ value: 'New, shown below' })
        else fact({ value: 'Unchanged (already reviewed)', caption: value })
        break
      case 'reviewedImage':
        if (typeof value !== 'string') continue
        if (!value) fact({ value: 'No photo', muted: true })
        else fact({ value: 'Already reviewed', caption: value })
        break
      case 'group': {
        if (!isPlainObject(value)) continue
        const inner = consume(spec.fields ?? [], value, mediaUrls, [...path, key])
        out.groups.push({ key: id, label: spec.label, caption: spec.caption, facts: inner.facts, texts: inner.texts })
        out.rest.push(...inner.rest)
        break
      }
    }
    shown.add(key)
  }
  for (const key of currencyKeys) if (typeof source[key] === 'string') shown.add(key)
  for (const [key, value] of Object.entries(source)) {
    if (shown.has(key)) continue
    out.rest.push({ key: [...path, key].join('.'), label: [...path, key].map(part => humanizeKey(part)).join(' › '), value, siblings: source })
  }
  return out
}

const THANK_YOU_PARTS = ['subject', 'body', 'signature']

function thankYouLetter(fields: Record<string, unknown>, text: string): Pick<ParsedSubmission, 'letter' | 'rest'> | null {
  const parts = THANK_YOU_PARTS.map(key => fields[key])
  if (!parts.every(part => part === undefined || part === null || typeof part === 'string')) return null
  if (typeof fields.subject !== 'string' && typeof fields.body !== 'string') return null
  const letter = thankYouText(text)
  if (letter === null) return null
  const rest = Object.entries(fields).filter(([key]) => !THANK_YOU_PARTS.includes(key)).map(([key, value]) => ({ key, label: humanizeKey(key), value, siblings: fields }))
  return { letter, rest }
}

/** Read a submission for display. Memoise per item: it parses JSON. */
export function parseSubmission(action: string, text: string, mediaUrls: readonly string[] = []): ParsedSubmission {
  const base: ParsedSubmission = { kind: 'structured', facts: [], texts: [], groups: [], rest: [], media: mediaUrls.map((url, index) => ({ url, label: mediaLabel(action, text, url, index) })) }
  // A web address is plain text: never JSON-parse it, so "2026" stays a string.
  if (action === 'campaign.slug') return { ...base, facts: [{ key: 'slug', label: 'Proposed address', value: `/c/${text}` }] }
  let value: unknown
  try { value = JSON.parse(text) } catch { return { ...base, kind: 'plain' } }
  if (action === 'thank_you.send' && isPlainObject(value)) {
    const letter = thankYouLetter(value, text)
    if (letter) return { ...base, ...letter }
  }
  const specs = FIELD_SPECS[action]
  const shape = ARRAY_SHAPES[action]
  if (specs && (shape ? Array.isArray(value) && shape(value) : isPlainObject(value))) {
    const consumed = consume(specs, value as Record<string, unknown>, mediaUrls, [])
    if (action === 'comment.create' && !consumed.facts.some(fact => fact.key === 'authorAvatarUrl')) {
      // Only an already reviewed photo is bound in the text. Any other photo, new or a legacy one never reviewed, arrives as media.
      consumed.facts.push({ key: 'authorPhoto', label: 'Author photo', value: mediaUrls.length ? 'Photo not yet reviewed, shown below' : 'No photo', muted: !mediaUrls.length })
    }
    return { ...base, ...consumed }
  }
  if (isPlainObject(value)) return { ...base, kind: 'fields', rest: Object.entries(value).map(([key, item]) => ({ key, label: humanizeKey(key), value: item, siblings: value })) }
  if (Array.isArray(value)) return { ...base, kind: 'list', values: value }
  return { ...base, kind: 'plain' }
}

// ─── Media ───────────────────────────────────────────────────────────────────

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)
    return isPlainObject(value) ? value : null
  } catch { return null }
}

/** Name each attachment for the reviewer. Profile proposals bind the photo and cover URLs in their text. */
export function mediaLabel(action: string, text: string, url: string, index: number): string {
  if (action === 'creator.profile' || action === 'account.profile') {
    const fields = parseObject(text)
    if (fields) {
      const { avatarUrl, coverUrl } = fields
      if (url === avatarUrl && url === coverUrl) return 'Photo and cover'
      if (url === avatarUrl) return 'Photo'
      if (url === coverUrl) return 'Cover'
    }
  }
  if (action === 'campaign.create') return index === 0 ? 'Cover image' : `Image ${index + 1}`
  if (action === 'update.create' || action === 'update.edit') return `Photo ${index + 1}`
  if (action === 'comment.create' && index === 0 && parseObject(text)) return 'Author photo'
  return `Media ${index + 1}`
}

export function mediaHeading(action: string, count: number): string {
  const noun = action === 'campaign.create' ? 'Image'
    : ['update.create', 'update.edit', 'comment.create', 'account.profile', 'creator.profile'].includes(action) ? 'Photo'
      : 'Attachment'
  return count === 1 ? noun : `${noun}s (${count})`
}

// ─── Text ────────────────────────────────────────────────────────────────────

/** A thank-you is stored as JSON of subject, body and signature: show it the way donors would read it. */
export function thankYouText(text: string): string | null {
  try {
    const fields: unknown = JSON.parse(text)
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null
    const { subject, body, signature } = fields as Record<string, unknown>
    return [`Subject: ${String(subject ?? '')}`, String(body ?? ''), signature ? `Signed: ${String(signature)}` : ''].filter(Boolean).join('\n\n')
  } catch { return null }
}

function exportValue(value: unknown): string {
  if (Array.isArray(value)) return value.every(item => typeof item === 'string') ? value.join(', ') : JSON.stringify(value)
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** The Text column of the review export: readable, with nested values as JSON instead of "[object Object]". */
export function exportText(action: string, text: string): string {
  if (action === 'thank_you.send') return thankYouText(text) ?? text
  if (['comment.create', 'donation.public_content', 'tip.public_content', 'campaign.create', 'creator.profile', 'organization.profile', 'account.profile'].includes(action)) {
    const fields = parseObject(text)
    if (fields) return Object.entries(fields).map(([key, value]) => `${key}: ${exportValue(value)}`).join('\n\n')
  }
  if (!action.startsWith('update.')) return text
  try {
    const parts: unknown = JSON.parse(text)
    if (Array.isArray(parts) && parts.length === 3 && parts.every(part => typeof part === 'string')) return `${parts[0]}\n\n${parts[1]}\n\nUpdate type: ${parts[2]}`
  } catch { /* Keep the original evidence if it is not structured text. */ }
  return text
}

/** Characters as a reader counts them (an emoji is one), e.g. "2,340". */
export function characterCount(text: string): string {
  return Array.from(text).length.toLocaleString('en-GH')
}

// ─── Hidden characters ───────────────────────────────────────────────────────

/**
 * Characters a reader cannot see that can hide or reorder approved text: every
 * bidi control and default-ignorable code point, and control characters other
 * than tab and line breaks. Invisible characters that ordinary writing needs are
 * left out: the zero-width joiner (emoji sequences), one variation selector
 * after a visible character (emoji and CJK variants) and the tags of the
 * England, Scotland and Wales flag emoji. Anything beyond that, such as a run of
 * variation selectors or any other tag characters, can carry a hidden payload.
 */
const HIDDEN = /[\p{Bidi_Control}\p{Default_Ignorable_Code_Point}\p{Cc}]/u
const ALLOWED_CONTROLS = new Set([0x09, 0x0a, 0x0d])
const ZERO_WIDTH_JOINER = 0x200d
const BLACK_FLAG = 0x1f3f4
const CANCEL_TAG = 0xe007f
/** RGI emoji tag sequences: the black flag, these tags, then a cancel tag. */
const FLAG_TAGS = new Set(['gbeng', 'gbsct', 'gbwls'])
/** The warning lists this many kinds of character, then says how many more there are. */
const LISTED_KINDS = 6

const HIDDEN_NAMES: Record<number, string> = {
  0x00ad: 'soft hyphen',
  0x034f: 'combining grapheme joiner',
  0x061c: 'Arabic letter mark',
  0x115f: 'Hangul choseong filler',
  0x1160: 'Hangul jungseong filler',
  0x17b4: 'Khmer inherent vowel AQ',
  0x17b5: 'Khmer inherent vowel AA',
  0x180e: 'Mongolian vowel separator',
  0x200b: 'zero-width space',
  0x200c: 'zero-width non-joiner',
  0x200e: 'left-to-right mark',
  0x200f: 'right-to-left mark',
  0x202a: 'left-to-right embedding',
  0x202b: 'right-to-left embedding',
  0x202c: 'pop directional formatting',
  0x202d: 'left-to-right override',
  0x202e: 'right-to-left override',
  0x2060: 'word joiner',
  0x2061: 'function application',
  0x2062: 'invisible times',
  0x2063: 'invisible separator',
  0x2064: 'invisible plus',
  0x2066: 'left-to-right isolate',
  0x2067: 'right-to-left isolate',
  0x2068: 'first strong isolate',
  0x2069: 'pop directional isolate',
  0x206a: 'inhibit symmetric swapping',
  0x206b: 'activate symmetric swapping',
  0x206c: 'inhibit Arabic form shaping',
  0x206d: 'activate Arabic form shaping',
  0x206e: 'national digit shapes',
  0x206f: 'nominal digit shapes',
  0x3164: 'Hangul filler',
  0xfeff: 'zero-width no-break space',
  0xffa0: 'halfwidth Hangul filler',
  0xe0001: 'language tag',
  0xe007f: 'cancel tag',
}

export interface HiddenCharacter {
  codePoint: string
  name: string
  count: number
}

function isVariationSelector(code: number): boolean {
  return (code >= 0xfe00 && code <= 0xfe0f) || (code >= 0xe0100 && code <= 0xe01ef) || (code >= 0x180b && code <= 0x180d) || code === 0x180f
}

const isHidden = (code: number) => HIDDEN.test(String.fromCodePoint(code))

function hiddenName(code: number): string {
  if (Object.hasOwn(HIDDEN_NAMES, code)) return HIDDEN_NAMES[code]
  if (isVariationSelector(code)) return 'variation selector with nothing to vary'
  if (code >= 0xe0020 && code <= 0xe007e) return 'tag character'
  if (code >= 0x1bca0 && code <= 0x1bca3) return 'shorthand format control'
  if (code >= 0x1d173 && code <= 0x1d17a) return 'musical format control'
  if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return 'control character'
  return 'unassigned invisible character'
}

/** The index of the cancel tag that ends a known flag's tags starting at `start`, or -1. */
function flagTagsEnd(codes: readonly number[], start: number): number {
  let tags = ''
  let index = start
  while (index < codes.length && tags.length < 6 && codes[index] >= 0xe0020 && codes[index] <= 0xe007e) {
    tags += String.fromCodePoint(codes[index] - 0xe0000)
    index++
  }
  return codes[index] === CANCEL_TAG && FLAG_TAGS.has(tags) ? index : -1
}

function scan(text: string, counts: Map<number, number>): void {
  const codes = Array.from(text, char => char.codePointAt(0) ?? 0)
  for (let index = 0; index < codes.length; index++) {
    const code = codes[index]
    if (code === BLACK_FLAG) {
      // The flag itself is visible; a known flag's tags are skipped, any others are counted below.
      const end = flagTagsEnd(codes, index + 1)
      if (end > 0) index = end
      continue
    }
    if (!isHidden(code) || code === ZERO_WIDTH_JOINER || ALLOWED_CONTROLS.has(code)) continue
    // One selector right after a visible character picks its variant; any other selector varies nothing.
    if (isVariationSelector(code) && index > 0 && !isHidden(codes[index - 1])) continue
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
}

/** Count hidden characters in plain strings, such as the account, campaign and page names shown on a card. */
export function hiddenCharactersIn(texts: readonly string[]): HiddenCharacter[] {
  const counts = new Map<number, number>()
  for (const text of texts) scan(text, counts)
  return [...counts].map(([code, count]) => ({ codePoint: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`, name: hiddenName(code), count }))
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, out))
  else if (isPlainObject(value)) for (const [key, item] of Object.entries(value)) { out.push(key); collectStrings(item, out) }
}

/** Count hidden characters in what the text says, decoding JSON first so an escaped character is caught too. */
export function hiddenCharacters(text: string): HiddenCharacter[] {
  try {
    const strings: string[] = []
    collectStrings(JSON.parse(text), strings)
    return hiddenCharactersIn(strings)
  } catch { /* Not JSON: scan it as written. */ }
  return hiddenCharactersIn([text])
}

/** "2 invisible or text-direction characters (U+202E right-to-left override ×1, …)", listing at most six kinds. */
export function hiddenSummary(found: readonly HiddenCharacter[]): string {
  const total = found.reduce((sum, entry) => sum + entry.count, 0)
  const listed = found.slice(0, LISTED_KINDS).map(entry => `${entry.codePoint} ${entry.name} ×${entry.count.toLocaleString('en-GH')}`)
  const more = found.length - LISTED_KINDS
  if (more > 0) listed.push(`${more.toLocaleString('en-GH')} more ${more === 1 ? 'kind' : 'kinds'}`)
  return `${total.toLocaleString('en-GH')} invisible or text-direction ${total === 1 ? 'character' : 'characters'} (${listed.join(', ')})`
}

/** Author-controlled names a card shows around the submission: the accounts, the campaign and the page it was sent to. */
export function contextNames(item: PublicationReviewItem): string[] {
  const values: unknown[] = []
  for (const account of [item.author, item.profileAccount]) if (account) values.push(account.name, account.email, account.organizationName)
  values.push(item.campaign?.title, item.campaign?.slug, item.recipient?.name, item.recipient?.handle)
  return values.filter((value): value is string => typeof value === 'string' && value !== '')
}
