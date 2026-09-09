import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native'
import { Text } from 'react-native-paper'
import { Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'
import { SignInRequired } from '@/components/SignInRequired'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

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

function formatDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },

    headerBlock: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
    eyebrow: { fontSize: 11, fontFamily: 'Outfit_700Bold', fontWeight: '700', color: p.secondaryDark, textTransform: 'uppercase', letterSpacing: 2 },
    pageTitle: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: p.text, marginTop: 4 },
    pageLede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 4 },

    listWrap: { paddingHorizontal: 16, paddingTop: 12 },

    refundCard: {
      ...neu.raised,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    refundHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    refundId: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: p.textSecondary },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 5 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontFamily: 'Outfit_700Bold' },
    refundCampaign: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 8 },
    refundFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    refundAmount: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: p.primary },
    refundDate: { fontSize: 12, color: p.textSecondary, fontFamily: 'Outfit_400Regular' },
    refundReason: { fontSize: 12, color: p.textSecondary, fontFamily: 'Outfit_400Regular', fontStyle: 'italic' },

    skeletonCard: {
      ...neu.raised,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    skeletonLine: { height: 14, backgroundColor: p.skeleton, borderRadius: 4 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 32 },
    emptyIconTile: {
      ...neu.subtle,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: p.skeleton,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    errorIconTile: { backgroundColor: `${p.error}24` },
    emptyTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text, textAlign: 'center' },
    emptySubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 6, textAlign: 'center' },
    actionBtn: { marginTop: 16, borderRadius: 999 },
    btnLabel: { fontFamily: 'Outfit_700Bold' },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonRow() {
  const styles = useStyles()
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
  const p = usePalette()
  const styles = useStyles()
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const STATUS_COLORS: Record<string, string> = {
    pending: p.warning,
    processing: p.primaryLight,
    completed: p.success,
    failed: p.error,
  }

  const fetchRefunds = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Refund[]>('/refunds/mine')
      setRefunds(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load refunds')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchRefunds()
  }, [user, fetchRefunds])

  const headerOptions = {
    title: 'My Refunds',
    headerStyle: { backgroundColor: p.background },
    headerTintColor: p.text,
    headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <SignInRequired what="refunds" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

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
          <EmptyState
            variant="error"
            icon="alert-circle-outline"
            title={error}
            ctaLabel="Retry"
            onCtaPress={fetchRefunds}
          />
        ) : refunds.length === 0 ? (
          <EmptyState
            icon="cash-refund"
            title="No refund requests"
            subtitle="Your refund history will appear here"
          />
        ) : (
          <View style={styles.listWrap}>
            {refunds.map((r, i) => {
              const statusColor = STATUS_COLORS[r.status] ?? p.textSecondary
              return (
                <FadeInUp key={r.id} index={i}>
                <View style={styles.refundCard}>
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
                </FadeInUp>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
