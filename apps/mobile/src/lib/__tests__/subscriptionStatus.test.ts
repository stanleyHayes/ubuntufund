import { describe, expect, it } from 'vitest'
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionStatus, SubscriptionTier, type SubscriptionPlan } from '@ubuntu-fund/types'
import {
  EXISTING_CAMPAIGN_FEE_NOTE, checkoutSheetPrice, couponQuoteKey, cycleOption, effectivePlan, feePlan, isCurrentPlanTier,
  isPaidPlanInForce, isStoreManaged, planCardPrice, planDateLine, planTermsLine, sandboxFeeNote, storePlanSummary, upgradeOffer, upgradePlan,
} from '../subscriptionStatus'

const now = Date.parse('2026-09-25T12:00:00Z')
const pro = (end: number, status = SubscriptionStatus.ACTIVE) => ({ tier: SubscriptionTier.PRO, status, currentPeriodEnd: new Date(end).toISOString() })

describe('subscription status on the plans screen', () => {
  it('treats a Pro row past its period end as lapsed, so Pro can be bought again', () => {
    const lapsed = pro(now - 1)
    expect(isPaidPlanInForce(lapsed, now)).toBe(false)
    expect(isCurrentPlanTier(SubscriptionTier.PRO, lapsed, now)).toBe(false)
    expect(isCurrentPlanTier(SubscriptionTier.FREE, lapsed, now)).toBe(true)
    expect(isCurrentPlanTier(SubscriptionTier.PRO, pro(now + 1, SubscriptionStatus.EXPIRED), now)).toBe(false)
  })

  it('keeps an in-force plan current', () => {
    const active = pro(now + 86_400_000)
    expect(isCurrentPlanTier(SubscriptionTier.PRO, active, now)).toBe(true)
    expect(isCurrentPlanTier(SubscriptionTier.FREE, active, now)).toBe(false)
  })
})

/** The live price book: Free 5%, Starter 9.99 (3.5%), Pro 29.99 (2%), Organization 399 (2%), Enterprise sales-only. */
const LIVE = Object.fromEntries(Object.values(SUBSCRIPTION_PLANS).map((plan) => [plan.tier, { ...plan, popular: false }])) as Record<string, SubscriptionPlan>
const ordered = Object.values(LIVE)

describe('the plan that applies now', () => {
  it('applies the Free plan once a paid plan has ended, and the plan itself while it runs', () => {
    expect(effectivePlan(LIVE, pro(now - 1), now)).toMatchObject({ tier: 'free', platformFeePercent: 5, maxActiveCampaigns: 1 })
    expect(effectivePlan(LIVE, pro(now + 1, SubscriptionStatus.CANCELLED), now)?.tier).toBe('free')
    expect(effectivePlan(LIVE, pro(now + 86_400_000), now)).toMatchObject({ tier: 'pro', platformFeePercent: 2, maxActiveCampaigns: 10 })
    expect(effectivePlan(LIVE, { tier: SubscriptionTier.FREE, status: SubscriptionStatus.ACTIVE }, now)?.tier).toBe('free')
    expect(effectivePlan(LIVE, { tier: 'retired-tier', status: SubscriptionStatus.ACTIVE, currentPeriodEnd: new Date(now + 1).toISOString() }, now)?.tier).toBe('free')
  })
})

describe('the plan the upgrade call to action offers', () => {
  it('follows the admin Popular switch', () => {
    expect(upgradePlan(ordered.map((plan) => (plan.tier === 'organization' ? { ...plan, popular: true } : plan)))?.tier).toBe('organization')
  })

  it('falls back to the cheapest plan for sale, never Free or the sales-led Enterprise', () => {
    expect(upgradePlan(ordered)?.tier).toBe('starter')
    expect(upgradePlan(ordered.map((plan) => (plan.tier === 'enterprise' ? { ...plan, popular: true } : plan)))?.tier).toBe('starter')
    // A plan sold only yearly compares per month: 60 a year is 5 a month, under Starter's 9.99.
    expect(upgradePlan([...ordered, { ...LIVE.starter, tier: 'yearly-only', priceMonthly: 0, priceYearly: 60 }])?.tier).toBe('yearly-only')
  })

  it('passes over plans that cannot be bought, and offers none when nothing can', () => {
    const unsellable = ordered.map((plan) => (plan.tier === 'starter' ? { ...plan, isPublic: false } : plan.tier === 'pro' ? { ...plan, priceMonthly: 0, priceYearly: 0, popular: true } : plan))
    expect(upgradePlan(unsellable)?.tier).toBe('organization')
    expect(upgradePlan([LIVE.free, LIVE.enterprise])).toBeNull()
  })
})

