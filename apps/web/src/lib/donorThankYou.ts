import {
  DONOR_THANK_YOU_LIMITS,
  type DonorThankYouBlockReason,
  type DonorThankYouContent,
  type DonorThankYouStatus,
} from '@ubuntu-fund/types'
import type { ChipTone } from './onBehalf'

/** Why a campaign cannot send its thank-you yet, in plain words. */
export function thankYouBlockText(reason: DonorThankYouBlockReason | undefined, sendsAllowed: number): string {
  switch (reason) {
    case 'disabled': return 'Thank-you messages are turned off on Ujimora right now. Please check back later.'
    case 'not_authorized': return 'Only the campaign organizer or its beneficiary can thank donors.'
    case 'not_ended': return 'You can thank donors once the campaign has ended or a payout has been paid. Come back then to write your message.'
    case 'campaign_unavailable': return 'This campaign is under review, so messages to donors are paused.'
    case 'no_donors': return 'This campaign has no donors to thank yet.'
    case 'limit_reached': return sendsAllowed > 1
      ? `This campaign has sent all ${sendsAllowed} of its thank-you messages.`
      : 'This campaign has already sent its thank-you message.'
    case 'email_unavailable': return 'Email delivery is temporarily unavailable. Please try again later.'
    default: return 'You cannot send a thank-you for this campaign right now.'
  }
}

export const THANK_YOU_STATUS: Record<DonorThankYouStatus, { label: string; tone: ChipTone }> = {
  draft: { label: 'Draft', tone: 'default' },
  queued: { label: 'Queued', tone: 'info' },
  sending: { label: 'Sending', tone: 'info' },
  sent: { label: 'Sent', tone: 'success' },
  partially_sent: { label: 'Partly sent', tone: 'warning' },
  failed: { label: 'Not delivered', tone: 'error' },
}

export const isDelivering = (status: DonorThankYouStatus | undefined) => status === 'queued' || status === 'sending'

export const EMPTY_THANK_YOU: DonorThankYouContent = { subject: '', body: '', signature: '' }

/** What the API stores: a one-line subject and signature, a trimmed body. */
export function normalizeThankYou(content: DonorThankYouContent): DonorThankYouContent {
  return {
    subject: content.subject.replace(/\s+/g, ' ').trim(),
    body: content.body.trim(),
    signature: content.signature.replace(/\s+/g, ' ').trim(),
  }
}

export function validateThankYou(content: DonorThankYouContent): Partial<Record<keyof DonorThankYouContent, string>> {
  const { subject, body, signature } = normalizeThankYou(content)
  const errors: Partial<Record<keyof DonorThankYouContent, string>> = {}
  if (subject.length < 3) errors.subject = 'Use at least 3 characters'
  else if (subject.length > DONOR_THANK_YOU_LIMITS.subject) errors.subject = `Use at most ${DONOR_THANK_YOU_LIMITS.subject} characters`
  if (body.length < 10) errors.body = 'Use at least 10 characters'
  else if (body.length > DONOR_THANK_YOU_LIMITS.body) errors.body = `Use at most ${DONOR_THANK_YOU_LIMITS.body} characters`
  if (signature.length > DONOR_THANK_YOU_LIMITS.signature) errors.signature = `Use at most ${DONOR_THANK_YOU_LIMITS.signature} characters`
  return errors
}

export const sameThankYou = (a: DonorThankYouContent, b: DonorThankYouContent) =>
  a.subject === b.subject && a.body === b.body && a.signature === b.signature
