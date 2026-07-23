import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native'
import { Text, Icon, Button } from 'react-native-paper'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { brandColors } from '@/theme'

interface Refund {
  id: string
  donationId: string
  campaignTitle?: string
  amount: number
  currency: string
  status: string
  reason: string
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F57F17',
  processing: '#1565C0',
  completed: '#2E7D32',
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
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ width: '40%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
        <View style={{ width: 60, height: 22, backgroundColor: '#E0E0E0', borderRadius: 6 }} />
      </View>
      <View style={{ width: '65%', height: 12, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 6 }} />
      <View style={{ width: '30%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
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
      setRefunds(data)
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
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchRefunds} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : refunds.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="cash-refund" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No refund requests</Text>
            <Text style={styles.emptySubtitle}>Your refund history will appear here</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {refunds.map((r) => {
              const statusColor = STATUS_COLORS[r.status] ?? '#78909C'
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
                    {r.campaignTitle ?? 'Campaign'}
                  </Text>

                  <View style={styles.refundFooter}>
                    <Text style={styles.refundAmount}>{r.currency ?? '$'}{r.amount}</Text>
                    <Text style={styles.refundDate}>{formatDate(r.createdAt)}</Text>
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
  container: { flex: 1, backgroundColor: '#F8F8F4' },
  listWrap: { paddingHorizontal: 16, paddingTop: 16 },

  refundCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  refundHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  refundId: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: '#999' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: 'TTSquares-Bold' },
  refundCampaign: { fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 8 },
  refundFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  refundAmount: { fontSize: 17, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  refundDate: { fontSize: 12, color: '#999', fontFamily: 'TTSquares-Regular' },
  refundReason: { fontSize: 12, color: '#78909C', fontFamily: 'TTSquares-Regular', fontStyle: 'italic' },

  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#666', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 6, textAlign: 'center' },
})
