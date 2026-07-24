import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native'
import { Text } from 'react-native-paper'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'
import { SignInRequired } from '@/components/SignInRequired'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { brandColors } from '@/theme'

interface Donation {
  id: string
  amount: number
  currency: string
  campaignId: string
  // API (MyDonationDTO) sends `campaignName` + `date`; keep the older aliases
  // as fallbacks so both wire shapes render correctly.
  campaignName?: string
  campaignTitle?: string
  status: string
  paymentMethod?: string
  date?: string
  createdAt?: string
}

const FILTER_TABS = ['All', 'Completed', 'Pending', 'Refunded'] as const
type FilterTab = (typeof FILTER_TABS)[number]

const STATUS_COLORS: Record<string, string> = {
  completed: brandColors.success,
  pending: brandColors.warning,
  refunded: brandColors.primaryLight,
  failed: brandColors.error,
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonRow() {
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
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={{ flex: 1 }}>
        <View style={[styles.skeletonLine, { width: '60%', marginBottom: 6 }]} />
        <View style={[styles.skeletonLine, { width: '40%', height: 10 }]} />
      </View>
      <View style={[styles.skeletonLine, { width: 60 }]} />
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function MyDonationsScreen() {
  const { user } = useAuth()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All')

  const fetchDonations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Donation[]>('/donations/mine')
      setDonations(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err.message ?? 'Failed to load donations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchDonations()
  }, [user, fetchDonations])

  const filtered = activeFilter === 'All'
    ? donations
    : donations.filter((d) => d.status.toLowerCase() === activeFilter.toLowerCase())

  const headerOptions = {
    title: 'My Donations',
    headerStyle: { backgroundColor: brandColors.primary },
    headerTintColor: '#FFFFFF',
    headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <SignInRequired what="donations" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Giving History</Text>
        <Text style={styles.pageTitle}>My Donations</Text>
        <Text style={styles.pageLede}>Every contribution you've made, in one place.</Text>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </View>
        ) : error ? (
          <EmptyState
            variant="error"
            icon="alert-circle-outline"
            title={error}
            ctaLabel="Retry"
            onCtaPress={fetchDonations}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No donations found"
            subtitle={activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} donations` : 'Your donation history will appear here'}
          />
        ) : (
          <View style={styles.listWrap}>
            {filtered.map((d, i) => {
              const statusColor = STATUS_COLORS[d.status] ?? brandColors.textSecondary
              const canRefund = d.status === 'completed'
              return (
                <FadeInUp key={d.id} index={i}>
                <TouchableOpacity
                  style={styles.donationCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/campaign/${d.campaignId}`)}
                >
                  <View style={styles.donationHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.donationCampaign} numberOfLines={1}>
                        {d.campaignName ?? d.campaignTitle ?? 'Campaign'}
                      </Text>
                      <Text style={styles.donationDate}>{formatDate(d.date ?? d.createdAt)}</Text>
                    </View>
                    <Text style={styles.donationAmount}>
                      GH₵ {d.amount.toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.donationFooter}>
                    <View style={[styles.statusChip, { backgroundColor: `${statusColor}18` }]}>
                      <Text style={[styles.statusChipText, { color: statusColor }]}>
                        {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      </Text>
                    </View>
                    {d.paymentMethod && (
                      <Text style={styles.paymentMethod}>{d.paymentMethod}</Text>
                    )}
                    {canRefund && (
                      <TouchableOpacity
                        style={styles.refundBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        onPress={() => router.push({ pathname: '/refund-request', params: { donationId: d.id } })}
                      >
                        <Text style={styles.refundBtnText}>Request Refund</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
                </FadeInUp>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },

  headerBlock: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  eyebrow: { fontSize: 11, fontFamily: 'Outfit_700Bold', fontWeight: '700', color: brandColors.secondaryDark, textTransform: 'uppercase', letterSpacing: 2 },
  pageTitle: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: brandColors.text, marginTop: 4 },
  pageLede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 4 },

  filterScroll: { flexGrow: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  filterTab: { height: 38, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(26,46,34,0.10)' },
  filterTabActive: { backgroundColor: brandColors.primary, borderColor: brandColors.primary },
  filterTabText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary },
  filterTabTextActive: { color: '#fff' },

  listWrap: { paddingHorizontal: 16 },

  donationCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  donationHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  donationCampaign: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: brandColors.text },
  donationDate: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 2 },
  donationAmount: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: brandColors.primary },
  donationFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText: { fontSize: 11, fontFamily: 'Outfit_700Bold' },
  paymentMethod: { fontSize: 11, color: brandColors.textSecondary, fontFamily: 'Outfit_400Regular' },
  refundBtn: { marginLeft: 'auto' },
  refundBtnText: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: brandColors.error },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  skeletonLine: { height: 14, backgroundColor: 'rgba(168,181,160,0.35)', borderRadius: 4 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 32 },
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168,181,160,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorIconTile: { backgroundColor: 'rgba(165,67,47,0.14)' },
  emptyTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: brandColors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 6, textAlign: 'center' },
  actionBtn: { marginTop: 16, borderRadius: 999 },
  btnLabel: { fontFamily: 'Outfit_700Bold' },
})
