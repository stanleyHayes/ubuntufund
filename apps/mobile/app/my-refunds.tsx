import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native'
import { Text, Icon, Button } from 'react-native-paper'
import { Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { brandColors } from '@/theme'

interface Refund {
  id: string
  donationId: string
  // API (MyRefundDTO) sends `campaignName` + `requestDate`; keep the older
  // aliases as fallbacks so both wire shapes render correctly.
  campaignName?: string
  campaignTitle?: string
  amount: number
  currency: string
  status: string
  reason: string
  requestDate?: string
  createdAt?: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: brandColors.warning,
  processing: brandColors.primaryLight,
  completed: brandColors.success,
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
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={[styles.skeletonLine, { width: '40%' }]} />
        <View style={[styles.skeletonLine, { width: 60, height: 22, borderRadius: 6 }]} />
      </View>
      <View style={[styles.skeletonLine, { width: '65%', marginBottom: 6 }]} />
      <View style={[styles.skeletonLine, { width: '30%', height: 10 }]} />
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function MyRefundsScreen() {
  const { user } = useAuth()
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRefunds = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Refund[]>('/refunds/mine')
      setRefunds(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err.message ?? 'Failed to load refunds')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRefunds()
  }, [fetchRefunds])

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Refunds',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
        }}
      />

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Refund Status</Text>
        <Text style={styles.pageTitle}>My Refunds</Text>
        <Text style={styles.pageLede}>Track the status of your refund requests.</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconTile, styles.errorIconTile]}>
              <Icon source="alert-circle-outline" size={24} color={brandColors.error} />
            </View>
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button
              mode="contained"
              buttonColor={brandColors.primary}
              textColor="#FFFFFF"
              onPress={fetchRefunds}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
            >
              Retry
            </Button>
          </View>
        ) : refunds.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconTile}>
              <Icon source="cash-refund" size={24} color={brandColors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No refund requests</Text>
            <Text style={styles.emptySubtitle}>Your refund history will appear here</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {refunds.map((r) => {
              const statusColor = STATUS_COLORS[r.status] ?? brandColors.textSecondary
              return (
                <View key={r.id} style={styles.refundCard}>
                  <View style={styles.refundHeader}>
                    <Text style={styles.refundId}>#{r.id}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.refundCampaign} numberOfLines={1}>
                    {r.campaignName ?? r.campaignTitle ?? 'Campaign'}
                  </Text>

                  <View style={styles.refundFooter}>
                    <Text style={styles.refundAmount}>GH₵ {r.amount.toLocaleString()}</Text>
                    <Text style={styles.refundDate}>{formatDate(r.requestDate ?? r.createdAt)}</Text>
                  </View>

                  <Text style={styles.refundReason}>Reason: {r.reason}</Text>
                </View>
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

  listWrap: { paddingHorizontal: 16, paddingTop: 12 },

  refundCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  refundHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  refundId: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'Outfit_700Bold' },
  refundCampaign: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: brandColors.text, marginBottom: 8 },
  refundFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  refundAmount: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: brandColors.primary },
  refundDate: { fontSize: 12, color: brandColors.textSecondary, fontFamily: 'Outfit_400Regular' },
  refundReason: { fontSize: 12, color: brandColors.textSecondary, fontFamily: 'Outfit_400Regular', fontStyle: 'italic' },

  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
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