describe('plan card price', () => {
  it('decides Free by tier and treats a zero paid price as a cycle that is not offered', () => {
    expect(planCardPrice({ tier: SubscriptionTier.FREE, priceMonthly: 0, priceYearly: 0 })).toEqual({ amount: 0, per: 'month' })
    expect(planCardPrice({ tier: SubscriptionTier.PRO, priceMonthly: 149, priceYearly: 1490 })).toEqual({ amount: 149, per: '30 days' })
    // A paid plan sold only yearly is not shown as a free GH₵ 0 plan.
    expect(planCardPrice({ tier: SubscriptionTier.PRO, priceMonthly: 0, priceYearly: 1490 })).toEqual({ amount: 1490, per: '1 year' })
    expect(planCardPrice({ tier: SubscriptionTier.PRO, priceMonthly: 0, priceYearly: 0 })).toBeNull()
  })
})

const DAY = 86_400_000
const date = (at: number) => new Date(at).toLocaleDateString()

describe('the current-plan card on Expo-web', () => {
  it('states the fee new campaigns get and that running campaigns keep theirs', () => {
    expect(planTermsLine({ feePlan: LIVE.free, limitsPlan: LIVE.free, lapsed: false })).toBe('5% platform fee on new campaigns | 1 campaign')
    expect(planTermsLine({ feePlan: LIVE.pro, limitsPlan: LIVE.pro, lapsed: false })).toBe('2% platform fee on new campaigns | 10 campaigns')
    expect(planTermsLine({ feePlan: LIVE.free, limitsPlan: LIVE.free, lapsed: true })).toBe('Free features apply: 5% platform fee on new campaigns | 1 campaign')
    expect(planTermsLine({ feePlan: LIVE.enterprise, limitsPlan: LIVE.enterprise, lapsed: false })).toMatch(/\| Unlimited campaigns$/)
    expect(EXISTING_CAMPAIGN_FEE_NOTE).toBe('Campaigns you already run keep the fee they were created with; creator withdrawals use your current plan’s fee.')
  })

  it('gives a sandbox store plan the Free fee, as the API charges, while its limits stay the plan\'s', () => {
    const sandbox = { ...pro(now + DAY), billingProvider: 'apple' as const, billingEnvironment: 'sandbox' as const }
    expect(feePlan(LIVE, sandbox, now)?.tier).toBe('free')
    expect(effectivePlan(LIVE, sandbox, now)?.tier).toBe('pro')
    expect(planTermsLine({ feePlan: feePlan(LIVE, sandbox, now)!, limitsPlan: effectivePlan(LIVE, sandbox, now)!, lapsed: false }))
      .toBe('5% platform fee on new campaigns | 10 campaigns')
    expect(sandboxFeeNote('Free')).toBe('This plan is a store test purchase, so new campaigns get the Free plan’s fee.')
    // A production store plan keeps its fee.
    expect(feePlan(LIVE, { ...sandbox, billingEnvironment: 'production' }, now)?.tier).toBe('pro')
  })

  it('dates access while a plan runs, its end once lapsed, and no future date for a plan revoked early', () => {
    expect(planDateLine(pro(now + 10 * DAY), now)).toBe(`Access through: ${date(now + 10 * DAY)}`)
    expect(planDateLine(pro(now - DAY, SubscriptionStatus.EXPIRED), now)).toBe(`Ended on ${date(now - DAY)}`)
    // An App Store refund: EXPIRED with the period end the plan would have had.
    expect(planDateLine(pro(now + 20 * DAY, SubscriptionStatus.EXPIRED), now)).toBe('Ended')
    expect(planDateLine({ tier: SubscriptionTier.FREE, status: SubscriptionStatus.ACTIVE, currentPeriodEnd: new Date(now + 30 * DAY).toISOString() }, now)).toBe('No end date')
  })
})

