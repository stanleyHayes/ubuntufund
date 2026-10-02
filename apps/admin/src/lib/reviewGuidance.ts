import { PUBLICATION_HELD, PUBLISHES_ON_APPROVAL, isAutoPublishAction, publicationOutcomeCopy, publicationReasonCopy, type AutoPublishAction } from '@ubuntu-fund/types'
import { ApiError } from '@/lib/apiError'
import { formatMoney } from '@/lib/money'
import { approvalDeadline, approvalValidUntil, goalAboveLimit, publicationOf, type ItemPublication, type ParsedSubmission, type PublicationReviewItem, type ReviewQueue } from '@/lib/publicationReview'
import { formatDateTime, formatRelative, formatUtcDateTime } from '@/lib/reviewDates'

/*
 * Reviewer guidance: every sentence that tells a reviewer what approving or
 * declining does, keyed by action. The review cards only display what this
 * module returns, so a change in behaviour is a change here (and in its tests).
 *
 * What approving does depends on the item (approvalEffect):
 * - publishes: publishing on approval. Approving publishes this exact version
 *   straight away, after the author's own checks run again; the decision
 *   answers with how that went, and the card keeps showing where it stands;
 * - legacy_unlock: versions submitted before publishing on approval (or while
 *   it is switched off) publish nothing by themselves. Approval unlocks one
 *   exact version for its author, who must submit that same version again
 *   within seven days of approval (sooner if the review record is deleted);
 * - live_unlock: an approved live session starts only when its host starts it;
 * - campaign_legacy: a campaign proposal is not a campaign yet: the campaign is
 *   only created when the creator submits again, and it may then wait for a
 *   separate campaign review.
 * Supporter and donor names and messages are the exception: approval lets them
 * show publicly straight away.
 *
 * Outcome and reason wording shared with authors comes from @ubuntu-fund/types.
 */

export const PAGE_INTRO: Record<ReviewQueue, string> = {
  publication: 'Check every field and every image, then approve or decline this exact version. Approval publishes nothing by itself: the author must submit the same version again within 7 days of approval, or sooner if the proposal is deleted first (each card gives the date). Any change needs a new review. Review notes are visible to the author.',
  content: 'Review the exact public name and message. Approval makes this text eligible for public display straight away. The payment has already settled; decisions do not change funds. Anonymous names remain hidden.',
}

/** The publication queue's intro while publishing on approval is on. */
export const PUBLICATION_QUEUE_INTRO = 'Check every field and every image, then approve or decline this exact version. Approving publishes it straight away, after the author’s account, sign-in, restrictions, agreement and permissions are checked again; if the author changed the item since submitting, it isn’t published. Live-session titles, campaign proposals and versions submitted before automatic publishing aren’t published by approval; their authors submit them again. Review notes are visible to the author.'

/**
 * Whether a loaded list shows publishing on approval switched on: some version
 * in it publishes by itself once approved. The API marks none while it is off
 * (and older APIs send no mark), so this never claims it is on when it is not.
 * Null when the list can't tell, having no waiting or approved version of the
 * actions it applies to (an emptied queue, declined versions): keep what was known.
 */
export function autoPublishingIn(items: readonly Pick<PublicationReviewItem, 'action' | 'status' | 'publishOnApproval'>[]): boolean | null {
  if (items.some(item => item.publishOnApproval === true)) return true
  return items.some(item => isAutoPublishAction(item.action) && (item.status === 'pending' || item.status === 'approved')) ? false : null
}

/** The intro above a queue. */
export function pageIntro(queue: ReviewQueue, autoPublishing = false): string {
  return queue === 'publication' && autoPublishing ? PUBLICATION_QUEUE_INTRO : PAGE_INTRO[queue]
}

/** campaign.slug, when the campaign's address changed after the proposal. */
export const SLUG_CHANGED = 'The address changed after this was proposed, so this approval can’t be used; the owner would have to propose it again.'

/**
 * What approving an item does:
 * - publishes: it is published straight away (publishing on approval);
 * - live_unlock: the host can start the live session with this title;
 * - campaign_legacy: the creator can submit the campaign proposal again;
 * - legacy_unlock: the author can publish this version by submitting it again.
 * Driven only by the item's `publishOnApproval` (which the API sets only while
 * publishing on approval is on) and its action.
 */
