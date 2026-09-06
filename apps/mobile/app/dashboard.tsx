import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  type DimensionValue,
} from 'react-native'
import { Text, Icon, TouchableRipple } from 'react-native-paper'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { ProgressBar } from '@/components/ProgressBar'
import { EmptyState } from '@/components/EmptyState'
import { SignInRequired } from '@/components/SignInRequired'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

interface Campaign {
  id: string
  title: string
  status: string
  raisedAmount: number
  goalAmount: number
  currency: string
  creatorId: string
  createdAt: string
}

interface Donation {
  id: string
  amount: number
  currency: string
  campaignTitle?: string
  campaignName?: string
  campaignId: string
  donorName?: string
  // API (MyDonationDTO) sends `date`; keep `createdAt` as a fallback.
  date?: string
  createdAt?: string
  status: string
}

const ghsFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' })

function formatCurrency(amount: number) {
  if (amount >= 1_000_000) return `GH₵ ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `GH₵ ${(amount / 1_000).toFixed(1)}K`
  return ghsFormatter.format(amount)
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonBlock({ w, h, mb = 0 }: { w: DimensionValue; h: number; mb?: number }) {
  const p = usePalette()
  const [opacity] = useState(() => new Animated.Value(0.3))
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start()
  }, [opacity])
  return (
    <Animated.View
      style={{
        width: w,
        height: h,
        backgroundColor: p.skeleton,
        borderRadius: 8,
        marginBottom: mb,
        opacity,
      }}
    />
  )
}

function DashboardSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      {/* Stat boxes */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <SkeletonBlock w="31%" h={80} />
        <SkeletonBlock w="31%" h={80} />
        <SkeletonBlock w="31%" h={80} />
      </View>
      {/* Campaign list */}
      <SkeletonBlock w="50%" h={16} mb={12} />
      <SkeletonBlock w="100%" h={60} mb={8} />
      <SkeletonBlock w="100%" h={60} mb={8} />
      <SkeletonBlock w="100%" h={60} mb={24} />
      {/* Donations list */}
      <SkeletonBlock w="50%" h={16} mb={12} />
      <SkeletonBlock w="100%" h={48} mb={8} />
      <SkeletonBlock w="100%" h={48} mb={8} />
      <SkeletonBlock w="100%" h={48} mb={8} />
    </View>
  )
}

// ─── Quick Action ────────────────────────────────────────────

function QuickAction({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  const p = usePalette()
  const styles = useStyles()
  return (
    <TouchableRipple style={styles.quickAction} rippleColor={p.ripple} onPress={onPress}>
      <>
        <View style={[styles.quickActionIcon, { backgroundColor: `${color}14` }]}>
          <Icon source={icon} size={22} color={color} />
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
      </>
    </TouchableRipple>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const isOrganization = user?.role === 'organization'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalRaised, setTotalRaised] = useState(0)
  const [activeCampaigns, setActiveCampaigns] = useState(0)
  const [totalDonations, setTotalDonations] = useState(0)
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[]>([])
  const [recentDonations, setRecentDonations] = useState<Donation[]>([])

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [campaignsRes, donationsRes] = await Promise.all([
        api.get<Campaign[]>('/campaigns/mine'),
        api.get<Donation[]>('/donations/mine').catch(() => [] as Donation[]),
      ])

      const campaigns = Array.isArray(campaignsRes) ? campaignsRes : []
      const donations = Array.isArray(donationsRes) ? donationsRes : []

      const active = campaigns.filter((c) => c.status === 'active')
      const raised = campaigns.reduce((sum, c) => sum + c.raisedAmount, 0)

      setTotalRaised(raised)
      setActiveCampaigns(active.length)
      setTotalDonations(donations.length)
      setRecentCampaigns(campaigns.slice(0, 3))
      setRecentDonations(donations.slice(0, 5))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchDashboard()
  }, [user, fetchDashboard])

  const headerOptions = {
    title: 'Dashboard',
    headerStyle: { backgroundColor: p.primary },
    headerTintColor: p.onPrimary,
    headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <SignInRequired what="dashboard" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <EmptyState
            variant="error"
            icon="alert-circle-outline"
            title="Couldn't load dashboard"
            subtitle={error}
            ctaLabel="Retry"
            onCtaPress={fetchDashboard}
          />
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Icon source={isOrganization ? 'office-building-outline' : 'account-outline'} size={22} color={p.secondaryDark} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>{isOrganization ? 'Organization workspace' : 'Personal workspace'}</Text>
                <Text style={styles.heroTitle} numberOfLines={1}>{user.name}</Text>
                <Text style={styles.heroBody}>
                  {isOrganization ? 'Manage campaigns, collaborators, and your community impact.' : 'Track your campaigns and giving in one place.'}
                </Text>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <FadeInUp index={0} style={styles.statCardWrap}>
                <View style={styles.statCard}>
                  <Icon source="cash" size={24} color={p.primary} />
                  <Text style={styles.statValue}>{formatCurrency(totalRaised)}</Text>
                  <Text style={styles.statLabel}>Total Raised</Text>
                </View>
              </FadeInUp>
              <FadeInUp index={1} style={styles.statCardWrap}>
                <View style={styles.statCard}>
                  <Icon source="bullhorn" size={24} color={p.success} />
                  <Text style={styles.statValue}>{activeCampaigns}</Text>
                  <Text style={styles.statLabel}>Active Campaigns</Text>
                </View>
              </FadeInUp>
              <FadeInUp index={2} style={styles.statCardWrap}>
                <View style={styles.statCard}>
                  <Icon source="heart" size={24} color={p.error} />
                  <Text style={styles.statValue}>{totalDonations}</Text>
                  <Text style={styles.statLabel}>Donations Made</Text>
                </View>
              </FadeInUp>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsRow}>
              <QuickAction icon="plus-circle" label="Create Campaign" color={p.primary} onPress={() => router.push('/campaign/create')} />
              <QuickAction icon="heart-outline" label="View Donations" color={p.error} onPress={() => router.push('/my-donations')} />
              <QuickAction icon={isOrganization ? 'account-group-outline' : 'account-plus'} label={isOrganization ? 'Collaborators' : 'Invitations'} color={p.secondaryDark} onPress={() => router.push('/invitations')} />
            </View>

            {/* Recent Campaigns */}
            <Text style={styles.sectionTitle}>Recent Campaigns</Text>
            {recentCampaigns.length === 0 ? (
              <Text style={styles.noData}>No campaigns yet</Text>
            ) : (
              <View style={styles.listCard}>
                {recentCampaigns.map((c, i) => {
                  const pct = c.goalAmount > 0 ? Math.min(c.raisedAmount / c.goalAmount, 1) : 0
                  return (
                    <TouchableRipple
                      key={c.id}
                      style={[styles.listRow, i === recentCampaigns.length - 1 && { borderBottomWidth: 0 }]}
                      rippleColor={p.ripple}
                      onPress={() => router.push(`/campaign/${c.id}`)}
                    >
                      <>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listTitle} numberOfLines={1}>{c.title}</Text>
                          <ProgressBar progress={pct} height={4} />
                          <Text style={styles.listSub}>
                            {formatCurrency(c.raisedAmount)} of {formatCurrency(c.goalAmount)}
                          </Text>
                        </View>
                        <Icon source="chevron-right" size={18} color={`${p.text}4D`} />
                      </>
                    </TouchableRipple>
                  )
                })}
              </View>
            )}

            {/* Recent Donations */}
            <Text style={styles.sectionTitle}>Your Recent Donations</Text>
            {recentDonations.length === 0 ? (
              <Text style={styles.noData}>No donations yet</Text>
            ) : (
              <View style={styles.listCard}>
                {recentDonations.map((d, i) => (
                  <View
                    key={d.id}
                    style={[styles.listRow, i === recentDonations.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {d.campaignTitle ?? d.campaignName ?? 'Campaign donation'}
                      </Text>
                      <Text style={styles.listSub}>{formatDate(d.date ?? d.createdAt)}</Text>
                    </View>
                    <Text style={styles.donationAmount}>
                      {formatCurrency(d.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },

    heroCard: { ...neu.greenRaised, flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 18, padding: 16, borderRadius: 18, gap: 12 },
    heroIcon: { ...neu.greenSubtle, width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    heroCopy: { flex: 1 },
    heroEyebrow: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: p.secondary, textTransform: 'uppercase', letterSpacing: 1 },
    heroTitle: { marginTop: 2, fontSize: 20, fontFamily: 'Outfit_700Bold', color: '#FFFFFF' },
    heroBody: { marginTop: 3, fontSize: 12, lineHeight: 17, fontFamily: 'Outfit_400Regular', color: 'rgba(255,255,255,0.72)' },

    statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 20, gap: 10 },
    statCardWrap: { flex: 1 },
    statCard: {
      ...neu.raised,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
    },
    statValue: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: p.text, marginTop: 6 },
    statLabel: { fontSize: 10, color: p.textSecondary, fontFamily: 'Outfit_400Regular', marginTop: 2 },

    sectionTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: p.text, paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },

    quickActionsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
    quickAction: { ...neu.raised, flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
    quickActionIcon: { ...neu.subtle, width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    quickActionLabel: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: p.textSecondary, textAlign: 'center' },

    listCard: { ...neu.raised, marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
    listRow: { flexDirection: 'row', alignItems: 'center', padding: 14, minHeight: 44, borderBottomWidth: 1, borderBottomColor: p.border },
    listTitle: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 4 },
    listSub: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 4 },
    donationAmount: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.success },

    noData: { fontSize: 13, color: p.textSecondary, paddingHorizontal: 20, fontFamily: 'Outfit_400Regular' },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
    emptyIconTile: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(168,181,160,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text, marginTop: 16, textAlign: 'center' },
    emptyBody: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 4, textAlign: 'center' },
    emptyAction: { marginTop: 16, borderRadius: 999 },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}
