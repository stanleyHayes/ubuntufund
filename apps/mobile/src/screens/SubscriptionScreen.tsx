import { TouchableRipple } from '@/components/RoundedControls'
import { recoverPendingSubscription } from '@/lib/subscriptions'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { SkeletonLoader, Button } from '@/components/Loading'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, ScrollView, StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { useFocusEffect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import {
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionCheckoutStatus,
  BillingCycle,
  type SubscriptionPlan,
} from '@ubuntu-fund/types'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { api } from '@/lib/api'
import {
  abandonSubscriptionCheckout,
  checkoutInProgressId,
  createSubscriptionCheckout,
  getSubscriptionCheckoutStatus,
  isPaymentsNotConfigured,
} from '@/lib/subscriptions'
import { previewCoupon } from '@/lib/coupons'
import { formatPlanPrice } from '@/lib/money'
import {
  EXISTING_CAMPAIGN_FEE_NOTE,
  checkoutSheetPrice,
  couponQuoteKey,
  cycleOption,
  effectivePlan,
  feePlan,
  isCurrentPlanTier,
  isPaidPlanInForce,
  isStoreManaged,
  planCardPrice,
  planDateLine,
  planTermsLine,
  sandboxFeeNote,
  upgradeOffer,
  type SheetQuote,
} from '@/lib/subscriptionStatus'
import { useAuth } from '@/context/AuthContext'
import { SignInRequired } from '@/components/SignInRequired'
import { GlassSurface } from '@/components/GlassSurface'
import { FadeInUp } from '@/components/anim/FadeInUp'

const ENTERPRISE_CONTACT = 'mailto:sales@ujimora.com?subject=Enterprise%20plan%20enquiry'
const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 15 // ~30s

/** Order plans cheapest → richest by the admin-set sortOrder; ties by price, then tier id. */
function bySortOrder(a: SubscriptionPlan, b: SubscriptionPlan): number {
  return a.sortOrder - b.sortOrder || a.priceMonthly - b.priceMonthly || a.tier.localeCompare(b.tier)
}

interface SubscriptionData {
  billingProvider?: 'web' | 'apple' | 'google'
  /** Store plans only: 'sandbox' for App Review / TestFlight purchases. */
  billingEnvironment?: 'production' | 'sandbox'
  /** Store plans: automatic renewal is off. */
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string
  tier: string
  status: SubscriptionStatus
  billingCycle: BillingCycle
  renewDate: string
}

const DEFAULT_SUB: SubscriptionData = {
  tier: SubscriptionTier.FREE,
  status: SubscriptionStatus.ACTIVE,
  billingCycle: BillingCycle.MONTHLY,
  renewDate: '',
}

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    content: { padding: 20, paddingBottom: 40 },
    centered: { justifyContent: 'center', alignItems: 'center' },

    // Header
    eyebrow: {
      fontSize: 11,
      fontFamily: 'Outfit_700Bold',
      color: p.secondaryDark,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    title: { fontSize: 26, fontFamily: 'Outfit_800ExtraBold', color: p.text, marginTop: 4 },
    lede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 6, marginBottom: 20 },

    // Current plan card — recipe/blur supplied by <GlassSurface>, so this is
    // layout only (a background/shadow here would sit over the glass blur).
    currentPlanCard: {
      borderRadius: 14,
      padding: 20,
      marginBottom: 24,
    },
    currentPlanLabel: { fontSize: 11, color: p.secondaryDark, fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
    currentPlanName: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: p.text, marginBottom: 8 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    statusActive: { backgroundColor: `${p.success}1F` },
    statusInactive: { backgroundColor: `${p.error}1F` },
    statusText: { fontSize: 11, fontFamily: 'Outfit_700Bold' },
    statusTextActive: { color: p.success },
    statusTextInactive: { color: p.error },
    billingText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary },
    renewText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginBottom: 4 },
    feeText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary },

    // Section title
    sectionTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 12 },
    plansErrorText: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textAlign: 'center', marginBottom: 16 },

    // Plans row
    plansScroll: { flexGrow: 0 },
    plansRow: { paddingBottom: 8, paddingRight: 20, gap: 12, alignItems: 'stretch' },

    // Plan card — fixed height so every CTA docks at the same baseline
    planCard: {
      ...neu.raised,
      backgroundColor: p.surface,
      borderRadius: 14,
      padding: 16,
      width: 220,
      minHeight: 400,
      flexDirection: 'column',
    },
    planCardPro: { boxShadow: `${neu.raised.boxShadow}, 0 0 0 2px ${p.primary}24` },
    planCardCurrent: { ...neu.inset },
    popularBadge: {
      backgroundColor: p.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    popularText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Outfit_700Bold', letterSpacing: 0.5 },
    planName: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 4 },
    planDesc: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginBottom: 12 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline' },
    planPrice: { fontSize: 28, fontFamily: 'Outfit_800ExtraBold', color: p.text },
    priceUnit: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginLeft: 2 },
    feeLabel: { fontSize: 12, color: p.primary, fontFamily: 'Outfit_700Bold', marginTop: 2, marginBottom: 12 },

    // Features
    featuresList: { marginBottom: 16 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
    featureItem: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: p.textSecondary, flex: 1 },

    // Plan button — marginTop:auto docks it at the card bottom so CTAs line up
    planButton: { borderRadius: 999, marginTop: 'auto' },
    currentChip: {
      backgroundColor: `${p.textSecondary}47`,
      borderRadius: 999,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 'auto',
    },
    currentChipText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.text },
    // Sits right under the docked "Current Plan" chip.
    renewButton: { borderRadius: 999, marginTop: 8 },

    // Upgrade CTA
    upgradeCta: {
      ...neu.raised,
      backgroundColor: p.surface,
      borderRadius: 14,
      padding: 24,
      marginTop: 24,
      alignItems: 'center',
    },
    upgradeIconTile: {
      ...neu.subtle,
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: `${p.secondary}29`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    upgradeTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 8 },
    upgradeDesc: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
    upgradeButton: { borderRadius: 999, alignSelf: 'stretch' },
    upgradeButtonContent: { paddingVertical: 4 },

    // Cancel button
    cancelButton: {
      marginTop: 16,
      marginBottom: 8,
      borderRadius: 999,
      borderColor: p.error,
    },

    // Checkout sheet (modal)
    sheetOverlay: { flex: 1, backgroundColor: p.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: p.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 36,
      gap: 14,
    },
    sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 4 },
    sheetTitle: { fontSize: 20, fontFamily: 'Outfit_800ExtraBold', color: p.text },
    sheetSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: -8 },
    cycleRow: { flexDirection: 'row', gap: 10 },
    cycleOption: { ...neu.subtle, flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12 },
    cycleOptionActive: { ...neu.greenInset },
    cycleText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.text },
    cycleTextActive: { color: '#fff' },
    cycleHint: { fontSize: 11, fontFamily: 'Outfit_500Medium', color: p.textSecondary, marginTop: 2 },
    cycleHintActive: { color: 'rgba(255,255,255,0.85)' },
    couponInput: { backgroundColor: p.surface },
    priceSummary: { ...neu.inset, borderRadius: 12, padding: 14, gap: 4 },
    priceLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    priceLabel: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: p.textSecondary },
    priceValue: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.text },
    priceBase: { fontSize: 13, fontFamily: 'Outfit_500Medium', color: p.textSecondary, textDecorationLine: 'line-through' },
    priceFinal: { fontSize: 20, fontFamily: 'Outfit_800ExtraBold', color: p.text },
    savingLine: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: p.success },
    couponError: { fontSize: 12, fontFamily: 'Outfit_500Medium', color: p.error },
    payButton: { borderRadius: 999, marginTop: 4 },
    payButtonContent: { paddingVertical: 6 },
    sheetCancel: { alignSelf: 'center', paddingVertical: 8 },
    sheetCancelText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.textSecondary },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

