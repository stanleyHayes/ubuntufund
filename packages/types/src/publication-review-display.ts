/**
 * How an author's own publication reviews read on the website and in the app:
 * a plain name for each kind of change, a one-line subject taken from the
 * submitted version, and a short tracker (Submitted → In review → Approved or
 * Declined, then Published when the approval publishes it by itself) with the
 * next step in words. Shared so both clients describe a review the same way.
 * Pure; nothing here throws on malformed data.
 */

import type { DonorThankYouContent } from './donor-thank-you'
import { publicationOutcomeCopy, type PublicationOutcomeState } from './publication-publishing'

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

/**
 * Where publishing a version stands, as the API reports it to its author.
 * Kept as sent: a state or reason this client does not know yet still shows,
 * as itself, and never reads as one it does know.
 */
export interface PublicationReviewPublication {
  /** `publishing`, `published`, `not_published`, `superseded` or `withdrawn` (a PublicationOutcomeState). */
  state: string
  /** Why it was not published, replaced or withdrawn (a PublicationOutcomeReason). */
  reason?: string
  /** When it got there; while publishing, when it was approved. */
  at?: string
}

/** One entry of the author's own list, `GET /publication-reviews`. */
export interface PublicationReviewItem {
  id: string
  action: string
  /** What the version is for: the campaign, the account, or the update being edited (as the API stores it). */
  resourceId?: string
  /** The complete proposed public version, as the API bound it for review. */
  text: string
  status: string
  /** Only the newly proposed images; unchanged ones are already public. */
  mediaUrls?: readonly string[]
  reviewNotes?: string
  approvalExpiresAt?: string
  /** When this exact version was first submitted. */
  createdAt?: string
  /** An approval publishes this version by itself: the author doesn't submit it again. */
  publishOnApproval?: boolean
  /**
   * Where publishing this version stands. Absent while it waits for a
   * decision, once it is declined, and while the author still publishes an
   * approval by submitting the version again.
   */
  publication?: PublicationReviewPublication
  /** The author can still withdraw this version (`POST /publication-reviews/:id/withdraw`). */
  canWithdraw?: boolean
}

export interface PublicationReviewPage {
  items: PublicationReviewItem[]
  total: number
}

/**
 * Where a review stands. `publishing`, `published` and `not_published` follow
 * an approval that publishes the version by itself; `superseded` (replaced by
 * a newer version) and `withdrawn` close a version before or after its
 * approval. `other` is a status, or a publication state, this client does not
 * know yet.
 */
export type PublicationReviewPhase =
  | 'in_review'
  | 'approved'
  | 'approval_expired'
  | 'declined'
  | 'publishing'
  | 'published'
  | 'not_published'
  | 'superseded'
  | 'withdrawn'
  | 'other'

/** `skipped`: the version stopped there unpublished (replaced or withdrawn), which is neither done nor failed. */
export type PublicationStepState = 'complete' | 'current' | 'upcoming' | 'failed' | 'skipped'

export interface PublicationReviewStep {
  /** `publish` follows the decision when the approval publishes the version by itself. */
  key: 'submitted' | 'review' | 'decision' | 'publish'
  label: string
  state: PublicationStepState
  /** A few words shown under the step: when it was submitted or published, or that an approval expired. */
  detail?: string
}

