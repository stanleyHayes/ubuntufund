/**
 * How an author's own publication reviews read on the website and in the app:
 * a plain name for each kind of change, a one-line subject taken from the
 * submitted version, and a short tracker (Submitted → In review → Approved or
 * Declined) with the next step in words. Shared so both clients describe a
 * review the same way. Pure; nothing here throws on malformed data.
 */

/** Every kind of public change the safety review can hold (the API's PublicationReviewModel `action`). */
export const PUBLICATION_ACTIONS = [
  'campaign.create',
  'campaign.slug',
  'live.start',
  'account.profile',
  'creator.profile',
  'organization.profile',
  'comment.create',
  'update.create',
  'update.edit',
  'thank_you.send',
] as const
export type PublicationAction = (typeof PUBLICATION_ACTIONS)[number]

export const isPublicationAction = (value: string): value is PublicationAction =>
  (PUBLICATION_ACTIONS as readonly string[]).includes(value)

/** Where an author asks about a declined version. */
export const PUBLICATION_SUPPORT_EMAIL = 'support@ujimora.com'

/** Longest subject a review card shows, in characters, ellipsis included. */
export const PUBLICATION_REVIEW_SUBJECT_MAX = 80

/** One entry of the author's own list, `GET /publication-reviews`. */
export interface PublicationReviewItem {
  id: string
  action: string
  /** The complete proposed public version, as the API bound it for review. */
  text: string
  status: string
  /** Only the newly proposed images; unchanged ones are already public. */
  mediaUrls?: readonly string[]
  reviewNotes?: string
  approvalExpiresAt?: string
  /** When this exact version was first submitted. */
  createdAt?: string
}

export interface PublicationReviewPage {
  items: PublicationReviewItem[]
  total: number
}

/**
 * Where a review stands. `other` is a status this client does not know yet;
 * later stages (published, couldn't publish, superseded) join this union.
 */
export type PublicationReviewPhase = 'in_review' | 'approved' | 'approval_expired' | 'declined' | 'other'

export type PublicationStepState = 'complete' | 'current' | 'upcoming' | 'failed'

export interface PublicationReviewStep {
  key: 'submitted' | 'review' | 'decision'
  label: string
  state: PublicationStepState
  /** A few words shown under the step: when it was submitted, or that an approval expired. */
  detail?: string
}

export interface PublicationReviewStage {
  phase: PublicationReviewPhase
  /** The phase in words, e.g. for the tracker's accessible name. */
  label: string
  /** In order; render any number, so a later step (Published) slots in. */
  steps: PublicationReviewStep[]
  /** What happens next, in a sentence or two; empty when there is nothing to add. */
  hint: string
  /** Declined only: who to ask, with the reference support needs. */
  support?: string
}

export interface PublicationReviewDisplay {
  /** The kind of change, e.g. "New campaign". */
  label: string
  /** One line naming this version, e.g. the campaign title; empty when the text says nothing usable. */
  subject: string
  /** The reviewer's note, when there is one. */
  note?: string
  stage: PublicationReviewStage
}

export interface PublicationReviewDisplayOptions {
  /** The moment an approval deadline is judged against. Defaults to now. */
  now?: Date
  /** Formats the submitted date. Defaults to the device locale, e.g. "30 Sep". */
  formatDate?: (date: Date) => string
  /** Formats the approval deadline. Defaults to the device locale, e.g. "7 Oct, 14:00". */
  formatDateTime?: (date: Date) => string
}

interface ActionCopy {
  label: string
  /** Completes "Approved. If …, <resubmit> before <deadline>." */
  resubmit: string
  /** Completes "…, <again> to request a new review." and "Change it before you <again>." */
  again: string
  /** Completes "If …,": the approved version may already be public, and the list cannot tell. */
  notYet: string
}

const copy = (label: string, verb: string, overrides: Partial<ActionCopy> = {}): ActionCopy => ({
  label,
  resubmit: `${verb} it again unchanged`,
  again: `${verb} it again`,
  notYet: "it isn't public yet",
  ...overrides,
})

