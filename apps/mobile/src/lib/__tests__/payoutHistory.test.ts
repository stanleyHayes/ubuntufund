import { describe, expect, it } from 'vitest'
import { payoutHistoryState } from '../payoutHistory'

const closedAt = new Date('2026-09-20T10:00:00Z')

describe('payout history state', () => {
  it('shows a rejected request as rejected, with the admin reason, never as a failed transfer', () => {
    const state = payoutHistoryState({
      status: 'FAILED',
      closure: { kind: 'rejected', reason: 'Supporting invoices do not match the stated beneficiary.', closedBy: 'admin', closedAt },
    })
    expect(state.label).toBe('Rejected')
    expect(state.detail).toContain('Supporting invoices do not match the stated beneficiary.')
    expect(state.detail).toContain('Nothing was sent')
    expect(state.tone).toBe('warning')
    expect(state.amountCaption).toBe('REQUESTED NET AMOUNT (NOT SENT)')
  })

  it('shows a cancelled request as cancelled', () => {
    const state = payoutHistoryState({ status: 'FAILED', closure: { kind: 'cancelled', reason: 'Cancelled by the campaign owner.', closedBy: 'owner', closedAt } })
    expect(state.label).toBe('Cancelled')
    expect(state.detail).toMatch(/^You cancelled this request\. Nothing was sent/)
  })

  it('keeps the transfer states for payouts that were not closed', () => {
    expect(payoutHistoryState({ status: 'PAID' })).toMatchObject({ label: 'Completed', tone: 'success', amountCaption: 'AMOUNT RECEIVED' })
    expect(payoutHistoryState({ status: 'PROCESSING', providerStatus: 'otp' }).label).toBe('Awaiting authorization')
    const failed = payoutHistoryState({ status: 'FAILED' })
    expect(failed.label).toBe('failed')
    expect(failed.detail).toBeUndefined()
    expect(payoutHistoryState({ status: 'NEEDS_REVIEW' }).label).toBe('needs review')
  })
})
