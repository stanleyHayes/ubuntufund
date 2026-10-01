import { formatMoney } from '@/lib/money'
import { approvalDeadline, approvalValidUntil, goalAboveLimit, type ParsedSubmission, type PublicationReviewItem, type ReviewQueue } from '@/lib/publicationReview'
import { formatDateTime } from '@/lib/reviewDates'

/*
 * Reviewer guidance: every sentence that tells a reviewer what approving or
 * declining does, keyed by action. The review cards only display what this
 * module returns, so a change in behaviour is a change here (and in its tests).
 *
 * It describes today's behaviour:
 * - a decision publishes nothing by itself. Approval unlocks one exact version
 *   for its author, who must submit that same version again within seven days
 *   of approval (sooner if the review record is deleted first);
 * - a campaign proposal is not a campaign yet: the campaign is only created when
 *   the creator submits again, and it may then wait for a separate campaign review;
 * - supporter and donor names and messages are the exception: approval lets them
 *   show publicly straight away.
 */

export const PAGE_INTRO: Record<ReviewQueue, string> = {
  publication: 'Check every field and every image, then approve or decline this exact version. Approval publishes nothing by itself: the author must submit the same version again within 7 days of approval, or sooner if the proposal is deleted first (each card gives the date). Any change needs a new review. Review notes are visible to the author.',
  content: 'Review the exact public name and message. Approval makes this text eligible for public display straight away. The payment has already settled; decisions do not change funds. Anonymous names remain hidden.',
}

/** campaign.slug, when the campaign's address changed after the proposal. */
export const SLUG_CHANGED = 'The address changed after this was proposed, so this approval can’t be used; the owner would have to propose it again.'

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
  /** Pending items: what approving does. With a title it is shown as an alert, otherwise as one sentence. */
  approval: { title?: string; lead: string; bullets?: string[] }
  /** Approved items whose approval can still be used. */
  approvedHint?: string
  /** Shown on the page once a decision is saved. */
  confirmation: { approved: Phrase; rejected: Phrase }
  /** The "Submitted text" disclosure: what a decision is bound to. */
  boundTo: string
}

const ANY_CHANGE = ' Any change needs a new review.'
const DECLINED: Phrase = ['Declined. The author will see your notes in their Publication reviews list.']

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

/** "by 8 Oct 2026, 10:00" when the record's deletion date is known, otherwise "within 7 days". */
function deadline(context: GuidanceContext): { by: string; until: string; known: boolean } {
  const when = context.purgeAt ? formatDateTime(approvalDeadline(context.now, context.purgeAt)) : null
  return when ? { by: `by ${when}`, until: `until ${when}`, known: true } : { by: 'within 7 days', until: 'within the next 7 days', known: false }
}

/** All reviewer guidance for one item. */
export function reviewGuidance(action: string, context: GuidanceContext): ReviewGuidance {
  if (context.queue === 'content') {
    // The API shows a hidden name and message as they would appear publicly, while the version covers what is stored.
    const owner = action === 'donation.public_content' ? 'donor' : 'supporter'
    return {
      approval: { lead: 'Approval makes this name and message eligible for public display straight away. Declining keeps them hidden; the payment is not affected.' },
      confirmation: { approved: ['Approved. This name and message can now be shown publicly.'], rejected: ['Declined. This name and message stay hidden.'] },
      boundTo: `As it would appear publicly: an anonymous ${owner}’s name shows as “Anonymous” and a hidden message as empty. A decision applies to this content version only; a changed name or message needs a new review.`,
    }
  }
  const { by, until, known } = deadline(context)
  const boundTo = 'Exactly as submitted. Approval is bound to this author, action, resource, base version, text and media list.'
  if (action === 'campaign.create') {
    const limit = context.campaignReviewGoalGhs
    const limitText = limit !== undefined ? formatMoney(limit, 'GHS') : 'a set limit'
    const aboveLimit = !!context.goal && goalAboveLimit(context.goal.amount, context.goal.currency, limit)
    const validUntil = formatDateTime(context.validUntil)
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
          ` Nothing is published yet: the creator must submit this exact version again ${by}. Only then does the campaign appear under Campaigns${aboveLimit ? `, where it may also wait for a campaign review because its goal is above ${limitText}` : ''}.`,
        ],
        rejected: DECLINED,
      },
      boundTo,
    }
  }
  const after = AFTER_APPROVAL[action]
  return {
    approval: { lead: after ? `${after(by)}${ANY_CHANGE}` : `Approval lets the author publish only this exact version, ${by}.${ANY_CHANGE}` },
    confirmation: { approved: [`Approved. The author can publish this exact version ${until}.`], rejected: DECLINED },
    boundTo,
  }
}

/** The guidance for a loaded review item, at `now`. */
export function guidanceFor(item: PublicationReviewItem, parsed: ParsedSubmission, options: { queue: ReviewQueue; now: number; campaignReviewGoalGhs?: number }): ReviewGuidance {
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
  })
}
