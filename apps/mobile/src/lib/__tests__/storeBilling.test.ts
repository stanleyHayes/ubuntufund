import { describe, expect, it, vi } from 'vitest'
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionTier } from '@ubuntu-fund/types'
import type { ProductSubscription, Purchase } from 'expo-iap'
import { storePrice, storePurchaseRequest, verifyAndFinishStorePurchase, type StoreCatalogProduct } from '../storeBilling'

const entry: StoreCatalogProduct = { store: 'google', productId: 'pro', basePlanId: 'monthly', tier: 'pro',
  billingCycle: BillingCycle.MONTHLY, plan: SUBSCRIPTION_PLANS[SubscriptionTier.PRO] }
const google = {
  id: 'pro', platform: 'android', type: 'subs', displayPrice: 'WRONG PRODUCT-LEVEL PRICE',
  subscriptionOffers: [{ id: '', basePlanIdAndroid: 'monthly', offerTokenAndroid: 'store-offer-token',
    pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: 'GH₵ 99.00', billingPeriod: 'P1M', recurrenceMode: 1 }] } }],
} as ProductSubscription
const apple = {
  id: 'pro', platform: 'ios', type: 'subs', typeIOS: 'auto-renewable-subscription', displayPrice: '$8.99',
  subscriptionPeriodNumberIOS: '1', subscriptionPeriodUnitIOS: 'month',
} as ProductSubscription
const purchase = (store: 'apple' | 'google' = 'apple'): Purchase => ({ id: '100', transactionId: '101',
  productId: 'pro', purchaseState: 'purchased', purchaseToken: 'private-token', store,
  isAutoRenewing: true, quantity: 1, transactionDate: Date.now(),
} as Purchase)

describe('native store prices and requests', () => {
  it('uses the exact base-plan recurring price, never the web or product-level quote', () => {
    expect(storePrice(entry, google)).toEqual({ displayPrice: 'GH₵ 99.00', offerToken: 'store-offer-token' })
    expect(storePrice({ ...entry, basePlanId: 'yearly' }, google)).toBeNull()
    expect(storePrice({ ...entry, billingCycle: BillingCycle.YEARLY }, google)).toBeNull()
  })
  it('hides unsupported trial phase combinations and installment offers instead of under-disclosing their cost', () => {
    const offerProduct = structuredClone(google)
    if (offerProduct.platform !== 'android') throw new Error('fixture')
    const phase = offerProduct.subscriptionOffers[0].pricingPhasesAndroid!.pricingPhaseList[0]
    offerProduct.subscriptionOffers[0].pricingPhasesAndroid!.pricingPhaseList.push({ ...phase, formattedPrice: 'Free' })
    expect(storePrice(entry, offerProduct)).toBeNull()
  })
  it('validates Apple duration and product type before showing the store price', () => {
    expect(storePrice({ ...entry, store: 'apple', basePlanId: undefined }, apple)).toEqual({ displayPrice: '$8.99' })
    expect(storePrice({ ...entry, store: 'apple', billingCycle: BillingCycle.YEARLY }, apple)).toBeNull()
    expect(storePrice({ ...entry, store: 'apple' }, { ...apple, typeIOS: 'consumable' } as ProductSubscription)).toBeNull()
  })
  it('binds purchases to the server account UUID and sends Google replacement information', () => {
    const result = storePurchaseRequest(entry, storePrice(entry, google)!, 'server-account', purchase('google'))
    expect(result).toMatchObject({ type: 'subs', request: { google: {
      obfuscatedAccountId: 'server-account', skus: ['pro'], purchaseToken: 'private-token',
      subscriptionOffers: [{ sku: 'pro', offerToken: 'store-offer-token' }],
      subscriptionProductReplacementParams: { oldProductId: 'pro', replacementMode: 'with-time-proration' },
    } } })
    expect(storePurchaseRequest({ ...entry, store: 'apple' }, { displayPrice: '$8.99' }, 'server-account'))
      .toMatchObject({ request: { apple: { appAccountToken: 'server-account', andDangerouslyFinishTransactionAutomatically: false } } })
    expect(() => storePurchaseRequest(entry, { displayPrice: 'not purchasable' }, 'server-account')).toThrow('unavailable')
  })
})

describe('purchase fulfilment', () => {
  const deps = () => ({ currentUserId: () => 'owner', verify: vi.fn(async () => ({ active: true })), finish: vi.fn(async () => {}) })
  it('waits for server verification before finishing an Apple transaction', async () => {
    const dependencies = deps()
    let release!: (value: { active: boolean }) => void
    dependencies.verify.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const work = verifyAndFinishStorePurchase(purchase(), 'apple', 'owner', dependencies)
    expect(dependencies.verify).toHaveBeenCalledWith({ store: 'apple', reference: '101' })
    expect(dependencies.finish).not.toHaveBeenCalled()
    release({ active: true })
    expect(await work).toMatchObject({ active: true })
    expect(dependencies.finish).toHaveBeenCalledOnce()
  })
  it('leaves Google acknowledgement to the durable backend job', async () => {
    const dependencies = deps()
    await verifyAndFinishStorePurchase(purchase('google'), 'google', 'owner', dependencies)
    expect(dependencies.verify).toHaveBeenCalledWith({ store: 'google', reference: 'private-token' })
    expect(dependencies.finish).not.toHaveBeenCalled()
  })
  it('does not verify or finish pending purchases', async () => {
    const dependencies = deps()
    expect(await verifyAndFinishStorePurchase({ ...purchase(), purchaseState: 'pending' }, 'apple', 'owner', dependencies))
      .toEqual({ active: false, pending: true })
    expect(dependencies.verify).not.toHaveBeenCalled()
    expect(dependencies.finish).not.toHaveBeenCalled()
  })
  it('does not finish failed or inactive verification', async () => {
    const dependencies = deps()
    dependencies.verify.mockRejectedValueOnce(new Error('offline'))
    await expect(verifyAndFinishStorePurchase(purchase(), 'apple', 'owner', dependencies)).rejects.toThrow('offline')
    dependencies.verify.mockResolvedValueOnce({ active: false })
    await verifyAndFinishStorePurchase(purchase(), 'apple', 'owner', dependencies)
    expect(dependencies.finish).not.toHaveBeenCalled()
  })
  it('does not finish for an account that changed during verification', async () => {
    const dependencies = deps()
    let currentUser = 'owner'
    dependencies.currentUserId = () => currentUser
    dependencies.verify.mockImplementationOnce(async () => { currentUser = 'other'; return { active: true } })
    await expect(verifyAndFinishStorePurchase(purchase(), 'apple', 'owner', dependencies)).rejects.toThrow('Sign in to the account')
    expect(dependencies.finish).not.toHaveBeenCalled()
    await expect(verifyAndFinishStorePurchase(purchase(), 'apple', 'owner', dependencies)).rejects.toThrow('Sign in to the account')
    expect(dependencies.verify).toHaveBeenCalledOnce()
  })
  it('rejects unsupported stores and missing references', async () => {
    const dependencies = deps()
    await expect(verifyAndFinishStorePurchase(purchase('google'), 'apple', 'owner', dependencies)).rejects.toThrow('different app store')
    await expect(verifyAndFinishStorePurchase({ ...purchase('google'), purchaseToken: null }, 'google', 'owner', dependencies))
      .rejects.toThrow('purchase reference')
    expect(dependencies.verify).not.toHaveBeenCalled()
  })
})
