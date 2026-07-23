import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native'
import { Text, Icon, Chip, Button } from 'react-native-paper'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { brandColors } from '@/theme'

interface Donation {
  id: string
  amount: number
  currency: string
  campaignId: string
  campaignTitle?: string
  status: string
  paymentMethod?: string
  createdAt: string
}

const FILTER_TABS = ['All', 'Completed', 'Pending', 'Refunded'] as const
type FilterTab = (typeof FILTER_TABS)[number]

const STATUS_COLORS: Record<string, string> = {
  completed: '#2E7D32',
  pending: '#F57F17',
  refunded: '#1565C0',
  failed: '#E53935',
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
        <View style={{ width: '60%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 6 }} />
        <View style={{ width: '40%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
      </View>
      <View style={{ width: 60, height: 14, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
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
      const data = await api.get<Donation[]>('/donations')
      setDonations(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load donations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDonations()
  }, [fetchDonations])

  const filtered = activeFilter === 'All'
    ? donations
    : donations.filter((d) => d.status.toLowerCase() === activeFilter.toLowerCase())

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Donations',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            activeOpacity={0.7}
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
          <View style={styles.emptyState}>
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchDonations} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="heart-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No donations found</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter !== 'All' ? `No ${activeFilter.toLowerCase()} donations` : 'Your donation history will appear here'}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filtered.map((d) => {
              const statusColor = STATUS_COLORS[d.status] ?? '#78909C'
              const canRefund = d.status === 'completed'
              return (
                <TouchableOpacity
                  key={d.id}
                  style={styles.donationCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/campaign/${d.campaignId}`)}
                >
                  <View style={styles.donationHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.donationCampaign} numberOfLines={1}>
                        {d.campaignTitle ?? 'Campaign'}
                      </Text>
                      <Text style={styles.donationDate}>{formatDate(d.createdAt)}</Text>
                    </View>
                    <Text style={styles.donationAmount}>
                      {d.currency ?? '$'}{d.amount}
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
                        onPress={() => router.push({ pathname: '/refund-request', params: { donationId: d.id } })}
                      >
                        <Text style={styles.refundBtnText}>Request Refund</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F4' },

  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  filterTabActive: { backgroundColor: brandColors.primary, borderColor: brandColors.primary },
  filterTabText: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: '#666' },
  filterTabTextActive: { color: '#fff' },

  listWrap: { paddingHorizontal: 16 },

  donationCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  donationHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  donationCampaign: { fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#1a1a1a' },
  donationDate: { fontSize: 11, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 2 },
  donationAmount: { fontSize: 17, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  donationFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText: { fontSize: 11, fontFamily: 'TTSquares-Bold' },
  paymentMethod: { fontSize: 11, color: '#999', fontFamily: 'TTSquares-Regular' },
  refundBtn: { marginLeft: 'auto' },
  refundBtnText: { fontSize: 12, fontFamily: 'TTSquares-Bold', color: '#E53935' },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#666', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 6, textAlign: 'center' },
})
