import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, ScrollView, StyleSheet, Alert, Modal } from 'react-native'
import { Text, ActivityIndicator, Icon, Button, TextInput, TouchableRipple } from 'react-native-paper'
import { useFocusEffect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import {
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionCheckoutStatus,
  BillingCycle,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
  type CouponPreview,
} from '@ubuntu-fund/types'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { api } from '@/lib/api'
import {
  createSubscriptionCheckout,
  getSubscriptionCheckoutStatus,
  isPaymentsNotConfigured,
} from '@/lib/subscriptions'
import { previewCoupon } from '@/lib/coupons'
import { useAuth } from '@/context/AuthContext'
import { SignInRequired } from '@/components/SignInRequired'
import { GlassSurface } from '@/components/GlassSurface'
import { FadeInUp } from '@/components/anim/FadeInUp'

const ENTERPRISE_CONTACT = 'mailto:hello@ujimora.com?subject=Enterprise%20plan%20enquiry'
const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 15 // ~30s

function formatGhs(n: number): string {
  return `GH₵ ${n.toFixed(2)}`
}

/** Order plans cheapest → richest by the admin-set sortOrder. */
function bySortOrder(a: SubscriptionPlan, b: SubscriptionPlan): number {
  return a.sortOrder - b.sortOrder || a.priceMonthly - b.priceMonthly
}

interface SubscriptionData {
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
  visible,
  onClose,
  onActivated,
}: {
  tier: string | null
  plans: Record<string, SubscriptionPlan>
  visible: boolean
  onClose: () => void
  onActivated: () => Promise<void> | void
}) {
  const p = usePalette()
  const styles = useStyles()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY)
  const [couponCode, setCouponCode] = useState('')
  const [preview, setPreview] = useState<CouponPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  // Reset the sheet each time it opens for a plan.
  useEffect(() => {
    if (visible) {
      setBillingCycle(BillingCycle.MONTHLY)
      setCouponCode('')
      setPreview(null)
      setError(null)
      setSubmitting(false)
    }
  }, [visible, tier])

  // Debounced coupon preview (soft endpoint — never throws).
  useEffect(() => {
    if (!tier) return
    const code = couponCode.trim()
    if (!code) {
      setPreview(null)
      setPreviewing(false)
      return
    }
    const id = ++reqId.current
    setPreviewing(true)
    const timer = setTimeout(async () => {
      try {
        const result = await previewCoupon({ code, tier, billingCycle })
        if (id === reqId.current) setPreview(result)
      } catch {
        if (id === reqId.current) setPreview(null)
      } finally {
        if (id === reqId.current) setPreviewing(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [couponCode, tier, billingCycle])

  if (!tier) return null

  const plan = plans[tier]
  if (!plan) return null
  const baseAmount = billingCycle === BillingCycle.YEARLY ? plan.priceYearly : plan.priceMonthly
  const validCoupon = preview?.valid ? preview : null
  const finalAmount = validCoupon ? validCoupon.finalAmount : baseAmount
  const discount = validCoupon ? validCoupon.discountAmount : 0
  const payLabel = finalAmount === 0 ? 'Activate plan' : `Pay ${formatGhs(finalAmount)}`

  const handleCheckout = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await createSubscriptionCheckout({
        tier,
        billingCycle,
        couponCode: couponCode.trim() || undefined,
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
            "Your payment didn't go through and you haven't been charged. Please try again.",
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
        setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
    >
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{plan.name} plan</Text>
          <Text style={styles.sheetSub}>{plan.description}</Text>

          {/* Billing cycle */}
          <View style={styles.cycleRow}>
            {[BillingCycle.MONTHLY, BillingCycle.YEARLY].map((cycle) => {
              const active = billingCycle === cycle
              const amount = cycle === BillingCycle.YEARLY ? plan.priceYearly : plan.priceMonthly
              return (
                <TouchableRipple
                  key={cycle}
                  style={[styles.cycleOption, active && styles.cycleOptionActive]}
                  rippleColor={p.ripple}
                  onPress={() => setBillingCycle(cycle)}
                  accessibilityState={{ selected: active }}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.cycleText, active && styles.cycleTextActive]}>
                      {cycle === BillingCycle.YEARLY ? 'Yearly' : 'Monthly'}
                    </Text>
                    <Text style={[styles.cycleHint, active && styles.cycleHintActive]}>
                      {formatGhs(amount)}
                      {cycle === BillingCycle.YEARLY ? '/yr' : '/mo'}
                    </Text>
                  </View>
                </TouchableRipple>
              )
            })}
          </View>

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
                <TextInput.Icon icon={() => <ActivityIndicator size={16} color={p.primary} />} />
              ) : undefined
            }
          />
          {preview && !preview.valid && couponCode.trim() ? (
            <Text style={styles.couponError}>{preview.reason ?? "This coupon can't be applied."}</Text>
          ) : null}

          {/* Price summary */}
          <View style={styles.priceSummary}>
            <View style={styles.priceLine}>
              <Text style={styles.priceLabel}>Plan</Text>
              <Text style={discount > 0 ? styles.priceBase : styles.priceValue}>{formatGhs(baseAmount)}</Text>
            </View>
            {discount > 0 ? (
              <>
                <View style={styles.priceLine}>
                  <Text style={styles.priceLabel}>Discount</Text>
                  <Text style={[styles.priceValue, { color: p.success }]}>-{formatGhs(discount)}</Text>
                </View>
                <Text style={styles.savingLine}>Coupon applied — you save {formatGhs(discount)}</Text>
              </>
            ) : null}
            <View style={styles.priceLine}>
              <Text style={styles.priceLabel}>Total</Text>
              <Text style={styles.priceFinal}>{formatGhs(finalAmount)}</Text>
            </View>
          </View>

          {error ? <Text style={styles.couponError}>{error}</Text> : null}

          <Button
            mode="contained"
            buttonColor={p.primary}
            textColor={p.onPrimary}
            style={styles.payButton}
            contentStyle={styles.payButtonContent}
            loading={submitting}
            disabled={submitting}
            onPress={handleCheckout}
            accessibilityLabel={payLabel}
          >
            {payLabel}
          </Button>
          <TouchableRipple style={styles.sheetCancel} onPress={submitting ? undefined : onClose}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableRipple>
        </View>
      </View>
    </Modal>
  )
}

export default function SubscriptionScreen() {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const [currentSub, setCurrentSub] = useState<SubscriptionData>(DEFAULT_SUB)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null)
  // DB-backed plans (seeded from SUBSCRIPTION_PLANS, overlaid from GET /plans) so
  // admin-added tiers appear here too.
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>(SUBSCRIPTION_PLANS)

  const fetchSubscription = useCallback(async () => {
    try {
      const data = await api.get<SubscriptionData>('/subscriptions/mine')
      setCurrentSub(data)
    } catch {
      // If no subscription found, keep default (FREE)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Refetch whenever the tab regains focus, so a subscription that settled via
  // the Paystack webhook (after our ~30s poll window) is reflected without an
  // app relaunch. Runs on first focus too, replacing the old mount effect.
  useFocusEffect(
    useCallback(() => {
      if (user) fetchSubscription()
    }, [user, fetchSubscription]),
  )

  // Overlay the live, admin-managed plans over the seeded defaults.
  useEffect(() => {
    let cancelled = false
    api
      .get<SubscriptionPlan[]>('/plans')
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return
        setPlans((current) => {
          const next = { ...current }
          for (const pl of data) if (pl && pl.tier) next[pl.tier] = pl
          return next
        })
      })
      .catch(() => {
        // Keep the seeded defaults on failure.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCancel = async () => {
    Alert.alert('Cancel Subscription', 'Are you sure you want to cancel?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true)
          try {
            await api.post('/subscriptions/cancel')
            await fetchSubscription()
            Alert.alert('Cancelled', 'Your subscription has been cancelled.')
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel')
          } finally {
            setActionLoading(false)
          }
        },
      },
    ])
  }

  const orderedPlans = Object.values(plans)
    .filter((pl) => pl.active !== false && pl.isPublic !== false)
    .sort(bySortOrder)
  const currentPlan = plans[currentSub.tier] ?? SUBSCRIPTION_PLANS[SubscriptionTier.FREE]

  if (!user) {
    return (
      <View style={styles.container}>
        <SignInRequired what="subscription" />
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={p.primary} />
      </View>
    )
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>MEMBERSHIP</Text>
      <Text style={styles.title}>Manage Your Plan</Text>
      <Text style={styles.lede}>Compare tiers and upgrade anytime.</Text>

      {/* Current plan card */}
      <GlassSurface variant="raised" style={styles.currentPlanCard}>
        <Text style={styles.currentPlanLabel}>Current Plan</Text>
        <Text style={styles.currentPlanName}>{currentPlan.name}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, currentSub.status === SubscriptionStatus.ACTIVE ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, currentSub.status === SubscriptionStatus.ACTIVE ? styles.statusTextActive : styles.statusTextInactive]}>
              {currentSub.status.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.billingText}>
            {currentSub.billingCycle === BillingCycle.MONTHLY ? 'Monthly' : 'Yearly'}
          </Text>
        </View>
        <Text style={styles.renewText}>
          Renews: {currentSub.renewDate}
        </Text>
        <Text style={styles.feeText}>
          {currentPlan.platformFeePercent}% platform fee | {currentPlan.maxActiveCampaigns === -1 ? 'Unlimited' : currentPlan.maxActiveCampaigns} campaigns
        </Text>
      </GlassSurface>

      {/* Plan comparison - horizontal scroll */}
      <Text style={styles.sectionTitle}>Compare Plans</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plansScroll} contentContainerStyle={styles.plansRow}>
        {orderedPlans.map((plan, i) => {
          const tier = plan.tier
          const isCurrent = tier === currentSub.tier
          const isPro = plan.popular === true
          const isEnterprise = tier === SubscriptionTier.ENTERPRISE
          const isFree = plan.priceMonthly === 0

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
              ) : (
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>GH₵ {plan.priceMonthly}</Text>
                  <Text style={styles.priceUnit}>/mo</Text>
                </View>
              )}

              <Text style={styles.feeLabel}>{plan.platformFeePercent}% fee</Text>

              <View style={styles.featuresList}>
                {[
                  plan.maxActiveCampaigns === -1 ? 'Unlimited campaigns' : `${plan.maxActiveCampaigns} campaign${plan.maxActiveCampaigns > 1 ? 's' : ''}`,
                  plan.featuredListing ? 'Featured listing' : null,
                  plan.prioritySupport ? 'Priority support' : null,
                  plan.advancedAnalytics ? 'Advanced analytics' : null,
                  plan.customBranding ? 'Custom branding' : null,
                  plan.escrowSupport ? 'Escrow support' : null,
                  plan.liveStreaming ? 'Live streaming' : null,
                  plan.tier !== 'free' && (plan.priceMonthly > 0 || plan.priceYearly > 0) ? 'Creator profile donations (active paid plan)' : null,
                ].filter(Boolean).map((feat) => (
                  <View key={feat} style={styles.featureRow}>
                    <Icon source="check-circle" size={14} color={p.primary} />
                    <Text style={styles.featureItem}>{feat}</Text>
                  </View>
                ))}
              </View>

              {isCurrent ? (
                <View style={styles.currentChip}>
                  <Text style={styles.currentChipText}>Current Plan</Text>
                </View>
              ) : isFree ? (
                <Button
                  mode="text"
                  textColor={p.textSecondary}
                  style={styles.planButton}
                  onPress={handleCancel}
                >
                  Switch to Free
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
              ) : (
                <Button
                  mode="contained"
                  buttonColor={p.secondary}
                  textColor="#221B0E"
                  style={styles.planButton}
                  onPress={() => setCheckoutTier(tier)}
                >
                  Choose {plan.name}
                </Button>
              )}
            </View>
            </FadeInUp>
          )
        })}
      </ScrollView>

      {/* Upgrade CTA */}
      {currentSub.tier === SubscriptionTier.FREE && (
        <View style={styles.upgradeCta}>
          <View style={styles.upgradeIconTile}>
            <Icon source="crown" size={22} color={p.secondaryDark} />
          </View>
          <Text style={styles.upgradeTitle}>Unlock more with Pro</Text>
          <Text style={styles.upgradeDesc}>
            Lower platform fees, more active campaigns, and premium features. Active paid plans include creator profile donations; creator withdrawals deduct the current plan’s platform-fee percentage. Free plans and trials do not include creator donations.
          </Text>
          <Button
            mode="contained"
            buttonColor={p.secondary}
            textColor="#221B0E"
            style={styles.upgradeButton}
            contentStyle={styles.upgradeButtonContent}
            onPress={() => setCheckoutTier(SubscriptionTier.PRO)}
          >
            Upgrade to Pro
          </Button>
        </View>
      )}

      {/* Cancel subscription */}
      {currentSub.tier !== SubscriptionTier.FREE && (
        <Button
          mode="outlined"
          textColor={p.error}
          style={styles.cancelButton}
          disabled={actionLoading}
          onPress={handleCancel}
        >
          Cancel Subscription
        </Button>
      )}
    </ScrollView>

    <CheckoutSheet
      tier={checkoutTier}
      plans={plans}
      visible={checkoutTier !== null}
      onClose={() => setCheckoutTier(null)}
      onActivated={fetchSubscription}
    />
    </>
  )
}
