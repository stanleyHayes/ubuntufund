import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform, ScrollView, View } from 'react-native'
import { Text } from 'react-native-paper'
import { useFocusEffect, useRouter } from 'expo-router'
import { deepLinkToSubscriptions, ErrorCode, fetchProducts, finishTransaction, getAvailablePurchases, restorePurchases,
  useIAP, type ProductSubscription, type Purchase } from 'expo-iap'
import { BillingCycle, SubscriptionTier, type Subscription } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import { Button, PageSkeleton } from '@/components/Loading'
import { GlassSurface } from '@/components/GlassSurface'
import { SignInRequired } from '@/components/SignInRequired'
import { api, ApiError } from '@/lib/api'
import { sessionSnapshot } from '@/lib/session'
import { purchaseBinding, storePrice, storePurchaseRequest, verifyAndFinishStorePurchase,
  type StoreCatalog, type StoreCatalogProduct, type BillingStore } from '@/lib/storeBilling'

const store: BillingStore = Platform.OS === 'ios' ? 'apple' : 'google'
const storeName = store === 'apple' ? 'App Store' : 'Google Play'
const purchaseOptions = { onlyIncludeActiveItemsIOS: true, includeSuspendedAndroid: true, alsoPublishToEventListenerIOS: false }
const safeMessage = (error: unknown) => error instanceof ApiError ? error.message :
  error instanceof Error && !('code' in error) ? error.message : 'The store could not complete this request. Retry or restore your purchases.'

export default function SubscriptionScreen() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <PageSkeleton />
  if (!user) return <SignInRequired message="Sign in to manage your subscription." />
  return <StorePlans key={user.id} userId={user.id} />
}

