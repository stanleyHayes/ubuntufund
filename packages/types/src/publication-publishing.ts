/**
 * Publish on approval: which held changes a staff approval publishes by
 * itself, the outcomes an approved version can end with, and the words the
 * API's notices, the admin console and both clients use for them. The single
 * source of that wording. Pure and lenient: an unknown action, state or reason
 * never throws; it reads as a generic change.
 */

/**
 * The changes a staff approval publishes straight away, after the author's own
 * checks run again. Live-session titles and campaign proposals are not among
 * them: the host starts a live session, and a campaign goes through the
 * campaign review.
 */
export const AUTO_PUBLISH_ACTIONS = [
  'account.profile',
  'organization.profile',
  'creator.profile',
  'comment.create',
  'update.create',
  'update.edit',
  'thank_you.send',
  'campaign.slug',
] as const
export type AutoPublishAction = (typeof AUTO_PUBLISH_ACTIONS)[number]

/**
 * Each publication creates something new (a comment, an update, a queued
 * message). Once published, the same version is never published again while
 * its review record exists: an identical resubmission is the same post.
 */
export const CREATE_ACTIONS: readonly AutoPublishAction[] = ['comment.create', 'update.create', 'thank_you.send']

/**
 * One current version per item. A newer submission for the same item replaces
 * (supersedes) every earlier version of it that is not published yet,
 * whoever submitted it.
 */
export const SINGLE_ITEM_ACTIONS: readonly AutoPublishAction[] = [
  'account.profile',
  'creator.profile',
  'organization.profile',
  'campaign.slug',
  'update.edit',
  'thank_you.send',
]

export const isAutoPublishAction = (action: unknown): action is AutoPublishAction =>
  typeof action === 'string' && (AUTO_PUBLISH_ACTIONS as readonly string[]).includes(action)
export const isCreateAction = (action: unknown): boolean =>
  typeof action === 'string' && (CREATE_ACTIONS as readonly string[]).includes(action)
export const isSingleItemAction = (action: unknown): boolean =>
  typeof action === 'string' && (SINGLE_ITEM_ACTIONS as readonly string[]).includes(action)

/**
 * `errors.publication` markers on a 409. `held` (with `publishes_on_approval`
 * when an approval publishes it without resubmitting) is a version waiting
 * for review; `published` is a version that is already published.
 */
export const PUBLICATION_HELD = 'held'
export const PUBLISHES_ON_APPROVAL = 'publishes_on_approval'
export const PUBLICATION_ALREADY_PUBLISHED = 'published'

/** Where an approved version stands on its way to publication (the review record's `publishState`). */
export const PUBLICATION_PUBLISH_STATES = ['queued', 'applying', 'published', 'not_published', 'superseded', 'withdrawn'] as const
export type PublicationPublishState = (typeof PUBLICATION_PUBLISH_STATES)[number]

/**
 * Approved but neither published nor closed: a newer version supersedes it,
 * the author may withdraw it, and the author's own resubmission publishes it.
 */
export const OPEN_PUBLISH_STATES: readonly PublicationPublishState[] = ['queued', 'applying', 'not_published']

/** Final for this approval: it can never publish again. */
export const CLOSED_PUBLISH_STATES: readonly PublicationPublishState[] = ['published', 'superseded', 'withdrawn']

/** What an author is shown: `queued` and `applying` both read as publishing. */
export type PublicationOutcomeState = 'publishing' | 'published' | 'not_published' | 'superseded' | 'withdrawn'

export const PUBLICATION_NOT_PUBLISHED_REASONS = [
  'account_unavailable',
  'credentials_changed',
  'restricted',
  'organizer_restricted',
  'terms_not_accepted',
  'organization_terms_not_accepted',
  'permission_changed',
  'item_unavailable',
  'identity_changed',
  'blocked',
  'plan_ineligible',
  'handle_taken',
  'address_taken',
  'thank_you_disabled',
  'thank_you_limit_reached',
  'thank_you_no_donors',
  'thank_you_not_eligible',
  'campaign_unavailable',
  'approval_expired',
  'unreadable',
  'unavailable',
] as const
export const PUBLICATION_SUPERSEDED_REASONS = ['edited_since_submitted', 'newer_version_submitted'] as const
export const PUBLICATION_WITHDRAWN_REASONS = ['withdrawn_by_author'] as const
export const PUBLICATION_OUTCOME_REASONS = [
  ...PUBLICATION_NOT_PUBLISHED_REASONS,
  ...PUBLICATION_SUPERSEDED_REASONS,
  ...PUBLICATION_WITHDRAWN_REASONS,
] as const
export type PublicationOutcomeReason = (typeof PUBLICATION_OUTCOME_REASONS)[number]