export interface PublicationReviewStage {
  phase: PublicationReviewPhase
  /** The phase in words, e.g. for the tracker's accessible name. */
  label: string
  /**
   * In order; render any number: three, four when the approval publishes the
   * version by itself, two for a version closed before any decision.
   */
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
  /** The moment an approval deadline, and how long publishing has taken, are judged against. Defaults to now. */
  now?: Date
  /** Formats the submitted and published dates. Defaults to the device locale, e.g. "30 Sep". */
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

/** How long publishing an approved version may take before the tracker says it is taking longer than usual. */
export const PUBLICATION_PUBLISHING_SLOW_MS = 10 * 60 * 1000

/** A version that stopped unpublished, replaced or withdrawn, as its step reads. */
const CLOSED_LABEL = { superseded: 'Replaced', withdrawn: 'Withdrawn' } as const

/**
 * Where a review stands, as tracker steps plus the next step in words.
 * An approval only authorizes the same version until its deadline; the API
 * treats a missing deadline as expired, and so does this. When the approval
 * publishes the version by itself, a Published step follows it, and the API's
 * `publication` says how far that got; without one, an approval reads as it
 * always has: the author publishes it by submitting it again.
 */
export function publicationReviewStage(
  review: Pick<PublicationReviewItem, 'id' | 'action' | 'status' | 'approvalExpiresAt' | 'createdAt' | 'publishOnApproval' | 'publication'>,
  options: PublicationReviewDisplayOptions = {},
): PublicationReviewStage {
  const { now = new Date(), formatDate = shortDate, formatDateTime = shortDateTime } = options
  const words = copyFor(review.action)
  const submittedAt = dateOf(review.createdAt)
  const step = (key: PublicationReviewStep['key'], label: string, state: PublicationStepState, detail = ''): PublicationReviewStep => ({
    key,
    label,
    state,
    ...(detail ? { detail } : {}),
  })
  const submitted = step('submitted', 'Submitted', 'complete', submittedAt ? formatDate(submittedAt) : '')
  const steps = (reviewState: PublicationStepState, decisionState: PublicationStepState, decision: string, decisionDetail = ''): PublicationReviewStep[] => [
    submitted,
    step('review', 'In review', reviewState),
    step('decision', decision, decisionState, decisionDetail),
  ]
  /** The author's words for where publishing ended up, its reason included (publicationOutcomeCopy). */
  const outcome = (state: PublicationOutcomeState, deadline?: string) =>
    publicationOutcomeCopy({ action: review.action, state, reason: review.publication?.reason, ...(deadline ? { deadline } : {}) }).body
  switch (review.status) {
    case 'pending':
      if (review.publishOnApproval === true) {
        return {
          phase: 'in_review',
          label: 'In review',
          steps: [...steps('current', 'upcoming', 'Approved'), step('publish', 'Published', 'upcoming')],
          hint: "A person is checking it. It's published automatically once approved.",
        }
      }
      return { phase: 'in_review', label: 'In review', steps: steps('current', 'upcoming', 'Approved'), hint: 'A person is checking it.' }
    case 'approved': {
      const expiresAt = dateOf(review.approvalExpiresAt)
      /** The approval's deadline while it lasts. */
      const deadline = expiresAt && expiresAt.getTime() > now.getTime() ? expiresAt : undefined
      const { publication } = review
      if (publication) {
        const approvedThen = (label: string, state: PublicationStepState, detail = '', approvalDetail = '') => [
          ...steps('complete', 'complete', 'Approved', approvalDetail),
          step('publish', label, state, detail),
        ]
        const at = dateOf(publication.at)
        const { state } = publication
        switch (state) {
          case 'publishing': {
            const slow = !!at && now.getTime() - at.getTime() >= PUBLICATION_PUBLISHING_SLOW_MS
            return {
              phase: 'publishing',
              label: 'Publishing',
              steps: approvedThen('Publishing', 'current'),
              hint: slow ? "Approved. Publishing is taking longer than usual; we'll keep trying." : outcome('publishing'),
            }
          }
          case 'published':
            return {
              phase: 'published',
              label: 'Published',
              steps: approvedThen('Published', 'complete', at ? formatDate(at) : ''),
              hint: outcome('published'),
            }
          case 'not_published':
            // Submitting the same version again publishes it straight away only while the approval lasts;
            // once it has run out, it only reopens the version for a new review (the hint says which).
            return {
              phase: 'not_published',
              label: 'Not published',
              steps: approvedThen("Couldn't publish", 'failed', '', deadline ? '' : 'Expired'),
              hint: outcome('not_published', deadline && formatDateTime(deadline)),
            }
          case 'superseded':
          case 'withdrawn':
            return { phase: state, label: CLOSED_LABEL[state], steps: approvedThen(CLOSED_LABEL[state], 'skipped'), hint: outcome(state) }
          default: {
            // A state this client does not know yet: shown as itself, without guessing what it means.
            const label = humanize(state) || 'Updated'
            return { phase: 'other', label, steps: approvedThen(label, 'current'), hint: '' }
          }
        }
      }
      if (deadline) {
        return {
          phase: 'approved',
          label: 'Approved',
          steps: steps('complete', 'complete', 'Approved'),
          hint: `Approved. If ${words.notYet}, ${words.resubmit} before ${formatDateTime(deadline)}.`,
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
    case 'superseded':
    case 'withdrawn': {
      // Closed before any decision: replaced by a newer version, or taken back by its author.
      const label = CLOSED_LABEL[review.status]
      return { phase: review.status, label, steps: [submitted, step('decision', label, 'skipped')], hint: outcome(review.status) }
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

/**
 * Still to be published by its approval, without its author: waiting for a
 * decision that publishes it by itself, or approved and being published now.
 * Never true while publishing on approval is switched off: the API then
 * marks nothing as publishing by itself.
 */
export function publishesWhenApproved(review: Pick<PublicationReviewItem, 'status' | 'publishOnApproval' | 'publication'>): boolean {
  if (review.status === 'pending') return review.publishOnApproval === true
  return review.status === 'approved' && review.publication?.state === 'publishing'
}

/**
 * The author's thank-you message for one campaign that its approval is still
 * to send by itself: the newest such version in `reviews` (the API lists the
 * newest first). It is sent only if the campaign's saved draft still matches
 * it when it is approved. Null when there is none, or its text can't be read.
 */
export function waitingThankYou(reviews: readonly PublicationReviewItem[], campaignId: string): DonorThankYouContent | null {
  const waiting = reviews.find(review => review.action === 'thank_you.send' && review.resourceId === campaignId && publishesWhenApproved(review))
  const fields = waiting ? asRecord(parseJson(waiting.text)) : undefined
  if (!fields || typeof fields.subject !== 'string' || typeof fields.body !== 'string') return null
  return { subject: fields.subject, body: fields.body, signature: typeof fields.signature === 'string' ? fields.signature : '' }
}

/** A `publication` without a readable state is dropped, and so is a malformed reason or date in it. */
function parsePublication(value: unknown): PublicationReviewPublication | undefined {
  const fields = asRecord(value)
  if (!fields || typeof fields.state !== 'string' || !fields.state) return undefined
  const { state, reason, at } = fields
  return {
    state,
    ...(typeof reason === 'string' && reason ? { reason } : {}),
    ...(typeof at === 'string' && at ? { at } : {}),
  }
}

function parseReviewItem(value: unknown): PublicationReviewItem | null {
  if (!value || typeof value !== 'object') return null
  const { id, action, resourceId, text, status, mediaUrls, reviewNotes, approvalExpiresAt, createdAt, publishOnApproval, publication, canWithdraw } =
    value as Record<string, unknown>
  if (typeof id !== 'string' || typeof action !== 'string' || typeof text !== 'string' || typeof status !== 'string') return null
  if (![reviewNotes, approvalExpiresAt, createdAt].every(field => field == null || typeof field === 'string')) return null
  if (mediaUrls != null && !(Array.isArray(mediaUrls) && mediaUrls.every(url => typeof url === 'string'))) return null
  const published = parsePublication(publication)
  return {
    id,
    action,
    // Read leniently too: only a form that looks up its own item needs it.
    ...(typeof resourceId === 'string' && resourceId ? { resourceId } : {}),
    text,
    status,
    ...(Array.isArray(mediaUrls) ? { mediaUrls: mediaUrls as string[] } : {}),
    ...(typeof reviewNotes === 'string' ? { reviewNotes } : {}),
    ...(typeof approvalExpiresAt === 'string' ? { approvalExpiresAt } : {}),
    ...(typeof createdAt === 'string' ? { createdAt } : {}),
    // Publishing on approval, read leniently: a malformed field is left out, and the version still lists as it would without it.
    ...(typeof publishOnApproval === 'boolean' ? { publishOnApproval } : {}),
    ...(published ? { publication: published } : {}),
    ...(typeof canWithdraw === 'boolean' ? { canWithdraw } : {}),
  }
}

/**
 * A `GET /publication-reviews` page, or null when any part of it is malformed.
 * The publishing fields are the exception: a malformed one is left out of its
 * item, never failing the page.
 */
export function parsePublicationReviewPage(value: unknown): PublicationReviewPage | null {
  if (!value || typeof value !== 'object') return null
  const { items, total } = value as { items?: unknown; total?: unknown }
  if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 || !Array.isArray(items)) return null
  const parsed = items.map(parseReviewItem)
  return parsed.every((item): item is PublicationReviewItem => item !== null) ? { items: parsed, total } : null
}