export type ApprovalEffect = 'publishes' | 'live_unlock' | 'campaign_legacy' | 'legacy_unlock'

export function approvalEffect(item: Pick<PublicationReviewItem, 'action' | 'publishOnApproval'>): ApprovalEffect {
  if (item.action === 'live.start') return 'live_unlock'
  if (item.action === 'campaign.create') return 'campaign_legacy'
  return item.publishOnApproval === true && isAutoPublishAction(item.action) ? 'publishes' : 'legacy_unlock'
}

export interface GuidanceContext {
  queue: ReviewQueue
  /** The moment the guidance is for: when the page loaded, or when a decision was made. */
  now: number
  purgeAt?: string
  /** campaign.create: the proposed title, goal and whether it is raised for someone else. */
  title?: string
  goal?: { amount: number; currency: string }
  campaignReviewGoalGhs?: number
  onBehalf?: boolean
  /** Approved items: when the approval stops working. */
  validUntil?: string
  /** What approving does (approvalEffect). Absent: approval unlocks the version for its author. */
  effect?: ApprovalEffect
  /** update.create published on approval: it is pinned to the top of the campaign. */
  pinned?: boolean
  /** creator.profile: a new page, not an edit. */
  newPage?: boolean
  /** Publishing on approval is on (autoPublishingIn): a version that does not publish by itself was submitted before it. */
  autoPublishing?: boolean
}

/**
 * A sentence that quotes an author value, such as a campaign title. Strings are
 * system text; each `{ value }` part is author text, which the page renders
 * isolated so its text direction cannot reorder the sentence around it.
 */
export type Phrase = readonly (string | { value: string })[]

/** A phrase as plain text, for tests and anywhere markup is not available. */
export function phraseText(phrase: Phrase): string {
  return phrase.map(part => (typeof part === 'string' ? part : part.value)).join('')
}

export interface ReviewGuidance {
  /** Under the card title. */
  subtitle?: string
  /**
   * Pending items: what approving does. With a title it is shown as an alert,
   * as a warning note when it can't be taken back, otherwise as one sentence.
   */
  approval: { title?: string; lead: string; bullets?: string[]; tone?: 'warning' }
  /** Approved items whose approval can still be used. */
  approvedHint?: string
  /** Shown on the page once a decision is saved, unless the decision answers with a publication outcome. */
  confirmation: { approved: Phrase; rejected: Phrase }
  /** The "Submitted text" disclosure: what a decision is bound to. */
  boundTo: string
}

const ANY_CHANGE = ' Any change needs a new review.'
const DECLINED: Phrase = ['Declined. The author will see your notes in their Publication reviews list.']
const PUBLISHING = 'Approved. Publishing is in progress; the result will show under Approved.'

/** What happens after approval, per action: who must submit again, and what that does. */
const AFTER_APPROVAL: Record<string, (by: string) => string> = {
  'campaign.slug': by => `The new address takes effect only when it is saved again ${by}. Existing links keep working.`,
  'comment.create': by => `The comment appears only when the author posts it again ${by}.`,
  'update.create': by => `The update is posted only when the author submits it again ${by}.`,
  'update.edit': by => `The current update stays as it is until the author saves this edit again ${by}.`,
  'live.start': by => `The live session starts only when the host starts it again with this title and target ${by}.`,
  'thank_you.send': by => `Donors are emailed only when the sender sends this message again ${by}.`,
  'account.profile': by => `The profile changes only when the account holder saves this version again ${by}.`,
  'creator.profile': by => `The creator page changes only when the creator saves this version again ${by}.`,
  'organization.profile': by => `The organization’s name and website change only when this version is saved again ${by}.`,
}

