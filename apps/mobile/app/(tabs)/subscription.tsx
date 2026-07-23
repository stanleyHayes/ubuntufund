import { useState, useEffect, useCallback } from 'react'
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { Text, ActivityIndicator, Icon } from 'react-native-paper'
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
      <View style={[styles.container, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

              <TouchableOpacity
                style={[
                  styles.planButton,
                  isCurrent && styles.planButtonCurrent,
                  isPro && !isCurrent && styles.planButtonPro,
                ]}
                disabled={isCurrent || actionLoading}
                onPress={() => handleUpgrade(tier)}
              >
                <Text
                  style={[
                    styles.planButtonText,
                    isCurrent && styles.planButtonTextCurrent,
                    isPro && !isCurrent && styles.planButtonTextPro,
                  ]}
                >
                  {isCurrent ? 'Current Plan' : actionLoading ? 'Processing...' : 'Upgrade'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        })}
      </ScrollView>

      {/* Upgrade CTA */}
      {currentSub.tier === SubscriptionTier.FREE && (
        <View style={styles.upgradeCta}>
          <Text style={styles.upgradeTitle}>Unlock more features</Text>
          <Text style={styles.upgradeDesc}>
            Upgrade to Pro for featured listings, advanced analytics, custom branding, and more.
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            disabled={actionLoading}
            onPress={() => handleUpgrade(SubscriptionTier.PRO)}
          >
            <Text style={styles.upgradeButtonText}>
              {actionLoading ? 'Processing...' : 'Upgrade to Pro'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancel subscription */}
      {currentSub.tier !== SubscriptionTier.FREE && (
        <TouchableOpacity
          style={styles.cancelButton}
          disabled={actionLoading}
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { padding: 20, paddingBottom: 40 },

  // Current plan card
  currentPlanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(46,125,50,0.2)',
  },
  currentPlanLabel: { fontSize: 12, color: '#757575', fontFamily: 'TTSquares-Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  currentPlanName: { fontSize: 24, fontFamily: 'TTSquares-Black', color: '#1a1a1a', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusActive: { backgroundColor: 'rgba(46,125,50,0.1)' },
  statusInactive: { backgroundColor: 'rgba(229,57,53,0.1)' },
  statusText: { fontSize: 11, fontFamily: 'TTSquares-Bold' },
  statusTextActive: { color: '#2E7D32' },
  statusTextInactive: { color: '#E53935' },
  billingText: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#757575' },
  renewText: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#757575', marginBottom: 4 },
  feeText: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#757575' },

  // Section title
  sectionTitle: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 12 },

  // Plans row
  plansRow: { paddingBottom: 8, paddingRight: 20, gap: 12 },

  // Plan card
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: 220,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  planCardPro: { borderColor: brandColors.primary, borderWidth: 2 },
  planCardCurrent: { backgroundColor: 'rgba(46,125,50,0.03)' },
  popularBadge: {
    backgroundColor: brandColors.primary,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  popularText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'TTSquares-Bold' },
  planName: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 4 },
  planDesc: { fontSize: 12, fontFamily: 'TTSquares-Regular', color: '#757575', marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { fontSize: 28, fontFamily: 'TTSquares-Black', color: '#1a1a1a' },
  priceUnit: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#757575', marginLeft: 2 },
  feeLabel: { fontSize: 12, color: brandColors.primary, fontFamily: 'TTSquares-Bold', marginTop: 2, marginBottom: 12 },

  // Features
  featuresList: { marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  featureItem: { fontSize: 12, fontFamily: 'TTSquares-Regular', color: '#424242', flex: 1 },

  // Plan button
  planButton: {
    borderWidth: 1.5,
    borderColor: brandColors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  planButtonCurrent: { borderColor: 'rgba(0,0,0,0.12)', backgroundColor: 'rgba(0,0,0,0.03)' },
  planButtonPro: { backgroundColor: brandColors.primary },
  planButtonText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  planButtonTextCurrent: { color: '#9E9E9E' },
  planButtonTextPro: { color: '#FFFFFF' },

  // Upgrade CTA
  upgradeCta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(46,125,50,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  upgradeTitle: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 8 },
  upgradeDesc: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#757575', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  upgradeButton: {
    backgroundColor: brandColors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  upgradeButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'TTSquares-Bold' },

  // Cancel button
  cancelButton: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 40,
    borderWidth: 1.5,
    borderColor: '#D32F2F',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#D32F2F', fontSize: 15, fontFamily: 'TTSquares-Bold' },
})
