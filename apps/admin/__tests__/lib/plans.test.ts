import { describe, expect, it } from 'vitest'
import { formatPesewas, formatPlanPrice, toPesewas, yearlyPerMonthPesewas } from '@/lib/money'
import {
  comparePlans,
  cyclePrice,
  isFreePlan,
  isSalesOnly,
  isSelfServe,
  MAX_PLAN_PRICE,
  onBehalfBlocked,
  priceInvalid,
  pricingChanges,
  sortOrderTie,
  withFeature,
  yearlyNote,
} from '@/lib/plans'
import { LIVE_PLANS, livePlan } from '../fixtures/livePlans'

describe('plan money formatting', () => {
  it('formats plan prices with grouping: no decimals when whole, exactly two otherwise', () => {
    expect(formatPlanPrice(9.99)).toBe('GH₵ 9.99')
    expect(formatPlanPrice(1500)).toBe('GH₵ 1,500')
    expect(formatPlanPrice(3990)).toBe('GH₵ 3,990')
    expect(formatPlanPrice(9999.9)).toBe('GH₵ 9,999.90')
    expect(formatPlanPrice(332.5)).toBe('GH₵ 332.50')
    expect(formatPlanPrice(0)).toBe('GH₵ 0')
  })

  it('formats pesewas as cedis with exactly two decimals', () => {
    expect(formatPesewas(37248)).toBe('GH₵ 372.48')
    expect(formatPesewas(999)).toBe('GH₵ 9.99')
    expect(formatPesewas(33250)).toBe('GH₵ 332.50')
    expect(formatPesewas(83333)).toBe('GH₵ 833.33')
    expect(formatPesewas(123233)).toBe('GH₵ 1,232.33')
    expect(formatPesewas(0)).toBe('GH₵ 0.00')
  })

  it('rounds to whole pesewas as checkout does, and yearly per month from the rounded yearly price', () => {
    expect(toPesewas(9.99)).toBe(999)
    expect(toPesewas(29.99)).toBe(2999)
    expect(yearlyPerMonthPesewas(3990)).toBe(33250)
    expect(yearlyPerMonthPesewas(9999.9)).toBe(83333)
    expect(yearlyPerMonthPesewas(99)).toBe(825)
    expect(yearlyPerMonthPesewas(299)).toBe(2492)
    // Starter monthly + Pro monthly + Organization yearly, summed in pesewas.
    expect(formatPesewas(toPesewas(9.99) + toPesewas(29.99) + yearlyPerMonthPesewas(3990))).toBe('GH₵ 372.48')
  })
})

describe('plan rules', () => {
  it('orders plans by sort order, then monthly price, then tier id', () => {
    const tie = (tier: string) => ({ ...livePlan('pro'), tier, sortOrder: 9, priceMonthly: 10 })
    const sorted = [tie('b-plan'), ...[...LIVE_PLANS].reverse(), tie('a-plan')].sort(comparePlans).map((plan) => plan.tier)
    expect(sorted).toEqual(['free', 'starter', 'pro', 'organization', 'enterprise', 'a-plan', 'b-plan'])
  })

  it('names the other plans that share a sort order, as live Organization and Enterprise do', () => {
    expect(sortOrderTie(LIVE_PLANS, 3, 'enterprise')).toBe('Organization also uses 3; ties are ordered by monthly price, then tier id.')
    expect(sortOrderTie(LIVE_PLANS, 3)).toBe('Organization and Enterprise also use 3; ties are ordered by monthly price, then tier id.')
    expect(sortOrderTie(LIVE_PLANS, 4, 'enterprise')).toBeNull()
    expect(sortOrderTie(LIVE_PLANS, 2, 'pro')).toBeNull()
  })

  it('treats a plan as free only when neither cycle has a price', () => {
    expect(isFreePlan(livePlan('free'))).toBe(true)
    expect(isFreePlan({ priceMonthly: 0, priceYearly: 99 })).toBe(false)
    expect(isFreePlan({ priceMonthly: 9.99, priceYearly: 0 })).toBe(false)
    expect(cyclePrice(0, { priceMonthly: 9.99, priceYearly: 0 })).toBe('Not offered')
    expect(cyclePrice(0, livePlan('free'))).toBe('Free')
    expect(cyclePrice(99, livePlan('starter'))).toBe('GH₵ 99')
  })

  it('marks Enterprise and non-public plans as sales only', () => {
    expect(isSalesOnly(livePlan('enterprise'))).toBe(true)
    expect(isSalesOnly({ ...livePlan('pro'), isPublic: false })).toBe(true)
    expect(LIVE_PLANS.filter(isSalesOnly).map((plan) => plan.tier)).toEqual(['enterprise'])
  })

  it('sells only active, public plans other than Free and Enterprise at web checkout, as the API does', () => {
    expect(LIVE_PLANS.filter(isSelfServe).map((plan) => plan.tier)).toEqual(['starter', 'pro', 'organization'])
    expect(isSelfServe({ ...livePlan('pro'), active: false })).toBe(false)
    expect(isSelfServe({ ...livePlan('pro'), isPublic: false })).toBe(false)
  })

  it('accepts prices of 0 to 1,000,000 with at most two decimals, as the API does', () => {
    for (const price of [0, 9.99, 29.99, 399, 9999.9, MAX_PLAN_PRICE]) expect(priceInvalid(price)).toBe(false)
    for (const price of [9.999, 9.995, -1, Number.NaN, 1_500_000, MAX_PLAN_PRICE + 0.01]) expect(priceInvalid(price)).toBe(true)
  })

  it('describes the yearly price per month and how it compares with 12 × monthly, in pesewas', () => {
    expect(yearlyNote(livePlan('enterprise'))).toEqual({ text: '≈ GH₵ 833.33/mo · 16.7% below 12 × monthly', warning: false, exceeds: false })
    expect(yearlyNote(livePlan('organization'))?.text).toBe('≈ GH₵ 332.50/mo · 16.7% below 12 × monthly')
    expect(yearlyNote(livePlan('starter'))?.text).toBe('≈ GH₵ 8.25/mo · 17.4% below 12 × monthly')
    expect(yearlyNote(livePlan('pro'))?.text).toBe('≈ GH₵ 24.92/mo · 16.9% below 12 × monthly')
    expect(yearlyNote({ priceMonthly: 9.99, priceYearly: 119.88 })).toMatchObject({ warning: true, exceeds: false })
    expect(yearlyNote({ priceMonthly: 9.99, priceYearly: 200 })).toEqual({ text: '≈ GH₵ 16.67/mo · 66.8% above 12 × monthly, so yearly costs more', warning: true, exceeds: true })
    expect(yearlyNote({ priceMonthly: 0, priceYearly: 99 })?.text).toBe('≈ GH₵ 8.25/mo · monthly not offered')
    expect(yearlyNote(livePlan('free'))).toBeNull()
  })

  it('states a gap one decimal would show as 0% in cedis, beside 12 × monthly', () => {
    expect(yearlyNote({ priceMonthly: 9.99, priceYearly: 119.89 })).toEqual({ text: '≈ GH₵ 9.99/mo · GH₵ 0.01 above 12 × monthly (GH₵ 119.88), so yearly costs more', warning: true, exceeds: true })
    expect(yearlyNote({ priceMonthly: 9.99, priceYearly: 119.87 })).toEqual({ text: '≈ GH₵ 9.99/mo · GH₵ 0.01 below 12 × monthly (GH₵ 119.88)', warning: false, exceeds: false })
    // Six pesewas off GH₵ 119.88 is 0.05%, which one decimal shows.
    expect(yearlyNote({ priceMonthly: 9.99, priceYearly: 119.82 })?.text).toBe('≈ GH₵ 9.99/mo · 0.1% below 12 × monthly')
  })
})