/** What approving publishes straight away, per action. A warning can't be taken back once it goes out. */
const ON_APPROVAL: Record<AutoPublishAction, (context: GuidanceContext) => { lead: string; warning?: boolean }> = {
  'comment.create': () => ({ lead: 'Approving posts this comment on the campaign now.' }),
  'update.create': context => ({ lead: `Approving posts this update now${context.pinned ? ', pinned to the top of the campaign' : ''}.` }),
  'update.edit': () => ({ lead: 'Approving replaces the current update with this edit now.' }),
  'campaign.slug': () => ({ lead: 'Approving changes the campaign’s web address now; existing links keep working.' }),
  'account.profile': () => ({ lead: 'Approving updates the public profile now.' }),
  'creator.profile': context => ({ lead: context.newPage ? 'Approving publishes this new creator page now.' : 'Approving updates the creator page now.' }),
  'organization.profile': () => ({ lead: 'Approving changes the organization’s public name and website now.' }),
  'thank_you.send': () => ({ lead: 'Approving emails this message to the campaign’s eligible donors now. It can’t be recalled; unsubscribed and refunded donors are skipped.', warning: true }),
}
const PUBLISH_TAIL = ' If the author changed it since submitting, it won’t be published and they’ll be asked to submit the new version.'

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/** "by 8 Oct 2026, 10:00" when the record's deletion date is known, otherwise "within 7 days". */
function deadline(context: GuidanceContext): { by: string; until: string; known: boolean } {
  const when = context.purgeAt ? formatDateTime(approvalDeadline(context.now, context.purgeAt)) : null
  return when ? { by: `by ${when}`, until: `until ${when}`, known: true } : { by: 'within 7 days', until: 'within the next 7 days', known: false }
}

const BOUND_TO = 'Exactly as submitted. Approval is bound to this author, action, resource, base version, text and media list.'

/** Supporter and donor names and messages: approval shows them publicly straight away. */
function contentGuidance(action: string): ReviewGuidance {
  // The API shows a hidden name and message as they would appear publicly, while the version covers what is stored.
  const owner = action === 'donation.public_content' ? 'donor' : 'supporter'
  return {
    approval: { lead: 'Approval makes this name and message eligible for public display straight away. Declining keeps them hidden; the payment is not affected.' },
    confirmation: { approved: ['Approved. This name and message can now be shown publicly.'], rejected: ['Declined. This name and message stay hidden.'] },
    boundTo: `As it would appear publicly: an anonymous ${owner}’s name shows as “Anonymous” and a hidden message as empty. A decision applies to this content version only; a changed name or message needs a new review.`,
  }
}

/** campaign_legacy: a proposal becomes a campaign only when its creator submits it again. */
function campaignGuidance(context: GuidanceContext): ReviewGuidance {
  const { by, known } = deadline(context)
  const limit = context.campaignReviewGoalGhs
  const limitText = limit !== undefined ? formatMoney(limit, 'GHS') : 'a set limit'
  const aboveLimit = !!context.goal && goalAboveLimit(context.goal.amount, context.goal.currency, limit)
  const validUntil = formatDateTime(context.validUntil)
  const reviewAfter = aboveLimit ? `, where it may also wait for a campaign review because its goal is above ${limitText}` : ''
  return {
    subtitle: 'Proposed campaign · not created yet',
    approval: {
      title: 'What approval does',
      lead: `After approval the creator must submit this same version again within 7 days; only then does the campaign appear under Campaigns.${known ? ` If you approve now, that is ${by}.` : ''}`,
      bullets: [
        'Approving creates nothing and publishes nothing.',
        'Any change, including a different cover image, needs a new review.',
        `Once created, the campaign may wait again under Campaigns → Pending review: goals above ${limitText}, goals in the tiers the campaign review settings send to staff, and campaigns raised for someone else need a separate campaign review.`
          + (aboveLimit ? ` This goal is above ${limitText}, so expect that review unless the organizer is a verified returning organizer.` : '')
          + (context.onBehalf ? ' It is raised on someone else’s behalf, so it may also wait for the beneficiary’s consent.' : ''),
        'Approval does not authorize the goal, payouts or any movement of money.',
      ],
    },
    approvedHint: validUntil ? `The creator can publish this version until ${validUntil}. Once they do, it appears under Campaigns (search for its title).` : undefined,
    confirmation: {
      approved: [
        ...(context.title ? ['Approved “', { value: context.title }, '”.'] : ['Approved this campaign proposal.']),
        ` Nothing is published yet: the creator must submit this exact version again ${by}. Only then does the campaign appear under Campaigns${reviewAfter}.`,
      ],
      rejected: DECLINED,
    },
    boundTo: BOUND_TO,
  }
}