describe('a store plan the store may still renew', () => {
  const apple = (end: number, over: Record<string, unknown> = {}) =>
    ({ ...pro(end, SubscriptionStatus.EXPIRED), billingProvider: 'apple' as const, cancelAtPeriodEnd: false, ...over })

  it('is managed in the store while in force, and while lapsed with renewal on inside the 60-day retry window', () => {
    expect(isStoreManaged({ ...pro(now + DAY), billingProvider: 'google' }, now)).toBe(true)
    expect(isStoreManaged(apple(now - 10 * DAY), now)).toBe(true)
    expect(isStoreManaged(apple(now - 10 * DAY, { cancelAtPeriodEnd: true }), now)).toBe(false)
    expect(isStoreManaged(apple(now - 61 * DAY), now)).toBe(false)
    expect(isStoreManaged({ ...pro(now - 10 * DAY, SubscriptionStatus.EXPIRED), billingProvider: 'web', cancelAtPeriodEnd: false }, now)).toBe(false)
  })

  it('offers no upgrade while the store manages the plan, and the plan by name otherwise', () => {
    expect(upgradeOffer(ordered, apple(now - 10 * DAY), now)).toBeNull()
    expect(upgradeOffer(ordered, { ...pro(now + DAY), billingProvider: 'apple' }, now)).toBeNull()
    expect(upgradeOffer(ordered, apple(now - 10 * DAY, { cancelAtPeriodEnd: true }), now)).toMatchObject({ plan: { tier: 'starter' }, label: 'Upgrade to Starter' })
  })
})

describe('the upgrade call to action', () => {
  it('is offered on Free and after a plan lapses, never over an in-force plan or when nothing is for sale', () => {
    const free = { tier: SubscriptionTier.FREE, status: SubscriptionStatus.ACTIVE }
    expect(upgradeOffer(ordered, free, now)?.label).toBe('Upgrade to Starter')
    expect(upgradeOffer(ordered.map((plan) => (plan.tier === 'pro' ? { ...plan, popular: true } : plan)), free, now)?.label).toBe('Upgrade to Pro')
    expect(upgradeOffer(ordered, pro(now - DAY), now)?.plan.tier).toBe('starter')
    expect(upgradeOffer(ordered, pro(now + DAY), now)).toBeNull()
    expect(upgradeOffer([LIVE.free, LIVE.enterprise], free, now)).toBeNull()
  })
})

describe('billing cycles in the checkout sheet', () => {
  it('prices an offered cycle and says "Not offered" for one priced 0, never GH₵0', () => {
    expect(cycleOption(BillingCycle.MONTHLY, LIVE.pro)).toEqual({ title: 'Monthly', price: 'GH₵29.99 / 30 days', perMonth: null, offered: true,
      accessibilityLabel: 'Monthly, GH₵29.99 / 30 days' })
    expect(cycleOption(BillingCycle.YEARLY, LIVE.pro)).toEqual({ title: 'Yearly', price: 'GH₵299 / 1 year', perMonth: '≈ GH₵24.92 / mo', offered: true,
      accessibilityLabel: 'Yearly, GH₵299 / 1 year' })
    const yearlyOff = cycleOption(BillingCycle.YEARLY, { ...LIVE.pro, priceYearly: 0 })
    expect(yearlyOff).toEqual({ title: 'Yearly', price: 'Not offered', perMonth: null, offered: false, accessibilityLabel: 'Yearly, not offered' })
    expect(JSON.stringify(yearlyOff)).not.toContain('GH₵0')
  })
})