export const isPublicationOutcomeReason = (reason: unknown): reason is PublicationOutcomeReason =>
  typeof reason === 'string' && (PUBLICATION_OUTCOME_REASONS as readonly string[]).includes(reason)

/**
 * What the author can do next: submit the same version again (while the
 * approval lasts it publishes straight away), submit a new version for a new
 * review, or nothing here (appeal, or ask the account owner).
 */
export type PublicationResubmitKind = 'same_version' | 'new_version' | 'none'

export interface PublicationReasonCopy {
  /** What happened, in a sentence or two for the author. */
  author: string
  /** For staff, completing "Not published: …" and "Approved, but not published: …". Starts lowercase, no full stop. */
  staff: string
  resubmit: PublicationResubmitKind
}

const SUPPORT = 'support@ujimora.com'

const REASONS: Readonly<Record<PublicationOutcomeReason, PublicationReasonCopy>> = {
  account_unavailable: {
    author: 'The account that submitted it is closed or no longer available.',
    staff: "the author's account is closed or unavailable",
    resubmit: 'none',
  },
  credentials_changed: {
    author: 'Your sign-in details changed since you submitted it (a password or two-step verification change).',
    staff: "the author's password or two-step verification changed after they submitted it",
    resubmit: 'same_version',
  },
  restricted: {
    author: `Publishing is restricted on this account. Contact ${SUPPORT} to appeal.`,
    staff: 'publishing is restricted for the author',
    resubmit: 'none',
  },
  // The author's own account is fine: the organization they publish for, or
  // the campaign's organizer (for a teammate or a beneficiary), is restricted.
  organizer_restricted: {
    author: `Publishing is restricted for the organization or campaign organizer you publish for. They can contact ${SUPPORT} to appeal.`,
    staff: 'publishing is restricted for the organization or campaign organizer the author publishes for',
    resubmit: 'none',
  },
  terms_not_accepted: {
    author: 'You need to accept the current account agreement before it can be published.',
    staff: "the author hasn't accepted the current account agreement",
    resubmit: 'same_version',
  },
  organization_terms_not_accepted: {
    author: 'The organization needs to accept the current account agreement before it can be published.',
    staff: "the organization hasn't accepted the current account agreement",
    resubmit: 'same_version',
  },
  permission_changed: {
    author: "You no longer have permission to make this change. Ask the account's owner if it's still needed.",
    staff: 'the author no longer has permission to make this change',
    resubmit: 'none',
  },
  item_unavailable: {
    author: 'What it was for is no longer available, for example a campaign that was closed or removed.',
    staff: 'the campaign or item it was for is no longer available',
    resubmit: 'none',
  },
  identity_changed: {
    author: 'Your public name or photo changed after you submitted it.',
    staff: "the author's public name or photo changed after they submitted it",
    resubmit: 'new_version',
  },
  blocked: {
    author: 'You can no longer post on this campaign.',
    staff: 'the author and the campaign owner have a block between them',
    resubmit: 'none',
  },
  plan_ineligible: {
    author: 'Your plan no longer includes a creator page.',
    staff: "the author's plan no longer includes a creator page",
    resubmit: 'same_version',
  },
  handle_taken: {
    author: 'Someone else has that handle now.',
    staff: 'another creator has the handle now',
    resubmit: 'new_version',
  },
  address_taken: {
    author: 'That web address is now taken or reserved.',
    staff: 'the web address is taken or reserved now',
    resubmit: 'new_version',
  },
  thank_you_disabled: {
    author: 'Thank-you messages are turned off right now.',
    staff: 'thank-you messages are turned off',
    resubmit: 'none',
  },
  thank_you_limit_reached: {
    author: 'This campaign has already sent the most thank-you messages allowed.',
    staff: 'the campaign has reached its thank-you message limit',
    resubmit: 'none',
  },
  thank_you_no_donors: {
    author: 'The campaign has no donors to email yet.',
    staff: 'the campaign has no donors to email',
    resubmit: 'same_version',
  },
  thank_you_not_eligible: {
    author: "This campaign can't send thank-you messages right now.",
    staff: "the campaign can't send thank-you messages",
    resubmit: 'none',
  },
  campaign_unavailable: {
    author: 'The campaign is closed or no longer available.',
    staff: 'the campaign is closed or unavailable',
    resubmit: 'none',
  },
  approval_expired: {
    author: 'The approval ran out before it could be published.',
    staff: 'the approval expired before it could be published',
    resubmit: 'new_version',
  },
  unreadable: {
    author: "We couldn't read the saved version.",
    staff: "the saved version couldn't be read",
    resubmit: 'new_version',
  },
  unavailable: {
    author: 'Something went wrong on our side while publishing it.',
    staff: 'publishing kept failing for a technical reason',
    resubmit: 'same_version',
  },
  edited_since_submitted: {
    author: "It changed after you submitted it, so this version wasn't published.",
    staff: 'the author changed it after submitting',
    resubmit: 'new_version',
  },
  newer_version_submitted: {
    author: 'You (or your team) submitted a newer version.',
    staff: 'a newer version replaced it',
    resubmit: 'none',
  },
  withdrawn_by_author: {
    author: "You withdrew it. It won't be published.",
    staff: 'the author withdrew it',
    resubmit: 'none',
  },
}