/** publishes: approving publishes the version straight away. */
function publishingGuidance(action: AutoPublishAction, context: GuidanceContext): ReviewGuidance {
  const { lead, warning } = ON_APPROVAL[action](context)
  return {
    approval: { lead: `${lead}${PUBLISH_TAIL}`, ...(warning ? { tone: 'warning' as const } : {}) },
    confirmation: { approved: [PUBLISHING], rejected: DECLINED },
    boundTo: BOUND_TO,
  }
}

/** legacy_unlock and live_unlock: approval lets the author publish this exact version by submitting it again. */
function unlockGuidance(action: string, context: GuidanceContext): ReviewGuidance {
  const { by, until } = deadline(context)
  const after = AFTER_APPROVAL[action]
  const lead = after ? `${after(by)}${ANY_CHANGE}` : `Approval lets the author publish only this exact version, ${by}.${ANY_CHANGE}`
  // While publishing on approval is on, a version of its actions that does not publish by itself predates it.
  const predates = context.autoPublishing && isAutoPublishAction(action)
  return {
    approval: { lead: predates ? `Submitted before automatic publishing: ${lowerFirst(lead)}` : lead },
    confirmation: { approved: [`Approved. The author can publish this exact version ${until}.`], rejected: DECLINED },
    boundTo: BOUND_TO,
  }
}

/** All reviewer guidance for one item. */
export function reviewGuidance(action: string, context: GuidanceContext): ReviewGuidance {
  if (context.queue === 'content') return contentGuidance(action)
  if (action === 'campaign.create') return campaignGuidance(context)
  if (context.effect === 'publishes' && isAutoPublishAction(action)) return publishingGuidance(action, context)
  return unlockGuidance(action, context)
}

/** The guidance for a loaded review item, at `now`. */
export function guidanceFor(item: PublicationReviewItem, parsed: ParsedSubmission, options: { queue: ReviewQueue; now: number; campaignReviewGoalGhs?: number; autoPublishing?: boolean }): ReviewGuidance {
  const goal = parsed.facts.find(fact => fact.note === 'goalLimit')
  return reviewGuidance(item.action, {
    queue: options.queue,
    now: options.now,
    purgeAt: item.purgeAt,
    title: parsed.heading,
    goal: goal?.amount !== undefined && goal.currency ? { amount: goal.amount, currency: goal.currency } : undefined,
    campaignReviewGoalGhs: options.campaignReviewGoalGhs,
    onBehalf: parsed.groups.some(group => group.key === 'onBehalf'),
    validUntil: approvalValidUntil(item),
    effect: approvalEffect(item),
    pinned: item.applyOptions?.isPinned === true,
    newPage: item.baseVersion === 'new',
    autoPublishing: options.autoPublishing,
  })
}

// ─── After a decision ────────────────────────────────────────────────────────

/** What a publication decision answered (`PUT /admin/publication-reviews/:id/review`). */
export interface DecisionResult {
  /** This approval publishes the version by itself. */
  publishOnApproval: boolean
  /** Where its publication stands: publishing, or where it ended. */
  publication?: { state: string; reason?: string }
}

/** The decision answer, read leniently; null from an API that does not publish on approval (no `publishOnApproval`). */
export function decisionResultOf(response: unknown): DecisionResult | null {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return null
  const { publishOnApproval, publication } = response as Record<string, unknown>
  if (typeof publishOnApproval !== 'boolean') return null
  const read = publicationOf({ publication })
  return { publishOnApproval, ...(read ? { publication: { state: read.state, ...(read.reason ? { reason: read.reason } : {}) } } : {}) }
}

export type ConfirmationSeverity = 'success' | 'info' | 'warning'

export interface DecisionConfirmation {
  severity: ConfirmationSeverity
  message: Phrase
}

/** "Approved, but not published: …", completed by the shared staff wording of a reason. */
const notPublished = (reason: string) => `Approved, but not published: ${publicationReasonCopy(reason).staff}.`
/** The API tells the author in their inbox, except when their account is closed or gone (no notice is kept for it). */
const toldTheAuthor = (reason: string | undefined) => (reason === 'account_unavailable' ? '' : ' The author has been told.')

