import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
import type { DonorThankYouBlockReason, DonorThankYouView } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import {
  canDraftThankYou,
  canRetryDeliveries,
  cleanThankYou,
  deliveryProgress,
  deliverySummary,
  keepPollingAfter,
  sendAttempt,
  sendOutcomeUnknown,
  shouldPoll,
  thankYouApi,
  thankYouBlockMessage,
  thankYouProblem,
} from '../donorThankYou'

const message = { subject: 'Thank you', body: 'The clinic roof is fixed.', signature: 'Ama' }
const view = (fields: Partial<DonorThankYouView>): DonorThankYouView => ({
  id: 't1', campaignId: 'c1', status: 'sent', authorRole: 'manager', ...message,
  recipientCount: 0, sentCount: 0, failedCount: 0, skippedCount: 0, retryableCount: 0, updatedAt: '2026-09-29T10:00:00.000Z', ...fields,
})
const failure = (status?: number) => Object.assign(new Error('failed'), status === undefined ? {} : { status })

beforeEach(() => { vi.clearAllMocks() })

describe('why a thank-you cannot be sent yet', () => {
  it.each<[DonorThankYouBlockReason, RegExp]>([
    ['disabled', /turned off/],
    ['not_ended', /once the campaign has ended or a payout has been paid.*write and save/],
    ['campaign_unavailable', /under review/],
    ['no_donors', /no donors/],
    ['limit_reached', /already sent its thank-you/],
    ['email_unavailable', /temporarily unavailable/],
    ['not_authorized', /organizers or its beneficiary/],
  ])('explains %s in plain words', (reason, text) => {
    expect(thankYouBlockMessage(reason)).toMatch(text)
  })

  it('counts every allowed message once a campaign may send several, and never shows a raw code', () => {
    expect(thankYouBlockMessage('limit_reached', 3)).toBe('This campaign has sent all 3 of its thank-you messages.')
    expect(thankYouBlockMessage(undefined)).toBe('Thank-you messages are not available for this campaign right now.')
    expect(thankYouBlockMessage('something_new' as DonorThankYouBlockReason)).not.toContain('something_new')
  })

  it('lets authors write ahead only while the lock is temporary', () => {
    expect(canDraftThankYou({ eligible: true })).toBe(true)
    for (const reason of ['not_ended', 'no_donors', 'email_unavailable'] as const) expect(canDraftThankYou({ eligible: false, reason })).toBe(true)
    for (const reason of ['disabled', 'limit_reached', 'campaign_unavailable'] as const) expect(canDraftThankYou({ eligible: false, reason })).toBe(false)
  })
})

describe('message limits', () => {
  it('folds the subject and signature to one line as the API stores them', () => {
    expect(cleanThankYou({ subject: ' Thank\r\nyou   all ', body: '  Line one\r\nLine two  ', signature: 'Ama\nand team' }))
      .toEqual({ subject: 'Thank you all', body: 'Line one\nLine two', signature: 'Ama and team' })
  })

  it('reports the first field outside the API limits', () => {
    expect(thankYouProblem(message)).toBeNull()
    expect(thankYouProblem({ ...message, subject: 'Hi ' })).toMatch(/subject of at least 3/)
    expect(thankYouProblem({ ...message, subject: 'x'.repeat(121) })).toMatch(/subject to 120/)
    expect(thankYouProblem({ ...message, body: 'Thanks!   ' })).toMatch(/message of at least 10/)
    expect(thankYouProblem({ ...message, body: 'x'.repeat(5001) })).toBe('Keep the message to 5,000 characters.')
    expect(thankYouProblem({ ...message, signature: 'x'.repeat(121) })).toMatch(/signature to 120/)
    expect(thankYouProblem({ ...message, signature: '' })).toBeNull()
  })
})

describe('Idempotency-Key per send tap', () => {
  it('reuses the key when the same message is sent again after an unanswered tap', () => {
    const first = sendAttempt(null, message)
    expect(first.key).toMatch(/^[a-zA-Z0-9_-]{16,100}$/)
    expect(sendAttempt(first, message)).toBe(first)
    // Spacing the API folds away is still the same message.
    expect(sendAttempt(first, { ...message, subject: ' Thank  you ' }).key).toBe(first.key)
  })

  it('starts a new key for a changed message or a fresh action', () => {
    const first = sendAttempt(null, message)
    expect(sendAttempt(first, { ...message, body: 'A different thank-you message.' }).key).not.toBe(first.key)
    expect(sendAttempt(null, message).key).not.toBe(first.key)
  })

  it('keeps the attempt only when the server may already have queued it', () => {
    for (const status of [0, 500, 502, 503]) expect(sendOutcomeUnknown(failure(status))).toBe(true)
    expect(sendOutcomeUnknown(failure())).toBe(true)
    for (const status of [400, 404, 409, 422, 429]) expect(sendOutcomeUnknown(failure(status))).toBe(false)
  })
})

