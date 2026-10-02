import { randomUUID } from 'expo-crypto'
import {
  DONOR_THANK_YOU_LIMITS,
  parsePublicationReviewPage,
  waitingThankYou,
  type DonorThankYouBlockReason,
  type DonorThankYouContent,
  type DonorThankYouPreview,
  type DonorThankYouState,
  type DonorThankYouStatus,
  type DonorThankYouView,
} from '@ubuntu-fund/types'
import { api } from './api'

const count = new Intl.NumberFormat('en')
export const donors = (n: number) => `${count.format(n)} donor${n === 1 ? '' : 's'}`

const REASONS: Record<DonorThankYouBlockReason, string> = {
  disabled: 'Thank-you messages are turned off right now.',
  not_authorized: 'Only the campaign’s organizers or its beneficiary can thank donors.',
  not_ended: 'You can thank donors once the campaign has ended or a payout has been paid. You can write and save your message now.',
  campaign_unavailable: 'This campaign is under review, so messages to donors are paused.',
  no_donors: 'This campaign has no donors to thank yet.',
  limit_reached: 'This campaign has already sent its thank-you message.',
  email_unavailable: 'Email delivery is temporarily unavailable. Save your message and try again later.',
}

/** Why sending is locked, in plain words. */
export function thankYouBlockMessage(reason: DonorThankYouBlockReason | undefined, sendsAllowed = 1): string {
  if (reason === 'limit_reached' && sendsAllowed > 1) return `This campaign has sent all ${sendsAllowed} of its thank-you messages.`
  return (reason && REASONS[reason]) || 'Thank-you messages are not available for this campaign right now.'
}

/** Writing ahead is allowed while the lock is temporary; the API only checks eligibility when sending. */
export function canDraftThankYou(state: Pick<DonorThankYouState, 'eligible' | 'reason'>): boolean {
  return state.eligible || state.reason === 'not_ended' || state.reason === 'no_donors' || state.reason === 'email_unavailable'
}

const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

/** What the API will store: a one-line subject and signature, trimmed text. */
export function cleanThankYou(content: DonorThankYouContent): DonorThankYouContent {
  return { subject: oneLine(content.subject), body: content.body.replace(/\r\n?/g, '\n').trim(), signature: oneLine(content.signature) }
}

export const thankYouSignature = (content: DonorThankYouContent) => JSON.stringify(cleanThankYou(content))

/** The first problem with the message, or null when the API will accept it. */
export function thankYouProblem(content: DonorThankYouContent): string | null {
  const { subject, body, signature } = cleanThankYou(content)
  const { subject: maxSubject, body: maxBody, signature: maxSignature } = DONOR_THANK_YOU_LIMITS
  if (subject.length < 3) return 'Write a subject of at least 3 characters.'
  if (subject.length > maxSubject) return `Keep the subject to ${maxSubject} characters.`
  if (body.length < 10) return 'Write a message of at least 10 characters.'
  if (body.length > maxBody) return `Keep the message to ${count.format(maxBody)} characters.`
  if (signature.length > maxSignature) return `Keep the signature to ${maxSignature} characters.`
  return null
}

export interface SendAttempt { content: string; key: string }

/**
 * One Idempotency-Key per Send tap. A tap whose outcome is unknown stays
 * pending, so tapping Send again for the same message retries it under the
 * same key: the API returns the message it may already have queued instead
 * of refusing a second send. A changed message is a new action.
 */
export function sendAttempt(pending: SendAttempt | null, content: DonorThankYouContent, newKey: () => string = randomUUID): SendAttempt {
  const signature = thankYouSignature(content)
  return pending?.content === signature ? pending : { content: signature, key: newKey() }
}

const statusOf = (error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : undefined
}

/** No answer, a timeout or a server error: the send may have been queued, so keep its key. */
export function sendOutcomeUnknown(error: unknown): boolean {
  const status = statusOf(error)
  return status === undefined || status === 0 || status >= 500
}

export const THANK_YOU_POLL_MS = 4_000

export const isDelivering = (status: DonorThankYouStatus) => status === 'queued' || status === 'sending'

/** Poll only while delivery is in progress and the app is in the foreground. */
export function shouldPoll(view: Pick<DonorThankYouView, 'status'> | null | undefined, appState: string | null | undefined): boolean {
  return !!view && isDelivering(view.status) && appState === 'active'
}