describe('confirm-step diff', () => {
  it('lists every changed price and fee, old → new with the % change', () => {
    const before = { ...livePlan('enterprise'), priceMonthly: 99.99, priceYearly: 999 }
    const after = { ...before, priceMonthly: 999.99, priceYearly: 9999.9, platformFeePercent: 1.25, onBehalfFeePercent: 2, name: 'Renamed' }
    expect(pricingChanges(before, after)).toEqual([
      { kind: 'price', label: 'Monthly price', from: 'GH₵ 99.99', to: 'GH₵ 999.99', change: '+900.1%' },
      { kind: 'price', label: 'Yearly price', from: 'GH₵ 999', to: 'GH₵ 9,999.90', change: '+901%' },
      { kind: 'fee', label: 'Platform fee', from: '1%', to: '1.25%', change: '+25%' },
      { kind: 'fee', label: 'Extra fee on campaigns on behalf of others', from: '0%', to: '2%', change: null },
    ])
  })

  it('reads a dropped cycle as not offered and ignores edits that change nothing charged', () => {
    const starter = livePlan('starter')
    expect(pricingChanges(starter, { ...starter, priceYearly: 0 })).toEqual([
      { kind: 'price', label: 'Yearly price', from: 'GH₵ 99', to: 'Not offered', change: '−100%' },
    ])
    expect(pricingChanges(starter, { ...starter, priceMonthly: 9.990000000000002, description: 'New copy', popular: true })).toEqual([])
  })

  it('states a change one decimal would show as 0% as the amount', () => {
    const organization = livePlan('organization')
    expect(pricingChanges({ ...organization, priceMonthly: 999_999.99 }, { ...organization, priceMonthly: MAX_PLAN_PRICE })).toEqual([
      { kind: 'price', label: 'Monthly price', from: 'GH₵ 999,999.99', to: 'GH₵ 1,000,000', change: '+GH₵ 0.01' },
    ])
    expect(pricingChanges(organization, { ...organization, priceYearly: 3989.99 })[0].change).toBe('−GH₵ 0.01')
    const starter = livePlan('starter')
    expect(pricingChanges(starter, { ...starter, platformFeePercent: 3.5000000001 })).toEqual([
      { kind: 'fee', label: 'Platform fee', from: '3.5%', to: '3.5000000001%', change: '+0.0000000001 percentage points' },
    ])
  })
})

describe('on-behalf 0 guard', () => {
  it('flags on-behalf campaigns switched on with 0 allowed, as the live Enterprise row is', () => {
    expect(onBehalfBlocked(livePlan('enterprise'))).toBe(true)
    expect(onBehalfBlocked({ onBehalfCampaigns: true, maxOnBehalfCampaigns: -1 })).toBe(false)
    expect(onBehalfBlocked({ onBehalfCampaigns: false, maxOnBehalfCampaigns: 0 })).toBe(false)
  })

  it('makes the limit unlimited when the feature is switched on at 0, and keeps a set limit', () => {
    expect(withFeature(livePlan('organization'), 'onBehalfCampaigns', true)).toMatchObject({ onBehalfCampaigns: true, maxOnBehalfCampaigns: -1 })
    expect(withFeature({ ...livePlan('organization'), maxOnBehalfCampaigns: 5 }, 'onBehalfCampaigns', true)).toMatchObject({ onBehalfCampaigns: true, maxOnBehalfCampaigns: 5 })
    expect(withFeature(livePlan('organization'), 'liveStreaming', false)).toMatchObject({ liveStreaming: false, maxOnBehalfCampaigns: 0 })
  })
})