describe('delivery progress polling', () => {
  it('polls only while queued or sending and only in the foreground', () => {
    expect(shouldPoll(view({ status: 'queued' }), 'active')).toBe(true)
    expect(shouldPoll(view({ status: 'sending' }), 'active')).toBe(true)
    expect(shouldPoll(view({ status: 'sending' }), 'background')).toBe(false)
    expect(shouldPoll(view({ status: 'sending' }), 'inactive')).toBe(false)
    for (const status of ['sent', 'partially_sent', 'failed', 'draft'] as const) expect(shouldPoll(view({ status }), 'active')).toBe(false)
    expect(shouldPoll(undefined, 'active')).toBe(false)
  })

  it('keeps polling through connection and server errors but stops when access is refused', () => {
    for (const status of [0, 408, 429, 500, 503]) expect(keepPollingAfter(failure(status))).toBe(true)
    expect(keepPollingAfter(failure())).toBe(true)
    for (const status of [401, 403, 404]) expect(keepPollingAfter(failure(status))).toBe(false)
  })
})

describe('delivery summary', () => {
  it('describes each stage with counts only', () => {
    expect(deliverySummary(view({ status: 'queued' }))).toEqual(['Preparing the list of donors…'])
    expect(deliverySummary(view({ status: 'sending', recipientCount: 0 }))).toEqual(['Preparing the list of donors…'])
    expect(deliverySummary(view({ status: 'sending', recipientCount: 12, sentCount: 5 }))).toEqual(['Delivered to 5 of 12 donors so far.'])
    expect(deliverySummary(view({ status: 'sent', recipientCount: 1, sentCount: 1 }))).toEqual(['Delivered to 1 of 1 donor.'])
    expect(deliverySummary(view({ status: 'sent', recipientCount: 0 }))).toEqual(['No donors were left to email when it was sent.'])
    expect(deliverySummary(view({ status: 'partially_sent', recipientCount: 10, sentCount: 6, skippedCount: 1, failedCount: 3, retryableCount: 2 }))).toEqual([
      'Delivered to 6 of 10 donors.',
      '1 donor skipped: unsubscribed, refunded or without an email address.',
      '3 could not be delivered; 2 can be retried.',
    ])
  })

  it('offers a retry only for finished messages with retryable failures', () => {
    expect(canRetryDeliveries(view({ status: 'partially_sent', retryableCount: 2 }))).toBe(true)
    expect(canRetryDeliveries(view({ status: 'failed', retryableCount: 1 }))).toBe(true)
    expect(canRetryDeliveries(view({ status: 'failed', retryableCount: 0 }))).toBe(false)
    expect(canRetryDeliveries(view({ status: 'sending', retryableCount: 2 }))).toBe(false)
  })

  it('measures progress by final outcomes', () => {
    expect(deliveryProgress(view({ status: 'sending', recipientCount: 10, sentCount: 4, failedCount: 1, skippedCount: 1 }))).toBeCloseTo(0.6)
    expect(deliveryProgress(view({ status: 'queued' }))).toBe(0)
  })
})

describe('thank-you API calls', () => {
  it('sends with the Idempotency-Key header and the review consent', async () => {
    vi.mocked(api.post).mockResolvedValue(view({ status: 'queued' }))
    await thankYouApi.send('c1', 'key-0123456789abcdef', true)
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/thank-you/send', { automatedReviewConsent: true }, { 'Idempotency-Key': 'key-0123456789abcdef' })
  })

  it('saves and previews the cleaned message and polls one message by id', async () => {
    await thankYouApi.saveDraft('c1', { ...message, subject: 'Thank\nyou' })
    expect(api.put).toHaveBeenCalledWith('/campaigns/c1/thank-you/draft', { ...message, subject: 'Thank you' })
    await thankYouApi.preview('c1', message)
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/thank-you/preview', message)
    await thankYouApi.summary('c1', 't/1')
    expect(api.get).toHaveBeenCalledWith('/campaigns/c1/thank-you/t%2F1')
    await thankYouApi.retry('c1', 't1')
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/thank-you/t1/retry')
    await thankYouApi.discardDraft('c1')
    expect(api.delete).toHaveBeenCalledWith('/campaigns/c1/thank-you/draft')
  })
})