/**
 * The page's confirmation of a saved decision. An approval that publishes by
 * itself is confirmed by how publishing went (`result`); any other decision,
 * and an API that does not answer with an outcome, by the item's guidance.
 * Pass the item as the decision answered it (its `publishOnApproval`).
 */
export function decisionConfirmation(
  item: Pick<PublicationReviewItem, 'action' | 'publishOnApproval'>,
  decision: 'approved' | 'rejected',
  result: DecisionResult | null,
  guidance: Pick<ReviewGuidance, 'confirmation'>,
): DecisionConfirmation {
  if (decision === 'rejected') return { severity: 'success', message: guidance.confirmation.rejected }
  const publication = result?.publication
  switch (publication?.state) {
    case 'published':
      return { severity: 'success', message: [item.action === 'thank_you.send' ? 'Approved. The message is queued and the campaign’s eligible donors are being emailed.' : 'Approved and published.'] }
    case 'not_published':
      return { severity: 'warning', message: [`${notPublished(publication.reason ?? '')}${toldTheAuthor(publication.reason)}`] }
    case 'superseded':
      // As the shared outcome copy reads it: anything but an edit is a newer version.
      return { severity: 'info', message: [notPublished(publication.reason === 'edited_since_submitted' ? publication.reason : 'newer_version_submitted')] }
    case 'withdrawn':
      return { severity: 'info', message: [notPublished('withdrawn_by_author')] }
    default:
      // Still publishing, or no outcome in the answer.
      return approvalEffect(item) === 'publishes' ? { severity: 'info', message: [PUBLISHING] } : { severity: 'success', message: guidance.confirmation.approved }
  }
}

// ─── Where an approved version stands ───────────────────────────────────────

export type StatusTone = 'success' | 'info' | 'warning' | 'neutral'

export interface PublicationStatusLine {
  tone: StatusTone
  text: string
}

/**
 * Approved without publishing on approval: before it, while it was off, or
 * handed back when it was switched off. Its approval publishes nothing, and
 * the card can't tell whether its author already did: approvals made before
 * publishing on approval was deployed recorded no publication by the author.
 */
export const AUTHOR_PUBLISHES = 'Not published by its approval: the author publishes it by submitting it again.'
/** The export's line for such an approval once it has run out, for the same reason never "not published". */
export const EXPIRED_NOT_RECORDED = 'Approval expired; no publication recorded'
/** Waiting to publish while publishing on approval is switched off: it goes back to the author. */
export const RETURNED_TO_AUTHOR = 'Returned to the author: publishing on approval is switched off, so they publish it by submitting it again.'
const PUBLISHED_VIA: Record<string, string> = { approval: 'by approval', author: 'by the author' }

/** Formats a timestamp for a status line, or null when it is missing or invalid. */
type TimeFormat = (value: string | undefined) => string | null

/** "2 Oct 2026, 10:00 (5 minutes ago)". */
function cardTime(value: string | undefined, now: number): string | null {
  const exact = formatDateTime(value)
  if (!exact) return null
  const relative = formatRelative(value, now)
  return relative ? `${exact} (${relative})` : exact
}

/** Whether an approval can still be used at `now`; null when its expiry is unknown. */
function approvalLasts(item: PublicationReviewItem, now: number): boolean | null {
  const validUntil = Date.parse(approvalValidUntil(item) ?? '')
  return Number.isFinite(validUntil) ? validUntil > now : null
}

/** "Published 2 Oct 2026, 10:00 (5 minutes ago) · by approval". */
function publishedLine(publication: ItemPublication, time: TimeFormat): PublicationStatusLine {
  const at = time(publication.at)
  const via = PUBLISHED_VIA[publication.via ?? '']
  return { tone: 'success', text: [at ? `Published ${at}` : 'Published', via].filter(Boolean).join(' · ') }
}