type CheckoutOutcome = 'succeeded' | 'failed' | 'expired' | 'timeout'

/**
 * Confirm a paid checkout by polling its status — the real activation lands via
 * the signed Paystack webhook, so the browser return is never trusted as proof.
 */
async function pollCheckout(id: string): Promise<CheckoutOutcome> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const checkout = await getSubscriptionCheckoutStatus(id)
      if (checkout.status === SubscriptionCheckoutStatus.SUCCEEDED) return 'succeeded'
      if (checkout.status === SubscriptionCheckoutStatus.FAILED) return 'failed'
      if (checkout.status === SubscriptionCheckoutStatus.EXPIRED) return 'expired'
    } catch {
      /* transient — keep polling until we run out of attempts */
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return 'timeout'
}

// ─── Checkout sheet ──────────────────────────────────────────
// Bottom sheet to pick a billing cycle, apply a coupon (live server quote), and
// open Paystack's hosted checkout in an in-app browser. Mirrors the web flow.

function CheckoutSheet({
  tier,
  plans,
  current,
  visible,
  onClose,
  onActivated,
}: {
  tier: string | null
  plans: Record<string, SubscriptionPlan>
  current: SubscriptionData
  visible: boolean
  onClose: () => void
  onActivated: () => Promise<void> | void
}) {
  const p = usePalette()
  const styles = useStyles()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY)
  const [couponCode, setCouponCode] = useState('')
  /** The latest coupon quote, with the code, plan and cycle it was priced for. */
  const [quote, setQuote] = useState<SheetQuote | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** An earlier unpaid checkout the API says blocks this purchase; the member may cancel it. */
  const [blockingCheckoutId, setBlockingCheckoutId] = useState<string | null>(null)
  const reqId = useRef(0)

  // Reset the sheet each time it opens for a plan, on a cycle it is sold on.
  useEffect(() => {
    if (visible) {
      const opened = tier ? plans[tier] : undefined
      setBillingCycle(opened && !(opened.priceMonthly > 0) && opened.priceYearly > 0 ? BillingCycle.YEARLY : BillingCycle.MONTHLY)
      setCouponCode('')
      setQuote(null)
      setError(null)
      setBlockingCheckoutId(null)
      setSubmitting(false)
    }
  }, [visible, tier, plans])

  // Debounced coupon preview (soft endpoint — never throws).
  useEffect(() => {
    const requests = reqId
    const id = ++requests.current
    if (!tier) return
    const code = couponCode.trim()
    if (!code) {
      setQuote(null)
      setPreviewing(false)
      return
    }
    setPreviewing(true)
    // The quote belongs to these inputs; the sheet ignores it once any changes.
    const key = couponQuoteKey(tier, billingCycle, code)
    const timer = setTimeout(async () => {
      try {
        const result = await previewCoupon({ code, tier, billingCycle })
        if (id === reqId.current) setQuote({ key, preview: result })
      } catch {
        if (id === reqId.current) setQuote({ key, preview: null })
      } finally {
        if (id === reqId.current) setPreviewing(false)
      }
    }, 400)
    return () => { clearTimeout(timer); requests.current++ }
  }, [couponCode, tier, billingCycle])

  if (!tier) return null

  const plan = plans[tier]
  if (!plan) return null
  const listPrice = billingCycle === BillingCycle.YEARLY ? plan.priceYearly : plan.priceMonthly
  // Buying a different plan while one is running replaces it immediately, with
  // no credit for unused time; the member confirms that by paying from here.
  const switching = isPaidPlanInForce(current) && current.tier !== tier
  // Buying the plan you have while it runs adds the time to its end.
  const renewing = isPaidPlanInForce(current) && current.tier === tier
  // Only a quote for this code, plan and cycle is shown or paid; until it is
  // in, Pay waits (checkout charges the code, plan and cycle on screen).
  const price = checkoutSheetPrice({ listPrice, tier, billingCycle, couponCode, quote, switching })
  const { baseAmount, finalAmount, payLabel } = price
  const discount = price.discountAmount

  const handleCheckout = async () => {
    setSubmitting(true)
    setError(null)
    setBlockingCheckoutId(null)
    try {
      const result = await createSubscriptionCheckout({
        tier,
        billingCycle,
        couponCode: couponCode.trim() || undefined,
        ...(switching ? { replaceCurrentPlan: true } : {}),
      })
      if (result.activatedWithoutCharge) {
        onClose()
        await onActivated()
        Alert.alert('Plan activated', 'Your subscription is now active.')
        return
      }
      if (result.authorizationUrl) {
        const returnUrl = Linking.createURL('subscriptions/callback')
        // Open Paystack's hosted page. We intentionally poll regardless of the
        // browser result type: Paystack redirects to the server callback (a web
        // URL, not our app scheme), so a successful payment still comes back as
        // dismiss/cancel here — only the signed webhook + this poll are trusted.
        await WebBrowser.openAuthSessionAsync(result.authorizationUrl, returnUrl)
        const outcome = await pollCheckout(result.checkout.id)
        onClose()
        if (outcome === 'succeeded') {
          await onActivated()
          Alert.alert('Success', 'Your subscription is now active.')
        } else if (outcome === 'failed' || outcome === 'expired') {
          Alert.alert(
            'Payment not completed',
            "This checkout was not completed. Check your payment account before starting a new checkout.",
          )
        } else {
          Alert.alert(
            'Still confirming',
            'If your payment went through, your plan will activate shortly — no need to pay again.',
          )
        }
        return
      }
      setError('Could not start checkout. Please try again.')
    } catch (e) {
      if (isPaymentsNotConfigured(e)) {
        setError("Card payments aren't available yet — you haven't been charged. Please try again later.")
      } else {
        setBlockingCheckoutId(checkoutInProgressId(e))
        setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // The member backed out of an earlier payment page and now wants a different
  // purchase: cancel that checkout (the API checks with Paystack first), then
  // carry on with this one.
  const cancelEarlierAndContinue = async () => {
    const earlier = blockingCheckoutId
    if (!earlier) return
    setSubmitting(true)
    setError(null)
    try {
      const closed = await abandonSubscriptionCheckout(earlier)
      setBlockingCheckoutId(null)
      if (closed.status === SubscriptionCheckoutStatus.SUCCEEDED) {
        onClose()
        await onActivated()
        Alert.alert('Plan activated', 'Your earlier plan payment went through, so that plan is now active.')
        return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel your earlier payment. Please try again.')
      setSubmitting(false)
      return
    }
    await handleCheckout()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
    >
      <KeyboardAvoidingView style={styles.sheetOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flexGrow: 0, maxHeight: '90%', backgroundColor: p.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} contentContainerStyle={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{plan.name} plan</Text>
          <Text style={styles.sheetSub}>{plan.description}</Text>

          {/* Billing cycle */}
          <View style={styles.cycleRow} accessibilityRole="radiogroup" accessibilityLabel="Billing cycle">
            {[BillingCycle.MONTHLY, BillingCycle.YEARLY].map((cycle) => {
              const active = billingCycle === cycle
              // A cycle priced 0 is not offered, never a GH₵0 price.
              const option = cycleOption(cycle, plan)
              return (
                <TouchableRipple
                  key={cycle}
                  style={[styles.cycleOption, active && styles.cycleOptionActive]}
                  rippleColor={p.ripple}
                  onPress={() => setBillingCycle(cycle)}
                  disabled={!option.offered}
                  accessibilityRole="radio"
                  accessibilityLabel={option.accessibilityLabel}
                  accessibilityState={{ selected: active, checked: active, disabled: !option.offered }}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.cycleText, active && styles.cycleTextActive]}>
                      {option.title}
                    </Text>
                    <Text style={[styles.cycleHint, active && styles.cycleHintActive]}>
                      {option.price}
                    </Text>
                    {option.perMonth ? (
                      <Text style={[styles.cycleHint, active && styles.cycleHintActive]}>
                        {option.perMonth}
                      </Text>
                    ) : null}
                  </View>
                </TouchableRipple>
              )
            })}
          </View>

          <Text style={styles.sheetSub}>
            One-time payment for {billingCycle === BillingCycle.YEARLY ? '1 year (365 days)' : '30 days'}. Your plan does not renew automatically.
          </Text>
          {renewing ? (
            <Text style={styles.sheetSub}>
              Adds {billingCycle === BillingCycle.YEARLY ? '1 year' : '30 days'} after your current plan ends on {new Date(current.currentPeriodEnd as string).toLocaleDateString()}.
            </Text>
          ) : null}
          {switching ? (
            <Text style={styles.couponError}>
              Your {plans[current.tier]?.name ?? 'current'} plan is active until {new Date(current.currentPeriodEnd as string).toLocaleDateString()}. {plan.name} replaces it as soon as payment is confirmed, and unused time is not refunded or credited.
            </Text>
          ) : null}

          {/* Coupon */}
          <TextInput
            mode="outlined"
            label="Coupon code (optional)"
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.couponInput}
            right={
              previewing ? (
                <TextInput.Icon icon={() => <SkeletonLoader size={16} color={p.primary} />} />
              ) : undefined
            }
          />
          {price.quote && !price.quote.valid ? (
            <Text style={styles.couponError}>{price.quote.reason ?? "This coupon can't be applied."}</Text>
          ) : null}
          {price.unchecked ? (
            <Text style={styles.couponError}>We could not check this coupon. Check your connection, then edit the code to try again, or remove it.</Text>
          ) : null}

          {/* Price summary */}
          <View style={styles.priceSummary}>
            <View style={styles.priceLine}>
              <Text style={styles.priceLabel}>Plan</Text>
              <Text style={discount > 0 ? styles.priceBase : styles.priceValue}>{formatPlanPrice(baseAmount)}</Text>
            </View>
            {discount > 0 ? (
              <>
                <View style={styles.priceLine}>
                  <Text style={styles.priceLabel}>Discount</Text>
                  <Text style={[styles.priceValue, { color: p.success }]}>-{formatPlanPrice(discount)}</Text>
                </View>
                <Text style={styles.savingLine}>Coupon applied — you save {formatPlanPrice(discount)}</Text>
              </>
            ) : null}
            <View style={styles.priceLine}>
              <Text style={styles.priceLabel}>Total</Text>
              <Text style={styles.priceFinal}>{price.checking ? 'Checking…' : price.unchecked ? '—' : formatPlanPrice(finalAmount)}</Text>
            </View>
          </View>

          {error ? <Text style={styles.couponError}>{error}</Text> : null}
          {blockingCheckoutId ? (
            <Button
              mode="outlined"
              textColor={p.primary}
              style={styles.renewButton}
              // Continuing charges the code and cycle on screen, so it waits for their total too.
              disabled={submitting || !price.canPay}
              onPress={cancelEarlierAndContinue}
            >
              Cancel it and continue
            </Button>
          ) : null}

          <Button
            mode="contained"
            buttonColor={p.primary}
            textColor={p.onPrimary}
            style={styles.payButton}
            contentStyle={styles.payButtonContent}
            loading={submitting}
            disabled={submitting || !price.canPay}
            onPress={handleCheckout}
            accessibilityLabel={payLabel}
          >
            {payLabel}
          </Button>
          <TouchableRipple style={styles.sheetCancel} onPress={submitting ? undefined : onClose}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableRipple>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default function SubscriptionScreen() {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const [currentSub, setCurrentSub] = useState<SubscriptionData>(DEFAULT_SUB)
  // A running store plan is managed in that store, and so is a lapsed one the
  // store may still renew (the API refuses web checkout for both). Once the
  // store can no longer charge, the web can sell a plan again.
  const storeManaged = isStoreManaged(currentSub)
  const storeRetrying = storeManaged && !isPaidPlanInForce(currentSub)
  const storeLabel = currentSub.billingProvider === 'apple' ? 'App Store' : 'Google Play'
  const storeManagementUrl = currentSub.billingProvider === 'apple' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions?package=com.ujimora.app'
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null)
  // Live plans from GET /plans (so admin-added tiers appear too). No seeded
  // defaults: the screen waits for them and offers a retry if they fail.
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>({})
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [plansError, setPlansError] = useState(false)

  const fetchSubscription = useCallback(async () => {
    try {
      await recoverPendingSubscription().catch(() => undefined)
      const data = await api.get<SubscriptionData>('/subscriptions/mine')
      setCurrentSub(data)
    } catch {
      // If no subscription found, keep default (FREE)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // GET /plans needs a session, so it runs once the member is signed in. A
  // failed refresh keeps plans already loaded; only a first failure shows.
  const fetchPlans = useCallback(async () => {
    try {
      const data = await api.get<SubscriptionPlan[]>('/plans')
      if (!Array.isArray(data) || !data.length) throw new Error('Plans unavailable')
      setPlans(Object.fromEntries(data.filter((pl) => pl?.tier).map((pl) => [pl.tier, pl])))
      setPlansLoaded(true)
      setPlansError(false)
    } catch {
      setPlansError(true)
    }
  }, [])

  // Refetch whenever the tab regains focus, so a subscription that settled via
  // the Paystack webhook (after our ~30s poll window) or a plan an admin just
  // edited is reflected without an app relaunch. Runs on first focus too.
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchSubscription()
        fetchPlans()
      }
    }, [user, fetchSubscription, fetchPlans]),
  )

  const orderedPlans = Object.values(plans)
    .filter((pl) => pl.active !== false && pl.isPublic !== false)
    .sort(bySortOrder)
  // A tier missing from the live plans reads as Free instead of breaking the screen.
  const currentPlan = plans[currentSub.tier] ?? plans[SubscriptionTier.FREE]
  // Web plans never renew on their own: once the period ends the member is
  // back on Free and may buy any plan again, including the one that lapsed.
  const paidInForce = isPaidPlanInForce(currentSub)
  const lapsed = currentSub.tier !== SubscriptionTier.FREE && !paidInForce
  const statusOk = !lapsed && currentSub.status === SubscriptionStatus.ACTIVE
  // The limits that apply now: Free's once a paid plan has ended.
  const planInEffect = effectivePlan(plans, currentSub) ?? currentPlan
  // The fee new campaigns get: Free's for a lapsed plan and for an App Store
  // sandbox (App Review / TestFlight) plan, which never gets the lower fee.
  const feeTerms = feePlan(plans, currentSub) ?? planInEffect
  const sandbox = currentSub.billingEnvironment === 'sandbox'
  // Hidden while a store manages the plan or nothing can be bought.
  const cta = upgradeOffer(orderedPlans, currentSub)

  if (!user) {
    return (
      <View style={styles.container}>
        <SignInRequired what="subscription" />
      </View>
    )
  }

  // No seeded prices stand in for live ones, so without plans nothing can be bought.
  if ((plansError && !plansLoaded) || (plansLoaded && !currentPlan)) {
    return (
      <View style={[styles.container, styles.centered, styles.content]}>
        <Text style={styles.plansErrorText}>Current plans and prices could not be loaded, so checkout is unavailable.</Text>
        <Button mode="outlined" textColor={p.primary} onPress={() => { setPlansError(false); fetchPlans() }}>
          Retry
        </Button>
      </View>
    )
  }

  if (isLoading || !plansLoaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <SkeletonLoader size="large" color={p.primary} />
      </View>
    )
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>MEMBERSHIP</Text>
      <Text style={styles.title}>Manage Your Plan</Text>
      <Text style={styles.lede}>Compare tiers and upgrade anytime.</Text>
      {storeManaged && <View style={{ marginBottom: 16, gap: 8 }}><Text style={styles.billingText}>{storeRetrying
        ? `Your ${storeLabel} subscription has lapsed, but ${storeLabel} may still renew it. Update your payment details or cancel it there before buying a plan here, to avoid a second subscription.`
        : `This subscription is managed through ${storeLabel}. Change plans or cancel there to avoid a second subscription.`}</Text><Button mode="outlined" onPress={() => void Linking.openURL(storeManagementUrl)}>Manage store subscription</Button></View>}

      {/* Current plan card */}
      <GlassSurface variant="raised" style={styles.currentPlanCard}>
        <Text style={styles.currentPlanLabel}>Current Plan</Text>
        <Text style={styles.currentPlanName}>{currentPlan.name}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, statusOk ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, statusOk ? styles.statusTextActive : styles.statusTextInactive]}>
              {lapsed ? 'EXPIRED' : currentSub.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.billingText}>
            {currentSub.billingCycle === BillingCycle.MONTHLY ? 'Monthly' : 'Yearly'}
          </Text>
        </View>
        <Text style={styles.renewText}>
          {planDateLine(currentSub)}
        </Text>
        <Text style={styles.feeText}>
          {planTermsLine({ feePlan: feeTerms, limitsPlan: planInEffect, lapsed })}
        </Text>
        <Text style={[styles.feeText, { marginTop: 4 }]}>
          {sandbox ? `${sandboxFeeNote(plans[SubscriptionTier.FREE]?.name)} ` : ''}{EXISTING_CAMPAIGN_FEE_NOTE}
        </Text>
      </GlassSurface>

      {/* Plan comparison - horizontal scroll */}
      <Text style={styles.sectionTitle}>Compare Plans</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plansScroll} contentContainerStyle={styles.plansRow}>
        {orderedPlans.map((plan, i) => {
          const tier = plan.tier
          const isCurrent = isCurrentPlanTier(tier, currentSub)
          const isPro = plan.popular === true
          const isEnterprise = tier === SubscriptionTier.ENTERPRISE
          // Free by tier: a zero price on a paid plan means that cycle is not offered.
          const isFree = tier === SubscriptionTier.FREE
          const price = planCardPrice(plan)
          // The server adds a same-plan purchase to the end of the running period.
          const canRenew = isCurrent && paidInForce && !storeManaged && !isFree && !isEnterprise && !!price

          return (
            <FadeInUp key={tier} index={i}>
            <View
              style={[
                styles.planCard,
                isPro && styles.planCardPro,
                isCurrent && styles.planCardCurrent,
              ]}
            >
              {isPro && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>MOST POPULAR</Text>
                </View>
              )}
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planDesc}>{plan.description}</Text>

              {isEnterprise ? (
                <Text style={styles.planPrice}>Contact Us</Text>
              ) : price ? (
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{formatPlanPrice(price.amount)}</Text>
                  <Text style={styles.priceUnit}>{price.per === 'month' ? '/mo' : ` / ${price.per}`}</Text>
                </View>
              ) : (
                <Text style={styles.planPrice}>Not offered</Text>
              )}

              <Text style={styles.feeLabel}>{plan.platformFeePercent}% fee</Text>

              <View style={styles.featuresList}>
                {[
                  plan.maxActiveCampaigns === -1 ? 'Unlimited campaigns' : `${plan.maxActiveCampaigns} campaign${plan.maxActiveCampaigns > 1 ? 's' : ''}`,
                  // Featured listing, priority support, advanced analytics and
                  // custom branding are not built, so they are not advertised.
                  plan.escrowSupport ? 'Split proceeds' : null,
                  plan.liveStreaming ? 'Live streaming' : null,
                  plan.onBehalfCampaigns ? 'Campaigns on behalf of others' : null,
                  plan.tier !== 'free' && (plan.priceMonthly > 0 || plan.priceYearly > 0) ? 'Creator profile donations (active paid plan)' : null,
                ].filter(Boolean).map((feat) => (
                  <View key={feat} style={styles.featureRow}>
                    <Icon source="check-circle" size={14} color={p.primary} />
                    <Text style={styles.featureItem}>{feat}</Text>
                  </View>
                ))}
              </View>

              {isCurrent ? (
                <>
                  <View style={styles.currentChip}>
                    <Text style={styles.currentChipText}>Current Plan</Text>
                  </View>
                  {canRenew ? (
                    <Button
                      mode="outlined"
                      textColor={p.primary}
                      style={styles.renewButton}
                      onPress={() => setCheckoutTier(tier)}
                    >
                      Renew {plan.name}
                    </Button>
                  ) : null}
                </>
              ) : isFree ? (
                // Web plans end on their own; there is nothing to cancel.
                <Button
                  mode="text"
                  textColor={p.textSecondary}
                  style={styles.planButton}
                  disabled
                >
                  Free after your plan ends
                </Button>
              ) : isEnterprise ? (
                <Button
                  mode="outlined"
                  textColor={p.primary}
                  style={styles.planButton}
                  onPress={() => Linking.openURL(ENTERPRISE_CONTACT)}
                >
                  Contact us
                </Button>
              ) : !price ? (
                <Button
                  mode="text"
                  textColor={p.textSecondary}
                  style={styles.planButton}
                  disabled
                >
                  Not offered
                </Button>
              ) : (
                <Button
                  mode="contained"
                  buttonColor={p.secondary}
                  textColor="#221B0E"
                  style={styles.planButton}
                  onPress={() => setCheckoutTier(tier)}
                  disabled={storeManaged}
                >
                  Choose {plan.name}
                </Button>
              )}
            </View>
            </FadeInUp>
          )
        })}
      </ScrollView>

      {/* Upgrade CTA: the plan an admin marks Popular, else the cheapest one for sale */}
      {cta && (
        <View style={styles.upgradeCta}>
          <View style={styles.upgradeIconTile}>
            <Icon source="crown" size={22} color={p.secondaryDark} />
          </View>
          <Text style={styles.upgradeTitle}>Unlock more with {cta.plan.name}</Text>
          <Text style={styles.upgradeDesc}>
            Lower platform fees on new campaigns, more active campaigns, and premium features. Campaigns you already run keep the fee they were created with. Active paid plans include creator profile donations; creator withdrawals deduct the current plan’s platform-fee percentage. Free plans and trials do not include creator donations.
          </Text>
          <Button
            mode="contained"
            buttonColor={p.secondary}
            textColor="#221B0E"
            style={styles.upgradeButton}
            contentStyle={styles.upgradeButtonContent}
            onPress={() => setCheckoutTier(cta.plan.tier)}
          >
            {cta.label}
          </Button>
        </View>
      )}

      {/* Web plans are one-time purchases: nothing renews, so nothing to cancel. */}
      {paidInForce && !storeManaged && (
        <Text style={styles.renewText}>
          Your plan does not renew automatically. Renew it before {new Date(currentSub.currentPeriodEnd as string).toLocaleDateString()} to keep your benefits; the new time is added after the current period.
        </Text>
      )}
    </ScrollView>

    <CheckoutSheet
      tier={checkoutTier}
      plans={plans}
      current={currentSub}
      visible={checkoutTier !== null && !storeManaged}
      onClose={() => setCheckoutTier(null)}
      onActivated={fetchSubscription}
    />
    </>
  )
}
