import type { ProductSubscription, Purchase, RequestPurchaseProps } from 'expo-iap'
import { BillingCycle, type Subscription, type SubscriptionPlan } from '@ubuntu-fund/types'

export type BillingStore = 'apple' | 'google'
export interface StoreCatalogProduct {
  store: BillingStore
  productId: string
  basePlanId?: string
  tier: string
  billingCycle: BillingCycle
  plan: SubscriptionPlan
}
export interface StoreCatalog {
  available: boolean
  provider: BillingStore | 'web' | null
  products: StoreCatalogProduct[]
}
export interface StorePrice { displayPrice: string; offerToken?: string }

/** Show only supported recurring periods, using prices supplied by the store. */
export function storePrice(entry: StoreCatalogProduct, product?: ProductSubscription): StorePrice | null {
  if (!product || product.id !== entry.productId || product.type !== 'subs') return null
  if (entry.store === 'apple' && product.platform === 'ios') {
    if (product.typeIOS !== 'auto-renewable-subscription' || product.subscriptionPeriodNumberIOS !== '1' ||
      product.subscriptionPeriodUnitIOS !== (entry.billingCycle === BillingCycle.MONTHLY ? 'month' : 'year')) return null
    if (product.pricingTermsIOS?.some((terms) => terms.billingPlanType === 'monthly')) return null
    return product.displayPrice ? { displayPrice: product.displayPrice } : null
  }
  if (entry.store === 'google' && product.platform === 'android') {
    const period = entry.billingCycle === BillingCycle.MONTHLY ? 'P1M' : 'P1Y'
    const offer = product.subscriptionOffers.find((candidate) => {
      const phases = candidate.pricingPhasesAndroid?.pricingPhaseList
      return candidate.basePlanIdAndroid === entry.basePlanId && candidate.offerTokenAndroid && !candidate.installmentPlanDetailsAndroid &&
        phases?.length === 1 && phases[0].recurrenceMode === 1 && phases[0].billingPeriod === period
    })
    const displayPrice = offer?.pricingPhasesAndroid?.pricingPhaseList[0]?.formattedPrice
    return offer?.offerTokenAndroid && displayPrice ? { displayPrice, offerToken: offer.offerTokenAndroid } : null
  }
  return null
}

export function storePurchaseRequest(entry: StoreCatalogProduct, price: StorePrice, accountToken: string, previous?: Purchase): RequestPurchaseProps {
  if (entry.store === 'apple') return { type: 'subs', request: { apple: {
    sku: entry.productId, appAccountToken: accountToken, andDangerouslyFinishTransactionAutomatically: false,
  } } }
  if (!price.offerToken) throw new Error('This store price is unavailable. Refresh the plans.')
  return { type: 'subs', request: { google: {
    skus: [entry.productId], obfuscatedAccountId: accountToken,
    subscriptionOffers: [{ sku: entry.productId, offerToken: price.offerToken }],
    ...(previous?.purchaseToken ? { purchaseToken: previous.purchaseToken,
      subscriptionProductReplacementParams: { oldProductId: previous.productId, replacementMode: 'with-time-proration' as const } } : {}),
  } } }
}

export function purchaseBinding(purchase: Purchase): string | undefined {
  return purchase.store === 'apple' && 'appAccountToken' in purchase ? purchase.appAccountToken ?? undefined
    : 'obfuscatedAccountIdAndroid' in purchase ? purchase.obfuscatedAccountIdAndroid ?? undefined : undefined
}

export async function verifyAndFinishStorePurchase(purchase: Purchase, store: BillingStore, userId: string, deps: {
  currentUserId: () => string | undefined
  verify: (input: { store: BillingStore; reference: string }) => Promise<{ active: boolean; subscription?: Subscription | null }>
  finish: (purchase: Purchase) => Promise<unknown>
}) {
  const sameAccount = () => {
    if (deps.currentUserId() !== userId) throw new Error('Sign in to the account used for this purchase, then restore it.')
  }
  sameAccount()
  if (purchase.store !== store) throw new Error('This purchase belongs to a different app store.')
  if (purchase.purchaseState !== 'purchased') return { active: false, pending: true }
  const reference = store === 'apple' ? ('transactionId' in purchase ? purchase.transactionId : purchase.id) : purchase.purchaseToken
  if (!reference) throw new Error('The store did not return a purchase reference. Restore the purchase to retry.')
  const result = await deps.verify({ store, reference })
  sameAccount()
  // Google acknowledgement is durable server work. Do not acknowledge again
  // through BillingClient after the server has already completed that step.
  if (result.active && store === 'apple') await deps.finish(purchase)
  return { ...result, pending: false }
}