/** An attempt running now (applying), or the next one waiting (queued). */
function publishingLine(publication: ItemPublication, now: number, time: TimeFormat): PublicationStatusLine {
  const attempts = publication.attempts ?? 0
  if (publication.state === 'applying') return { tone: 'info', text: attempts ? `Publishing now, attempt ${attempts}` : 'Publishing now' }
  const next = Date.parse(publication.nextAttemptAt ?? '')
  const nextTry = Number.isFinite(next) && next > now ? time(publication.nextAttemptAt) : null
  if (!attempts) return { tone: 'info', text: nextTry ? `Publishing… first try ${nextTry}` : 'Publishing…' }
  return { tone: 'info', text: nextTry ? `Publishing… attempt ${attempts}, next try ${nextTry}` : `Publishing… attempt ${attempts}` }
}

/**
 * One line on a decided card: where an approved version of the publish-on-
 * approval actions stands. Null when there is nothing to add: other actions,
 * declined versions, and a plain approval that expired unused (the card says so).
 * `time` formats a timestamp (the card's local time by default).
 */
export function publicationStatusLine(item: PublicationReviewItem, now: number, time: TimeFormat = value => cardTime(value, now)): PublicationStatusLine | null {
  if (item.status !== 'approved' || !isAutoPublishAction(item.action)) return null
  const publication = publicationOf(item)
  if (!publication) return item.publishOnApproval !== true && approvalLasts(item, now) ? { tone: 'neutral', text: AUTHOR_PUBLISHES } : null
  switch (publication.state) {
    case 'published':
      return publishedLine(publication, time)
    case 'queued':
    case 'applying':
      // Only an approval that publishes by itself waits to publish; switched off, the next sweep hands it back.
      return item.publishOnApproval !== true && publication.state === 'queued' ? { tone: 'neutral', text: RETURNED_TO_AUTHOR } : publishingLine(publication, now, time)
    case 'not_published':
    case 'superseded':
    case 'withdrawn':
      return {
        tone: publication.state === 'not_published' ? 'warning' : 'neutral',
        text: publicationOutcomeCopy({ action: item.action, state: publication.state, reason: publication.reason }).staff,
      }
    default:
      return null
  }
}

/** The export's Publication column: what approving does, or where an approved version stands (times in UTC). */
export function publicationExportText(item: PublicationReviewItem, now: number): string {
  if (item.status === 'pending') return approvalEffect(item) === 'publishes' ? 'Publishes on approval' : 'Author submits it again after approval'
  const line = publicationStatusLine(item, now, formatUtcDateTime)
  if (line) return line.text
  // An approval from before publishing on approval was deployed may have been used without a record: never claim it wasn't.
  const expiredUnrecorded = item.status === 'approved' && isAutoPublishAction(item.action) && !publicationOf(item) && approvalLasts(item, now) === false
  return expiredUnrecorded ? EXPIRED_NOT_RECORDED : ''
}

// ─── The administrator's own held change ────────────────────────────────────

export interface HeldChange {
  /** The API's explanation; it starts "Saved privately for safety review." */
  message: string
  /** Another administrator's approval publishes it, without saving it again. */
  publishesOnApproval: boolean
  /** The settings sent with it that need no review were saved. */
  savedPrivate: boolean
}

const HELD_PREFIX = 'Saved privately for safety review.'

/** A change of the administrator's own public details held for review (409 `errors.publication`), or null for any other error. */
export function heldChangeOf(error: unknown): HeldChange | null {
  if (!(error instanceof Error)) return null
  const errors = error instanceof ApiError ? error.errors : undefined
  const marks = errors?.publication ?? []
  // Older APIs mark a hold only by its message.
  if (!marks.includes(PUBLICATION_HELD) && !error.message.startsWith(HELD_PREFIX)) return null
  return { message: error.message, publishesOnApproval: marks.includes(PUBLISHES_ON_APPROVAL), savedPrivate: !!errors?.saved?.includes('private') }
}

/** The notice for a held change: what was saved, the API's explanation, and what to do after approval when anything. */
export function heldChangeNotice(held: HeldChange): string {
  return [
    held.savedPrivate ? 'Your other changes are saved.' : '',
    held.message,
    // Published on approval, the API's message already says so; otherwise the same version must be saved again.
    held.publishesOnApproval ? '' : 'After approval, save the same version here.',
  ].filter(Boolean).join(' ')
}