const UNKNOWN_REASON: PublicationReasonCopy = {
  author: "It couldn't be published.",
  staff: 'it could not be published',
  resubmit: 'new_version',
}

/** The words for an outcome reason; an unknown or missing reason reads as a generic failure. */
export function publicationReasonCopy(reason: unknown): PublicationReasonCopy {
  return isPublicationOutcomeReason(reason) ? REASONS[reason] : UNKNOWN_REASON
}

interface ActionWords {
  /** As in "Your {noun} is live". */
  noun: string
  plural?: boolean
  /** The form's own word for sending the same version again. */
  verb: 'post' | 'save' | 'send' | 'start' | 'submit'
  /** Once it is published. */
  published: string
  /**
   * After a manual approval (live sessions, and versions submitted before
   * publishing on approval), what the author does, around the deadline:
   * "{lead} before {deadline}{tail}."
   */
  approved?: { lead: string; tail: string }
}

const WORDS_BY_ACTION: Readonly<Record<string, ActionWords>> = {
  'account.profile': { noun: 'profile', verb: 'save', published: 'Approved and now on your public profile.' },
  'creator.profile': { noun: 'creator page', verb: 'save', published: 'Approved and now on your creator page.' },
  'organization.profile': {
    noun: 'organization details',
    plural: true,
    verb: 'save',
    published: "Approved and now on the organization's public page.",
  },
  'comment.create': { noun: 'comment', verb: 'post', published: 'Approved and posted on the campaign.' },
  'update.create': { noun: 'campaign update', verb: 'post', published: 'Approved and posted on the campaign.' },
  'update.edit': { noun: 'edited campaign update', verb: 'save', published: 'Approved; the campaign update now shows your changes.' },
  'thank_you.send': {
    noun: 'thank-you message',
    verb: 'send',
    published: "Approved; we're emailing your donors and will send you a delivery summary.",
  },
  'campaign.slug': {
    noun: 'campaign link',
    verb: 'save',
    published: 'Approved; the campaign now uses its new web address. Existing links keep working.',
  },
  'live.start': {
    noun: 'live session title',
    verb: 'start',
    published: 'Approved.',
    approved: { lead: 'Start the session again with the same title and goal', tail: '' },
  },
  'campaign.create': { noun: 'campaign', verb: 'submit', published: 'Approved.' },
}
/** A Map, so an action named like an Object.prototype key can never match. */
const ACTION_WORDS: ReadonlyMap<string, ActionWords> = new Map(Object.entries(WORDS_BY_ACTION))

const GENERIC_WORDS: ActionWords = { noun: 'change', verb: 'submit', published: 'Approved and published.' }

const wordsFor = (action: unknown): ActionWords => (typeof action === 'string' && ACTION_WORDS.get(action)) || GENERIC_WORDS

const capitalize = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value)

/**
 * The author's next step for a resubmit kind, in the form's own words.
 * `deadline`: the formatted end of the approval window, while it lasts.
 */
