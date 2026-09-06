import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, ScrollView, StyleSheet, Alert } from 'react-native'
import { Text, ActivityIndicator, Icon, Button } from 'react-native-paper'
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  SUBSCRIPTION_PLANS,
} from '@ubuntu-fund/types'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { SignInRequired } from '@/components/SignInRequired'
import { FadeInUp } from '@/components/anim/FadeInUp'

const TIER_ORDER = [SubscriptionTier.FREE, SubscriptionTier.STARTER, SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE]

interface SubscriptionData {
  tier: SubscriptionTier
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

    // Current plan card
    currentPlanCard: {
      ...neu.raised,
      backgroundColor: p.surface,
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
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

export default function SubscriptionScreen() {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const [currentSub, setCurrentSub] = useState<SubscriptionData>(DEFAULT_SUB)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

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

  useEffect(() => {
    if (!user) return
    fetchSubscription()
  }, [user, fetchSubscription])

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

  const currentPlan = SUBSCRIPTION_PLANS[currentSub.tier]

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>MEMBERSHIP</Text>
      <Text style={styles.title}>Manage Your Plan</Text>
      <Text style={styles.lede}>Compare tiers and upgrade anytime.</Text>

      {/* Current plan card */}
      <View style={styles.currentPlanCard}>
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
      </View>

      {/* Plan comparison - horizontal scroll */}
      <Text style={styles.sectionTitle}>Compare Plans</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.plansScroll} contentContainerStyle={styles.plansRow}>
        {TIER_ORDER.map((tier, i) => {
          const plan = SUBSCRIPTION_PLANS[tier]
          const isCurrent = tier === currentSub.tier
          const isPro = tier === SubscriptionTier.PRO
          const isEnterprise = tier === SubscriptionTier.ENTERPRISE

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
              ) : (
                <Button
                  mode="contained"
                  buttonColor={p.secondary}
                  textColor="#221B0E"
                  style={styles.planButton}
                  disabled
                >
                  Billing unavailable
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
          <Text style={styles.upgradeTitle}>Paid plans are not yet available</Text>
          <Text style={styles.upgradeDesc}>
            Paid upgrades will return after verified App Store billing and production payment processing are configured.
          </Text>
          <Button
            mode="contained"
            buttonColor={p.secondary}
            textColor="#221B0E"
            style={styles.upgradeButton}
            contentStyle={styles.upgradeButtonContent}
            disabled
          >
            Billing unavailable
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
  )
}