/** A lost connection or server hiccup is retried on the next tick; a refusal (lost access, message gone) stops polling. */
export function keepPollingAfter(error: unknown): boolean {
  const status = statusOf(error)
  return status === undefined || status === 0 || status === 408 || status === 429 || status >= 500
}

export const THANK_YOU_STATUS_LABELS: Record<DonorThankYouStatus, string> = {
  draft: 'Draft',
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  partially_sent: 'Partly delivered',
  failed: 'Not delivered',
}

export const canRetryDeliveries = (view: Pick<DonorThankYouView, 'status' | 'retryableCount'>) =>
  view.retryableCount > 0 && (view.status === 'partially_sent' || view.status === 'failed')

type Counts = Pick<DonorThankYouView, 'status' | 'recipientCount' | 'sentCount' | 'failedCount' | 'skippedCount' | 'retryableCount'>

/**
 * Counts only: authors never see who received the message. While sending,
 * failures are not final (they are retried automatically), so only progress
 * is shown.
 */
export function deliverySummary(view: Counts): string[] {
  if (view.status === 'queued' || (view.status === 'sending' && !view.recipientCount)) return ['Preparing the list of donors…']
  if (view.status === 'sending') return [`Delivered to ${view.sentCount} of ${donors(view.recipientCount)} so far.`]
  if (!view.recipientCount) return ['No donors were left to email when it was sent.']
  const lines = [`Delivered to ${view.sentCount} of ${donors(view.recipientCount)}.`]
  if (view.skippedCount) lines.push(`${donors(view.skippedCount)} skipped: unsubscribed, refunded or without an email address.`)
  if (view.failedCount) lines.push(`${count.format(view.failedCount)} could not be delivered${view.retryableCount ? `; ${count.format(view.retryableCount)} can be retried` : ''}.`)
  return lines
}

/** Share of recipients with a final outcome, for the progress bar. */
export function deliveryProgress(view: Counts): number {
  return view.recipientCount ? Math.min(1, (view.sentCount + view.failedCount + view.skippedCount) / view.recipientCount) : 0
}

export function sendConfirmPrompt(estimatedRecipients: number) {
  return {
    title: 'Send your thank-you?',
    message: `Ujimora will email this message to about ${donors(estimatedRecipients)}. A sent message cannot be changed or recalled.`,
    confirmLabel: 'Send to donors',
  }
}

const base = (campaignId: string) => `/campaigns/${encodeURIComponent(campaignId)}/thank-you`

/** The author's latest submissions (the list API's largest page), where a message waiting for review is found. */
const REVIEWS_PAGE = '/publication-reviews?page=1&pageSize=100'

export const thankYouApi = {
  state: (campaignId: string) => api.get<DonorThankYouState>(base(campaignId)),
  /**
   * The author's message for this campaign that its approval is still to send
   * by itself, as its signature (thankYouSignature); null when none is
   * waiting, or the list can't be read (best effort: only a warning depends on it).
   */
  waitingForReview: async (campaignId: string): Promise<string | null> => {
    try {
      const page = parsePublicationReviewPage(await api.get<unknown>(REVIEWS_PAGE))
      const waiting = page ? waitingThankYou(page.items, campaignId) : null
      return waiting ? thankYouSignature(waiting) : null
    } catch { return null }
  },
  saveDraft: (campaignId: string, content: DonorThankYouContent) => api.put<DonorThankYouView>(`${base(campaignId)}/draft`, cleanThankYou(content)),
  discardDraft: (campaignId: string) => api.delete<null>(`${base(campaignId)}/draft`),
  preview: (campaignId: string, content: DonorThankYouContent) => api.post<DonorThankYouPreview>(`${base(campaignId)}/preview`, cleanThankYou(content)),
  send: (campaignId: string, idempotencyKey: string, automatedReviewConsent: boolean) =>
    api.post<DonorThankYouView>(`${base(campaignId)}/send`, { automatedReviewConsent }, { 'Idempotency-Key': idempotencyKey }),
  summary: (campaignId: string, thankYouId: string) => api.get<DonorThankYouView>(`${base(campaignId)}/${encodeURIComponent(thankYouId)}`),
  retry: (campaignId: string, thankYouId: string) => api.post<{ requeued: number }>(`${base(campaignId)}/${encodeURIComponent(thankYouId)}/retry`),
}
