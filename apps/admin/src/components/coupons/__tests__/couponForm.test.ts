import { describe, expect, it } from 'vitest'
import { CouponDiscountType, CouponSurface } from '@ubuntu-fund/types'
import { createCouponPayload, emptyForm, validateCouponStep } from '../couponForm'

describe('coupon creation validation and payload', () => {
  it('blocks empty codes, excessive percentages and invalid limits', () => {
    expect(validateCouponStep(emptyForm, 0)).toMatch(/code/)
    expect(validateCouponStep({ ...emptyForm, code: 'SAVE', amount: 101 }, 0)).toMatch(/100%/)
    expect(validateCouponStep({ ...emptyForm, maxRedemptions: -1 }, 2)).toMatch(/whole numbers/)
    expect(validateCouponStep({ ...emptyForm, perUserLimit: 1.5 }, 2)).toMatch(/whole numbers/)
  })
  it('rejects reversed dates and malformed recipients', () => {
    expect(
      validateCouponStep({ ...emptyForm, validFrom: '2026-10-02', validUntil: '2026-10-01' }, 2),
    ).toMatch(/end date/)
    expect(validateCouponStep({ ...emptyForm, allowedEmails: 'not-an-email' }, 2)).toMatch(/email/)
  })
  it('preserves restrictions and normalizes the creation request', () => {
    const form = {
      ...emptyForm,
      code: ' welcome ',
      allowedEmails: 'ONE@example.com\none@example.com; two@example.com',
      appliesToSurfaces: [CouponSurface.DONATION],
      maxRedemptions: 25,
      validUntil: '2026-12-31',
      active: false,
    }
    expect(createCouponPayload(form)).toMatchObject({
      code: 'WELCOME',
      allowedEmails: ['one@example.com', 'two@example.com'],
      appliesToSurfaces: ['donation'],
      maxRedemptions: 25,
      validUntil: '2026-12-31',
      active: false,
    })
    expect(createCouponPayload(form).perUserLimit).toBeUndefined()
    expect(
      createCouponPayload({
        ...form,
        discountType: CouponDiscountType.FIXED,
        maxDiscountAmount: 20,
      }).maxDiscountAmount,
    ).toBeUndefined()
  })
})
