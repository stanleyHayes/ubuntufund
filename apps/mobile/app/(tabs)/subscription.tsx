import { useState, useEffect, useCallback } from 'react'
import { View, ScrollView, StyleSheet, Alert } from 'react-native'
import { Text, ActivityIndicator, Icon, Button } from 'react-native-paper'
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  SUBSCRIPTION_PLANS,
} from '@ubuntu-fund/types'
import { brandColors } from '@/theme'
import { api } from '@/lib/api'

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

export default function SubscriptionScreen() {
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
    fetchSubscription()
  }, [fetchSubscription])

  const handleUpgrade = async (tier: SubscriptionTier) => {
    setActionLoading(true)
    try {
      await api.post('/subscriptions', { tier, billingCycle: currentSub.billingCycle })
      await fetchSubscription()
      Alert.alert('Success', `Upgraded to ${SUBSCRIPTION_PLANS[tier].name}`)
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upgrade')
    } finally {
      setActionLoading(false)
    }
  }

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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={brandColors.primary} />
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.plansRow}>
        {TIER_ORDER.map((tier) => {
          const plan = SUBSCRIPTION_PLANS[tier]
          const isCurrent = tier === currentSub.tier
          const isPro = tier === SubscriptionTier.PRO
          const isEnterprise = tier === SubscriptionTier.ENTERPRISE

          return (
            <View
              key={tier}
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
                  <Text style={styles.planPrice}>${plan.priceMonthly}</Text>
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
                    <Icon source="check-circle" size={14} color={brandColors.primary} />
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
                  buttonColor={brandColors.secondary}
                  textColor="#221B0E"
                  style={styles.planButton}
                  disabled={actionLoading}
                  onPress={() => handleUpgrade(tier)}
                >
                  {actionLoading ? 'Processing...' : 'Upgrade'}
                </Button>
              )}
            </View>
          )
        })}
      </ScrollView>

      {/* Upgrade CTA */}
      {currentSub.tier === SubscriptionTier.FREE && (
        <View style={styles.upgradeCta}>
          <View style={styles.upgradeIconTile}>
            <Icon source="crown" size={22} color={brandColors.secondaryDark} />
          </View>
          <Text style={styles.upgradeTitle}>Unlock more features</Text>
          <Text style={styles.upgradeDesc}>
            Upgrade to Pro for featured listings, advanced analytics, custom branding, and more.
          </Text>
          <Button
            mode="contained"
            buttonColor={brandColors.secondary}
            textColor="#221B0E"
            style={styles.upgradeButton}
            contentStyle={styles.upgradeButtonContent}
            disabled={actionLoading}
            onPress={() => handleUpgrade(SubscriptionTier.PRO)}
          >
            {actionLoading ? 'Processing...' : 'Upgrade to Pro'}
          </Button>
        </View>
      )}

      {/* Cancel subscription */}
      {currentSub.tier !== SubscriptionTier.FREE && (
        <Button
          mode="outlined"
          textColor={brandColors.error}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  content: { padding: 20, paddingBottom: 40 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  // Header
  eyebrow: {
    fontSize: 11,
    fontFamily: 'TTSquares-Bold',
    color: brandColors.secondaryDark,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: { fontSize: 26, fontFamily: 'TTSquares-Black', color: brandColors.text, marginTop: 4 },
  lede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 6, marginBottom: 20 },

  // Current plan card
  currentPlanCard: {
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  currentPlanLabel: { fontSize: 11, color: brandColors.secondaryDark, fontFamily: 'TTSquares-Bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  currentPlanName: { fontSize: 24, fontFamily: 'TTSquares-Black', color: brandColors.text, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusActive: { backgroundColor: 'rgba(47,107,70,0.12)' },
  statusInactive: { backgroundColor: 'rgba(165,67,47,0.12)' },
  statusText: { fontSize: 11, fontFamily: 'TTSquares-Bold' },
  statusTextActive: { color: brandColors.success },
  statusTextInactive: { color: brandColors.error },
  billingText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },
  renewText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginBottom: 4 },
  feeText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },

  // Section title
  sectionTitle: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: brandColors.text, marginBottom: 12 },

  // Plans row
  plansRow: { paddingBottom: 8, paddingRight: 20, gap: 12 },

  // Plan card
  planCard: {
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    padding: 16,
    width: 220,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  planCardPro: { borderColor: brandColors.primary, borderWidth: 2 },
  planCardCurrent: { backgroundColor: 'rgba(168,181,160,0.12)' },
  popularBadge: {
    backgroundColor: brandColors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  popularText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'TTSquares-Bold', letterSpacing: 0.5 },
  planName: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: brandColors.text, marginBottom: 4 },
  planDesc: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { fontSize: 28, fontFamily: 'TTSquares-Black', color: brandColors.text },
  priceUnit: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginLeft: 2 },
  feeLabel: { fontSize: 12, color: brandColors.primary, fontFamily: 'TTSquares-Bold', marginTop: 2, marginBottom: 12 },

  // Features
  featuresList: { marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  featureItem: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, flex: 1 },

  // Plan button
  planButton: { borderRadius: 999 },
  currentChip: {
    backgroundColor: 'rgba(168,181,160,0.28)',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  currentChipText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: brandColors.text },

  // Upgrade CTA
  upgradeCta: {
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    padding: 24,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    alignItems: 'center',
  },
  upgradeIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(199,162,74,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeTitle: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: brandColors.text, marginBottom: 8 },
  upgradeDesc: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  upgradeButton: { borderRadius: 999, alignSelf: 'stretch' },
  upgradeButtonContent: { paddingVertical: 4 },

  // Cancel button
  cancelButton: {
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 999,
    borderColor: brandColors.error,
  },
})
