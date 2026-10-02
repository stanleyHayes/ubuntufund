import { describe, expect, it } from 'vitest'
import { CouponDiscountType, CouponSurface } from '@ubuntu-fund/types'
import { buildPlanMap } from '@/lib/subscriptionMetrics'
import { couponTierOptions, createCouponPayload, emptyForm, planLabel, validateCouponStep } from '../couponForm'
import { LIVE_PLANS, livePlan } from '../../../../__tests__/fixtures/livePlans'

describe('coupon tiers from the live plans', () => {
  const plans = buildPlanMap([...LIVE_PLANS].reverse())

  it('names tiers by their live plan name, falling back to the id', () => {
    expect(planLabel('starter', plans)).toBe('Starter')
    expect(planLabel('harvest', plans)).toBe('harvest')
  })

  it('offers live plans with a price, in plan order, plus tiers the saved coupon already names', () => {
    expect(couponTierOptions(plans)).toEqual(['starter', 'pro', 'organization', 'enterprise'])
    expect(couponTierOptions(plans, ['enterprise', 'retired', 'free'])).toEqual(['starter', 'pro', 'organization', 'enterprise', 'retired', 'free'])
    const custom = { ...livePlan('pro'), tier: 'harvest', name: 'Harvest Circle', sortOrder: 2, priceMonthly: 19 }
    expect(couponTierOptions(buildPlanMap([...LIVE_PLANS, custom]))).toEqual(['starter', 'harvest', 'pro', 'organization', 'enterprise'])
  })

  it('leaves retired plans out, unless the saved coupon already names them', () => {
    const withRetired = buildPlanMap([...LIVE_PLANS, { ...livePlan('pro'), tier: 'legacy', name: 'Legacy', active: false }])
    expect(couponTierOptions(withRetired)).toEqual(['starter', 'pro', 'organization', 'enterprise'])
    expect(couponTierOptions(withRetired, ['legacy'])).toEqual(['starter', 'pro', 'organization', 'enterprise', 'legacy'])
  })
})

describe('the tier step and the live plans', () => {
  const form = { ...emptyForm, code: 'SAVE' }
  const loaded = { isLoading: false, error: null }

  it('cannot be left while plans load or after they fail, since no tier means every paid plan', () => {
    expect(validateCouponStep(form, 1, { isLoading: true, error: null })).toMatch(/still loading/)
    expect(validateCouponStep(form, 1, { isLoading: false, error: 'The server could not complete this request.' })).toMatch(/retry loading the plans/)
    expect(validateCouponStep(form, 1, loaded)).toBeNull()
    expect(validateCouponStep({ ...form, appliesToSurfaces: [CouponSurface.DONATION, CouponSurface.SUBSCRIPTION] }, 1, { isLoading: true, error: null })).toMatch(/still loading/)
  })

  it('does not wait for plans on a coupon that never discounts a subscription', () => {
    expect(validateCouponStep({ ...form, appliesToSurfaces: [CouponSurface.DONATION] }, 1, { isLoading: false, error: 'down' })).toBeNull()
  })
})

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
