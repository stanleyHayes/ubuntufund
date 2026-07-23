import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import { Text, Icon, Button } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { ProgressBar } from '@/components/ProgressBar'
import { brandColors } from '@/theme'

const { width } = Dimensions.get('window')

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
  campaignId: string
  donorName?: string
  createdAt: string
  status: string
}

function formatCurrency(amount: number) {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
  return `$${amount.toLocaleString()}`
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonBlock({ w, h, mb = 0 }: { w: number | string; h: number; mb?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start()
  }, [])
  return (
    <Animated.View
      style={{
        width: w as any,
        height: h,
        backgroundColor: '#E0E0E0',
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
        <SkeletonBlock w={'31%' as any} h={80} />
        <SkeletonBlock w={'31%' as any} h={80} />
        <SkeletonBlock w={'31%' as any} h={80} />
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
  return (
    <TouchableOpacity style={styles.quickAction} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}14` }]}>
        <Icon source={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
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
      const [campaigns, donations] = await Promise.all([
        api.get<Campaign[]>('/campaigns').catch(() => [] as Campaign[]),
        api.get<Donation[]>('/donations').catch(() => [] as Donation[]),
      ])

      const myCampaigns = campaigns.filter((c) => c.creatorId === user?.id)
      const active = myCampaigns.filter((c) => c.status === 'active')
      const raised = myCampaigns.reduce((sum, c) => sum + c.raisedAmount, 0)

      setTotalRaised(raised)
      setActiveCampaigns(active.length)
      setTotalDonations(donations.length)
      setRecentCampaigns(myCampaigns.slice(0, 3))
      setRecentDonations(donations.slice(0, 5))
    } catch (err: any) {
      setError(err.message ?? 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Dashboard',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <View style={styles.emptyState}>
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchDashboard} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Icon source="currency-usd" size={24} color={brandColors.primary} />
                <Text style={styles.statValue}>{formatCurrency(totalRaised)}</Text>
                <Text style={styles.statLabel}>Total Raised</Text>
              </View>
              <View style={styles.statCard}>
                <Icon source="bullhorn" size={24} color="#1565C0" />
                <Text style={styles.statValue}>{activeCampaigns}</Text>
                <Text style={styles.statLabel}>Active Campaigns</Text>
              </View>
              <View style={styles.statCard}>
                <Icon source="heart" size={24} color="#E53935" />
                <Text style={styles.statValue}>{totalDonations}</Text>
                <Text style={styles.statLabel}>Total Donations</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsRow}>
              <QuickAction icon="plus-circle" label="Create Campaign" color={brandColors.primary} onPress={() => router.push('/campaign/create')} />
              <QuickAction icon="heart-outline" label="View Donations" color="#E53935" onPress={() => router.push('/my-donations')} />
              <QuickAction icon="account-plus" label="Invite" color="#1565C0" onPress={() => router.push('/invitations')} />
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
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.listRow, i === recentCampaigns.length - 1 && { borderBottomWidth: 0 }]}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/campaign/${c.id}`)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle} numberOfLines={1}>{c.title}</Text>
                        <ProgressBar progress={pct} height={4} />
                        <Text style={styles.listSub}>
                          {formatCurrency(c.raisedAmount)} of {formatCurrency(c.goalAmount)}
                        </Text>
                      </View>
                      <Icon source="chevron-right" size={18} color="#ccc" />
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Recent Donations */}
            <Text style={styles.sectionTitle}>Recent Donations Received</Text>
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
                        {d.donorName ?? 'Anonymous'}
                      </Text>
                      <Text style={styles.listSub}>{formatDate(d.createdAt)}</Text>
                    </View>
                    <Text style={styles.donationAmount}>
                      +{d.currency ?? '$'}{d.amount}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F4' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 18, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginTop: 6 },
  statLabel: { fontSize: 10, color: '#999', fontFamily: 'TTSquares-Regular', marginTop: 2 },

  sectionTitle: { fontSize: 17, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },

  quickActionsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  quickAction: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickActionLabel: { fontSize: 11, fontFamily: 'TTSquares-Bold', color: '#555', textAlign: 'center' },

  listCard: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  listTitle: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 4 },
  listSub: { fontSize: 11, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 4 },
  donationAmount: { fontSize: 15, fontFamily: 'TTSquares-Bold', color: brandColors.primary },

  noData: { fontSize: 13, color: '#999', paddingHorizontal: 20, fontFamily: 'TTSquares-Regular' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#666', marginTop: 16, textAlign: 'center' },
})