/** Each form's own words for sending the same version again (see its PublicationHeldNotice). */
const ACTION_COPY: Readonly<Record<PublicationAction, ActionCopy>> = {
  'campaign.create': copy('New campaign', 'submit'),
  'campaign.slug': copy('Campaign link', 'save'),
  'live.start': copy('Live session title', 'start', {
    resubmit: 'start the session again with the same title and goal',
    again: 'start the session again',
    notYet: "you haven't gone live yet",
  }),
  'account.profile': copy('Profile', 'save'),
  'creator.profile': copy('Creator page', 'save'),
  'organization.profile': copy('Organization details', 'save'),
  'comment.create': copy('Comment', 'post'),
  'update.create': copy('Campaign update', 'post'),
  'update.edit': copy('Edited campaign update', 'save'),
  'thank_you.send': copy('Thank-you message', 'send', { resubmit: 'send the same message again', notYet: "you haven't sent it yet" }),
}

/** "publish_failed" → "Publish failed". */
const humanize = (value: string) => {
  const words = value.replace(/[._-]+/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : ''
}

const copyFor = (action: string): ActionCopy =>
  isPublicationAction(action) ? ACTION_COPY[action] : copy(humanize(action) || 'Submission', 'submit')

/** The kind of change in plain words, e.g. "Creator page". */
export const publicationActionLabel = (action: string): string => copyFor(action).label

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

/** A single line: runs of whitespace, line breaks included, become one space. */
const oneLine = (value: unknown): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

/** Shortens by characters (never splitting an emoji), at a word break when one is near. */
function clip(text: string, max = PUBLICATION_REVIEW_SUBJECT_MAX): string {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  const cut = chars.slice(0, max - 1).join('')
  const space = cut.lastIndexOf(' ')
  return `${(space >= max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/**
 * The text binds the complete proposed identity, not what changed, so only the
 * images are known to be new: the API lists just the newly proposed ones.
 */
function withNewImages(name: string, fields: Record<string, unknown> | undefined, mediaUrls: readonly string[]): string {
  const isNew = (key: 'avatarUrl' | 'coverUrl') => {
    const url = fields?.[key]
    return typeof url === 'string' && url !== '' && mediaUrls.includes(url)
  }
  const images = [isNew('avatarUrl') && 'photo', isNew('coverUrl') && 'cover'].filter(Boolean).join(' and ')
  if (!images) return name
  return name ? `${name}, new ${images}` : `New ${images}`
}

/**
 * One line naming the submitted version, read defensively from the text the
 * API bound for review: the campaign, update or live title, the thank-you
 * subject, a comment excerpt, the link, or the public name (with any new
 * images). Empty when the text is malformed or says nothing usable.
 */
export function publicationReviewSubject(review: Pick<PublicationReviewItem, 'action' | 'text' | 'mediaUrls'>): string {
  const { action, text } = review
  if (typeof text !== 'string') return ''
  if (action === 'campaign.slug') return clip(oneLine(text))
  const value = parseJson(text)
  const fields = asRecord(value)
  const parts = Array.isArray(value) ? value : []
  const mediaUrls = Array.isArray(review.mediaUrls) ? review.mediaUrls : []
  switch (action) {
    case 'campaign.create':
      return clip(oneLine(fields?.title))
    case 'live.start':
    case 'update.create':
    case 'update.edit':
      return clip(oneLine(parts[0]))
    case 'thank_you.send':
      return clip(oneLine(fields?.subject))
    case 'comment.create':
      return clip(oneLine(fields?.comment))
    case 'organization.profile':
      return clip(oneLine(fields?.organizationName))
    case 'account.profile':
      return clip(withNewImages(oneLine(fields?.name), fields, mediaUrls))
    case 'creator.profile': {
      const handle = oneLine(fields?.handle)
      return clip(withNewImages(oneLine(fields?.displayName) || (handle ? `@${handle}` : ''), fields, mediaUrls))
    }
    default:
      return ''
  }
}

const dateOf = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || !value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const shortDate = (date: Date) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const shortDateTime = (date: Date) =>
  date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/**
 * Where a review stands, as tracker steps plus the next step in words.
 * An approval only authorizes the same version until its deadline; the API
 * treats a missing deadline as expired, and so does this.
 */
export function publicationReviewStage(
  review: Pick<PublicationReviewItem, 'id' | 'action' | 'status' | 'approvalExpiresAt' | 'createdAt'>,
  options: PublicationReviewDisplayOptions = {},
): PublicationReviewStage {
  const { now = new Date(), formatDate = shortDate, formatDateTime = shortDateTime } = options
  const words = copyFor(review.action)
  const submittedAt = dateOf(review.createdAt)
  const steps = (reviewState: PublicationStepState, decisionState: PublicationStepState, decision: string, decisionDetail = ''): PublicationReviewStep[] => [
    { key: 'submitted', label: 'Submitted', state: 'complete', ...(submittedAt ? { detail: formatDate(submittedAt) } : {}) },
    { key: 'review', label: 'In review', state: reviewState },
    { key: 'decision', label: decision, state: decisionState, ...(decisionDetail ? { detail: decisionDetail } : {}) },
  ]
  switch (review.status) {
    case 'pending':
      return { phase: 'in_review', label: 'In review', steps: steps('current', 'upcoming', 'Approved'), hint: 'A person is checking it.' }
    case 'approved': {
      const expiresAt = dateOf(review.approvalExpiresAt)
      if (expiresAt && expiresAt.getTime() > now.getTime()) {
        return {
          phase: 'approved',
          label: 'Approved',
          steps: steps('complete', 'complete', 'Approved'),
          hint: `Approved. If ${words.notYet}, ${words.resubmit} before ${formatDateTime(expiresAt)}.`,
        }
      }
      // Still approved on the tracker, marked so it never reads as ready to publish.
      return {
        phase: 'approval_expired',
        label: 'Approval expired',
        steps: steps('complete', 'complete', 'Approved', 'Expired'),
        hint: `Approval expired. If ${words.notYet}, ${words.again} to request a new review.`,
      }
    }
    case 'rejected':
      return {
        phase: 'declined',
        label: 'Declined',
        steps: steps('complete', 'failed', 'Declined'),
        hint: `Declined. Change it before you ${words.again}.`,
        support: `Questions? ${PUBLICATION_SUPPORT_EMAIL}, reference ${review.id}`,
      }
    default: {
      const label = humanize(typeof review.status === 'string' ? review.status : '') || 'Updated'
      return { phase: 'other', label, steps: steps('complete', 'current', label), hint: '' }
    }
  }
}

/** Everything a review card shows. Never includes the submitted content itself. */
export function describePublicationReview(
  review: PublicationReviewItem,
  options: PublicationReviewDisplayOptions = {},
): PublicationReviewDisplay {
  const note = typeof review.reviewNotes === 'string' ? review.reviewNotes.trim() : ''
  return {
    label: publicationActionLabel(review.action),
    subject: publicationReviewSubject(review),
    ...(note ? { note } : {}),
    stage: publicationReviewStage(review, options),
  }
}

function parseReviewItem(value: unknown): PublicationReviewItem | null {
  if (!value || typeof value !== 'object') return null
  const { id, action, text, status, mediaUrls, reviewNotes, approvalExpiresAt, createdAt } = value as Record<string, unknown>
  if (typeof id !== 'string' || typeof action !== 'string' || typeof text !== 'string' || typeof status !== 'string') return null
  if (![reviewNotes, approvalExpiresAt, createdAt].every(field => field == null || typeof field === 'string')) return null
  if (mediaUrls != null && !(Array.isArray(mediaUrls) && mediaUrls.every(url => typeof url === 'string'))) return null
  return {
    id,
    action,
    text,
    status,
    ...(Array.isArray(mediaUrls) ? { mediaUrls: mediaUrls as string[] } : {}),
    ...(typeof reviewNotes === 'string' ? { reviewNotes } : {}),
    ...(typeof approvalExpiresAt === 'string' ? { approvalExpiresAt } : {}),
    ...(typeof createdAt === 'string' ? { createdAt } : {}),
  }
}

/** A `GET /publication-reviews` page, or null when any part of it is malformed. */
export function parsePublicationReviewPage(value: unknown): PublicationReviewPage | null {
  if (!value || typeof value !== 'object') return null
  const { items, total } = value as { items?: unknown; total?: unknown }
  if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 || !Array.isArray(items)) return null
  const parsed = items.map(parseReviewItem)
  return parsed.every((item): item is PublicationReviewItem => item !== null) ? { items: parsed, total } : null
}