describe('the checkout sheet price and Pay button', () => {
  const base = { listPrice: 29.99, tier: 'pro', billingCycle: BillingCycle.MONTHLY as string, switching: false }
  const tenOff = { valid: true, baseAmount: 29.99, discountAmount: 3, finalAmount: 26.99 }

  it('charges the list price with no code', () => {
    expect(checkoutSheetPrice({ ...base, couponCode: '', quote: null })).toMatchObject({ finalAmount: 29.99, payLabel: 'Pay GH₵29.99', canPay: true })
  })

  it('shows and charges the quote priced for the code, plan and cycle on screen', () => {
    const quote = { key: couponQuoteKey('pro', BillingCycle.MONTHLY, 'save10'), preview: tenOff }
    expect(checkoutSheetPrice({ ...base, couponCode: 'SAVE10 ', quote })).toMatchObject({ baseAmount: 29.99, discountAmount: 3, finalAmount: 26.99,
      payLabel: 'Pay GH₵26.99', canPay: true, checking: false })
  })

  it('waits instead of showing the monthly quote once Yearly is chosen', () => {
    const quote = { key: couponQuoteKey('pro', BillingCycle.MONTHLY, 'SAVE10'), preview: tenOff }
    const yearly = checkoutSheetPrice({ ...base, listPrice: 299, billingCycle: BillingCycle.YEARLY, couponCode: 'SAVE10', quote })
    expect(yearly).toMatchObject({ checking: true, canPay: false, payLabel: 'Checking coupon…', discountAmount: 0, finalAmount: 299, quote: null })
  })

  it('waits instead of showing the previous code\'s quote while the edited code is quoted', () => {
    const quote = { key: couponQuoteKey('pro', BillingCycle.MONTHLY, 'SAVE50'), preview: { ...tenOff, discountAmount: 15, finalAmount: 14.99 } }
    expect(checkoutSheetPrice({ ...base, couponCode: 'SAVE5', quote })).toMatchObject({ checking: true, canPay: false, payLabel: 'Checking coupon…' })
    expect(checkoutSheetPrice({ ...base, couponCode: 'SAVE5', quote: null })).toMatchObject({ checking: true, canPay: false })
  })

  it('does not charge a code it could not check, and leaves a refused code to checkout to refuse', () => {
    const failed = { key: couponQuoteKey('pro', BillingCycle.MONTHLY, 'SAVE5'), preview: null }
    expect(checkoutSheetPrice({ ...base, couponCode: 'SAVE5', quote: failed })).toMatchObject({ unchecked: true, canPay: false, payLabel: 'Coupon not checked' })
    const refused = { key: couponQuoteKey('pro', BillingCycle.MONTHLY, 'OLD'), preview: { valid: false, reason: 'This coupon is no longer active', baseAmount: 29.99, discountAmount: 0, finalAmount: 29.99 } }
    expect(checkoutSheetPrice({ ...base, couponCode: 'OLD', quote: refused })).toMatchObject({ quote: { valid: false }, finalAmount: 29.99, canPay: true })
  })

  it('names a switch, a free activation and a cycle that is not offered', () => {
    expect(checkoutSheetPrice({ ...base, couponCode: '', quote: null, switching: true }).payLabel).toBe('Replace plan and pay GH₵29.99')
    const zeroed = { key: couponQuoteKey('pro', BillingCycle.MONTHLY, 'FREE'), preview: { valid: true, baseAmount: 29.99, discountAmount: 29.99, finalAmount: 0 } }
    expect(checkoutSheetPrice({ ...base, couponCode: 'FREE', quote: zeroed }).payLabel).toBe('Activate plan')
    expect(checkoutSheetPrice({ ...base, listPrice: 0, couponCode: '', quote: null })).toMatchObject({ payLabel: 'Not offered', canPay: false })
  })
})

describe('App Store / Google Play plan cards', () => {
  it('state the plan\'s platform fee on new campaigns before purchase, with its limits', () => {
    expect(storePlanSummary(LIVE.starter)).toBe('3.5% platform fee on new campaigns · 3 active campaigns')
    expect(storePlanSummary({ ...LIVE.pro, liveStreaming: true, campaignCollaboration: true })).toBe('2% platform fee on new campaigns · 10 active campaigns · Live streaming · Campaign collaboration')
    expect(storePlanSummary({ ...LIVE.starter, maxActiveCampaigns: 1 })).toMatch(/· 1 active campaign$/)
    expect(storePlanSummary({ ...LIVE.organization, maxActiveCampaigns: -1, onBehalfCampaigns: true })).toMatch(/Unlimited active campaigns · .*Campaigns on behalf of others$/)
  })
})