export function publicationNextStep(action: unknown, resubmit: PublicationResubmitKind, deadline?: string): string {
  const verb = capitalize(wordsFor(action).verb)
  switch (resubmit) {
    case 'same_version':
      return deadline ? `${verb} it again before ${deadline} to publish it straight away.` : `${verb} it again to publish it.`
    case 'new_version':
      return 'Submit your latest version if it still needs review.'
    default:
      return ''
  }
}

/** Notice titles and bodies cover these, plus the decision itself. */
export type PublicationNoticeState = PublicationOutcomeState | 'declined' | 'approved'

export interface PublicationOutcomeCopyInput {
  action: string
  state: PublicationNoticeState | string
  reason?: string
  /** The formatted end of the approval window, while it lasts. */
  deadline?: string
}

export interface PublicationOutcomeCopy {
  /** Title of the author's in-app notice. */
  title: string
  /** What happened and what to do next, for the author. */
  body: string
  /** One line for staff, e.g. a decided card's status line. */
  staff: string
  resubmit: PublicationResubmitKind
}

/**
 * The words for where an approved (or declined) version ended up: the
 * author's notice title and body, and the staff line. Reasons only apply to
 * `not_published` and `superseded`; `withdrawn` is always the author's own.
 */
export function publicationOutcomeCopy(input: PublicationOutcomeCopyInput): PublicationOutcomeCopy {
  const words = wordsFor(input.action)
  const your = `Your ${words.noun}`
  const be = (singular: string, plural: string) => (words.plural ? plural : singular)
  const join = (...parts: string[]) => parts.filter(Boolean).join(' ')
  switch (input.state) {
    case 'published':
      return {
        title: input.action === 'thank_you.send' ? `${your} ${be('was', 'were')} approved` : `${your} ${be('is', 'are')} live`,
        body: words.published,
        staff: 'Published',
        resubmit: 'none',
      }
    case 'publishing':
      return { title: `${your} ${be('is', 'are')} being published`, body: 'Approved. Publishing now.', staff: 'Publishing', resubmit: 'none' }
    case 'superseded': {
      const edited = input.reason === 'edited_since_submitted'
      const reason = edited ? REASONS.edited_since_submitted : REASONS.newer_version_submitted
      return {
        title: `Your earlier ${words.noun} ${be("wasn't", "weren't")} published`,
        body: join(reason.author, publicationNextStep(input.action, reason.resubmit, input.deadline)),
        staff: edited ? `Not published: ${reason.staff}` : 'Replaced by a newer version',
        resubmit: reason.resubmit,
      }
    }
    case 'withdrawn':
      return {
        title: `${your} ${be('was', 'were')} withdrawn`,
        body: REASONS.withdrawn_by_author.author,
        staff: 'Withdrawn by the author',
        resubmit: 'none',
      }
    case 'declined':
      return {
        title: `${your} ${be("wasn't", "weren't")} approved`,
        body: "Read the reviewer's note in Publication reviews.",
        staff: 'Declined',
        resubmit: 'new_version',
      }
    case 'approved': {
      const { lead, tail } = words.approved ?? { lead: `${capitalize(words.verb)} it again unchanged`, tail: ' to publish it' }
      return {
        title: `${your} ${be('was', 'were')} approved`,
        body: `Approved. ${lead}${input.deadline ? ` before ${input.deadline}` : ''}${tail}.`,
        staff: 'Approved; the author publishes it by submitting it again',
        resubmit: 'same_version',
      }
    }
    default: {
      // not_published, and any state this version does not know yet.
      const reason = publicationReasonCopy(input.reason)
      return {
        title: `${your} ${be("wasn't", "weren't")} published`,
        body: join(reason.author, publicationNextStep(input.action, reason.resubmit, input.deadline)),
        staff: `Not published: ${reason.staff}`,
        resubmit: reason.resubmit,
      }
    }
  }
}

/**
 * Whether the author may still withdraw this version: waiting for a decision,
 * or approved and not yet published. Only versions an approval publishes by
 * itself can be withdrawn; others never publish without the author.
 */
export function canWithdrawPublication(review: { action: unknown; status: unknown; publishState?: unknown }): boolean {
  if (!isAutoPublishAction(review.action)) return false
  if (review.status === 'pending') return true
  return review.status === 'approved' && (OPEN_PUBLISH_STATES as readonly unknown[]).includes(review.publishState)
}