function StorePlans({ userId }: { userId: string }) {
  const p = usePalette()
  const router = useRouter()
  const [catalog, setCatalog] = useState<StoreCatalog | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [products, setProducts] = useState<ProductSubscription[]>([])
  const [cycle, setCycle] = useState(BillingCycle.MONTHLY)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const mounted = useRef(true)
  const processing = useRef(new Map<string, Promise<boolean>>())
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const current = useCallback(() => mounted.current && sessionSnapshot()?.user.id === userId, [userId])
  const load = useCallback(async () => {
    const [nextCatalog, nextSubscription] = await Promise.all([
      api.get<StoreCatalog>(`/store-billing/catalog/${store}`), api.get<Subscription>('/subscriptions/mine'),
    ])
    if (current()) { setCatalog(nextCatalog); setSubscription(nextSubscription); setLoading(false) }
  }, [current])
  const processPurchase = useCallback((purchase: Purchase): Promise<boolean> => {
    const key = `${purchase.store}:${purchase.id}`
    const existing = processing.current.get(key)
    if (existing) return existing
    const work = (async () => {
      const result = await verifyAndFinishStorePurchase(purchase, store, userId, {
        currentUserId: () => sessionSnapshot()?.user.id,
        verify: (input) => api.post('/store-billing/verify', input),
        finish: (item) => finishTransaction({ purchase: item, isConsumable: false }),
      })
      if (current()) {
        if ('subscription' in result && result.subscription) setSubscription(result.subscription)
        if (result.pending) setMessage('Your purchase is pending. Access updates after the store confirms payment. You do not need to buy again.')
      }
      return result.active
    })().finally(() => { processing.current.delete(key) })
    processing.current.set(key, work)
    return work
  }, [current, userId])
  const iap = useIAP({
    onPurchaseSuccess: (purchase) => {
      void processPurchase(purchase).then((active) => {
        if (active && current()) { setError(''); setMessage('Your subscription is active.'); void load().catch(() => {}) }
      }).catch((failure) => { if (current()) setError(safeMessage(failure)) })
        .finally(() => { if (current()) setBusy(false) })
    },
    onPurchaseError: (failure) => {
      if (!current()) return
      setBusy(false)
      if (failure.code === ErrorCode.UserCancelled) setMessage('Purchase cancelled.')
      else if (failure.code === ErrorCode.Pending || failure.code === ErrorCode.DeferredPayment) setMessage('Your purchase is pending approval or payment. Restore purchases after the store confirms it.')
      else setError('The store could not complete the purchase. Restore purchases before trying to buy again.')
    },
    onError: () => { if (current()) setError('The store is unavailable. Check your connection and retry.') },
    onSubscriptionBillingIssue: () => { if (current()) setMessage(`Your subscription needs attention. Open ${storeName} subscription settings to review payment.`) },
  })

  useFocusEffect(useCallback(() => {
    void load().catch((failure) => { if (current()) { setError(safeMessage(failure)); setLoading(false) } })
  }, [load, current]))
  useEffect(() => {
    let cancelled = false
    if (iap.connected && catalog?.products.length) {
      const skus = [...new Set(catalog.products.map((entry) => entry.productId))]
      void fetchProducts({ skus, type: 'subs' }).then((items) => {
        if (!cancelled && current()) setProducts((items ?? []).filter((item): item is ProductSubscription => item.type === 'subs'))
      }).catch(() => { if (!cancelled && current()) setError('Store prices could not be loaded. Refresh to retry.') })
    }
    return () => { cancelled = true }
  }, [iap.connected, catalog, current])

  const restore = useCallback(async (interactive = true) => {
    if (!iap.connected) { if (interactive) setError('Connect to the store before restoring purchases.'); return }
    if (interactive) { setBusy(true); setError(''); setMessage('') }
    try {
      if (interactive) await restorePurchases()
      const purchases = await getAvailablePurchases(purchaseOptions)
      let restored = 0
      let failures = 0
      for (const purchase of purchases) {
        if (purchase.store !== store) continue
        try { if (await processPurchase(purchase)) restored += 1 } catch { failures += 1 }
      }
      await load()
      if (interactive && current()) {
        setMessage(restored ? 'Your purchases have been restored.' : 'No active subscription was restored for this account.')
        if (failures) setError('Some purchases could not be restored. Check your connection and sign in to the Ujimora and store accounts used for those purchases, then retry.')
      }
    } catch (failure) { if (current() && interactive) setError(safeMessage(failure)) }
    finally { if (current() && interactive) setBusy(false) }
  }, [iap.connected, processPurchase, load, current])
  useEffect(() => {
    if (iap.connected) void restore(false)
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void restore(false) })
    return () => listener.remove()
  }, [iap.connected, restore])

  const buy = async (entry: StoreCatalogProduct) => {
    const product = products.find((item) => item.id === entry.productId)
    const price = storePrice(entry, product)
    if (!price || !iap.connected) return
    setBusy(true); setError(''); setMessage('')
    try {
      const prepared = await api.post<{ accountToken: string }>('/store-billing/prepare', {
        store, productId: entry.productId, basePlanId: entry.basePlanId,
      })
      const available = await getAvailablePurchases(purchaseOptions)
      const owned = available.filter((item) => item.store === store && item.purchaseState === 'purchased' && purchaseBinding(item) === prepared.accountToken)
      if (owned.length > 1) throw new Error('Restore your purchases and review your existing subscriptions before choosing another plan.')
      const previous = owned[0]
      if (previous) await processPurchase(previous)
      const currentSubscription = await api.get<Subscription>('/subscriptions/mine')
      const paid = currentSubscription.tier !== SubscriptionTier.FREE && currentSubscription.status === 'active' && new Date(currentSubscription.currentPeriodEnd) > new Date()
      if (paid && currentSubscription.tier === entry.tier && currentSubscription.billingCycle === entry.billingCycle) {
        if (current()) { setSubscription(currentSubscription); setMessage('This subscription is already active.'); setBusy(false) }
        return
      }
      if (paid && !previous) throw new Error('Restore the active subscription using the store account that purchased it before changing plans.')
      if (store === 'apple' && previous && product?.platform === 'ios') {
        const old = products.find((item) => item.id === previous.productId)
        if (old?.platform !== 'ios' || !old.subscriptionGroupIdIOS || old.subscriptionGroupIdIOS !== product.subscriptionGroupIdIOS) {
          throw new Error('Manage the existing subscription in App Store settings before changing plans.')
        }
      }
      if (!current()) return
      await iap.requestPurchase(storePurchaseRequest(entry, price, prepared.accountToken, previous))
      if (current()) setMessage('Follow the store confirmation. Your plan updates after payment is verified. Use Restore purchases if confirmation was interrupted.')
    } catch (failure) { if (current()) setError(safeMessage(failure)) }
    finally { if (current()) setBusy(false) }
  }
  const manage = async () => {
    try { await deepLinkToSubscriptions({ packageNameAndroid: 'com.ujimora.app' }) }
    catch { setError(`Could not open ${storeName} subscription settings. Open subscriptions directly in your store account.`) }
  }
  const paid = subscription && subscription.tier !== SubscriptionTier.FREE && subscription.status === 'active' && new Date(subscription.currentPeriodEnd) > new Date()
  const currentPlanName = catalog?.products.find((entry) => entry.tier === subscription?.tier)?.plan.name ?? (paid ? 'Paid plan' : 'Community')
  const foreignProvider = !!catalog?.provider && catalog.provider !== store
  if (loading) return <PageSkeleton />
  return <ScrollView style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
    <Text variant="headlineMedium" style={{ color: p.text, fontFamily: 'Outfit_800ExtraBold' }}>Your subscription</Text>
    <Text style={{ color: p.textSecondary }}>Choose the tools that fit your fundraising. Your plan follows your Ujimora account across devices.</Text>
    <GlassSurface style={{ padding: 20, borderRadius: 16, gap: 8 }}>
      <Text variant="labelLarge" style={{ color: p.textSecondary }}>CURRENT PLAN</Text>
      <Text variant="titleLarge" style={{ color: p.text }}>{currentPlanName}</Text>
      {paid && <Text style={{ color: p.textSecondary }}>Access through {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. {subscription.cancelAtPeriodEnd ? 'Automatic renewal is off.' : 'Review renewal details in your billing account.'}</Text>}
      {foreignProvider ? <Text style={{ color: p.textSecondary }}>This account manages its subscription through another billing service. Continue using that service to avoid a second subscription.</Text>
        : catalog?.provider === store && <Button mode="outlined" onPress={() => void manage()}>Manage {storeName} subscription</Button>}
    </GlassSurface>
    {!!error && <View accessibilityRole="alert"><Text style={{ color: p.error }}>{error}</Text></View>}
    {!!message && <Text accessibilityLiveRegion="polite" style={{ color: p.text }}>{message}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button mode="outlined" disabled={busy || !iap.connected} onPress={() => void restore()}>Restore purchases</Button>
      <Button disabled={busy} onPress={() => { setError(''); void iap.reconnect().then(() => load()).catch(() => setError('Could not refresh the store. Please retry.')) }}>Refresh</Button>
    </View>
    {!catalog?.available ? <Text style={{ color: p.textSecondary }}>New store purchases are temporarily unavailable. Your existing plan and free features remain available.</Text> : !foreignProvider && <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[BillingCycle.MONTHLY, BillingCycle.YEARLY].map((option) => <Button key={option} mode={cycle === option ? 'contained' : 'outlined'} accessibilityState={{ selected: cycle === option }} onPress={() => setCycle(option)}>{option === BillingCycle.MONTHLY ? 'Monthly' : 'Yearly'}</Button>)}
      </View>
      {catalog.products.filter((entry) => entry.billingCycle === cycle).map((entry) => {
        const price = storePrice(entry, products.find((item) => item.id === entry.productId))
        const selected = paid && subscription.tier === entry.tier && subscription.billingCycle === entry.billingCycle
        return <GlassSurface key={`${entry.productId}:${entry.basePlanId ?? ''}`} style={{ padding: 20, borderRadius: 16, gap: 10 }}>
          <Text variant="titleLarge" style={{ color: p.text }}>{entry.plan.name}</Text>
          <Text style={{ color: p.textSecondary }}>{entry.plan.description}</Text>
          <Text variant="headlineSmall" style={{ color: p.text }}>{price ? `${price.displayPrice} / ${cycle === BillingCycle.MONTHLY ? 'month' : 'year'}` : 'Store price unavailable'}</Text>
          <Text style={{ color: p.textSecondary }}>{entry.plan.maxActiveCampaigns < 0 ? 'Unlimited active campaigns' : `${entry.plan.maxActiveCampaigns} active campaigns`}{entry.plan.liveStreaming ? ' · Live streaming' : ''}{entry.plan.campaignCollaboration ? ' · Campaign collaboration' : ''}</Text>
          <Text style={{ color: p.textSecondary }}>Renews automatically at the store price unless cancelled. Any eligible introductory offer, price change or plan-change adjustment is shown by {storeName} before confirmation.</Text>
          <Button mode="contained" loading={busy} disabled={busy || !price || !iap.connected || !!selected} onPress={() => void buy(entry)}>{selected ? 'Current plan' : paid ? 'Change plan' : 'Subscribe'}</Button>
        </GlassSurface>
      })}
    </>}
    <Text style={{ color: p.textSecondary }}>{store === 'apple'
      ? 'Payment is charged to your Apple Account at confirmation of purchase. Subscriptions renew automatically for the same period and price unless automatic renewal is turned off at least 24 hours before the end of the current period; renewal is charged within 24 hours before the period ends.'
      : 'Payment is charged to your Google Play account at confirmation of purchase. Subscriptions renew automatically for the same period and price until you cancel; cancelling stops future renewals and keeps access until the end of the paid period.'} Manage or cancel automatic renewal in your {storeName} subscription settings. Deleting your Ujimora account does not cancel a store subscription.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button onPress={() => router.push('/billing-terms')}>Subscription terms</Button>
      <Button onPress={() => router.push('/terms')}>Terms of Use</Button>
      <Button onPress={() => router.push('/privacy')}>Privacy Policy</Button>
    </View>
  </ScrollView>
}
