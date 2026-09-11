import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'
import { SignInRequired } from '@/components/SignInRequired'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

interface Verification {
  id: string
  level: number
  type: string
  status: string
  documentUrls: string[]
  rejectionReason?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

// Shape returned by GET /kyc/status (unwrapped from the { data } envelope).
interface KYCStatusResponse {
  kycStatus: string
  kycLevel: number
  verifications: Array<{
    id: string
    type: string
    status: string
    riskLevel?: string
    createdAt: string
  }>
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Email & Phone',
  2: 'National ID',
  3: 'Institutional',
  4: 'Community',
}

// Map a KYC verification type to the display level used by this screen.
const TYPE_LEVELS: Record<string, number> = {
  email_phone: 1,
  national_id: 2,
  institutional: 3,
  community: 4,
}

const TYPE_ICONS: Record<string, string> = {
  email_phone: 'email-check',
  national_id: 'card-account-details',
  institutional: 'domain',
  community: 'account-group',
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
    listWrap: { paddingHorizontal: 16, paddingTop: 4 },

    infoBanner: {
      ...neu.inset,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 12,
      padding: 14,
      backgroundColor: `${p.primary}0F`,
      borderRadius: 12,
    },
    infoText: { flex: 1, fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.text, lineHeight: 18 },

    card: {
      ...neu.raised,
      backgroundColor: p.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    typeIcon: {
      ...neu.subtle,
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text },
    cardType: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textTransform: 'capitalize', marginTop: 2 },

    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    statusText: { fontSize: 12, fontFamily: 'Outfit_700Bold' },

    rejectionBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 10,
      backgroundColor: `${p.error}14`,
      borderRadius: 8,
      marginBottom: 10,
    },
    rejectionText: { flex: 1, fontSize: 12, fontFamily: 'Outfit_400Regular', color: p.error, lineHeight: 16 },

    cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    cardDate: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: p.textSecondary },

    docRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    docText: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: p.textSecondary },

    skeletonCard: {
      ...neu.raised,
      backgroundColor: p.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    skeletonIcon: { width: 40, height: 40, backgroundColor: p.skeleton, borderRadius: 10 },
    skeletonLineWide: { width: '60%', height: 14, backgroundColor: p.skeleton, borderRadius: 4, marginBottom: 6 },
    skeletonLineNarrow: { width: '40%', height: 10, backgroundColor: p.skeleton, borderRadius: 4 },
    skeletonLineFooter: { width: '80%', height: 10, backgroundColor: p.skeleton, borderRadius: 4 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
    emptyIconTile: {
      ...neu.subtle,
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: p.skeleton,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text, textAlign: 'center' },
    emptySubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 },
    retryButton: { borderRadius: 999, marginTop: 16 },
    buttonContent: { paddingVertical: 4 },
    buttonLabel: { fontSize: 14, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonCard() {
  const styles = useStyles()
  const [opacity] = useState(() => new Animated.Value(0.3))
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])
  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonIcon} />
        <View style={{ flex: 1 }}>
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLineNarrow} />
        </View>
      </View>
      <View style={styles.skeletonLineFooter} />
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function VerificationScreen() {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    pending: { color: p.warningText, bg: `${p.warning}1F`, icon: 'clock-outline', label: 'Pending' },
    approved: { color: p.success, bg: `${p.success}1A`, icon: 'check-circle', label: 'Approved' },
    rejected: { color: p.error, bg: `${p.error}1A`, icon: 'close-circle', label: 'Rejected' },
  }

  const fetchVerifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // /kyc/status returns { kycStatus, kycLevel, verifications: [...] }.
      const res = await api.get<KYCStatusResponse>('/kyc/status')
      const records = Array.isArray(res?.verifications) ? res.verifications : []
      setVerifications(
        records.map((r) => ({
          id: r.id,
          level: TYPE_LEVELS[r.type] ?? res?.kycLevel ?? 1,
          type: r.type,
          status: r.status,
          documentUrls: [],
          createdAt: r.createdAt,
          updatedAt: r.createdAt,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchVerifications()
  }, [user, fetchVerifications])

  const headerOptions = {
    title: 'Verification',
    headerStyle: { backgroundColor: p.background },
    headerTintColor: p.text,
    headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <SignInRequired what="verification status" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Icon source="shield-check" size={20} color={p.primary} />
          <Text style={styles.infoText}>
            Higher verification levels increase your trust score and unlock more features.
          </Text>
        </View>

        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </View>
        ) : error ? (
          <EmptyState
            variant="error"
            icon="alert-circle-outline"
            title={error}
            ctaLabel="Retry"
            onCtaPress={fetchVerifications}
          />
        ) : verifications.length === 0 ? (
          <EmptyState
            icon="shield-off-outline"
            title="No verifications yet"
            subtitle="Submit verification documents to increase your trust level and unlock platform features."
          />
        ) : (
          <View style={styles.listWrap}>
            {verifications.map((v, i) => {
              const status = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.pending
              return (
                <FadeInUp key={v.id} index={i}>
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeIcon, { backgroundColor: `${p.primary}14` }]}>
                      <Icon source={TYPE_ICONS[v.type] ?? 'shield'} size={20} color={p.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{LEVEL_LABELS[v.level] ?? `Level ${v.level}`}</Text>
                      <Text style={styles.cardType}>{v.type.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Icon source={status.icon} size={14} color={status.color} />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>

                  {v.status === 'rejected' && v.rejectionReason && (
                    <View style={styles.rejectionBox}>
                      <Icon source="information" size={14} color={p.error} />
                      <Text style={styles.rejectionText}>{v.rejectionReason}</Text>
                    </View>
                  )}

                  <View style={styles.cardMeta}>
                    <Text style={styles.cardDate}>Submitted {formatDate(v.createdAt)}</Text>
                    {v.expiresAt && (
                      <Text style={styles.cardDate}>Expires {formatDate(v.expiresAt)}</Text>
                    )}
                  </View>

                  {v.documentUrls.length > 0 && (
                    <View style={styles.docRow}>
                      <Icon source="file-document-outline" size={14} color={p.textSecondary} />
                      <Text style={styles.docText}>
                        {v.documentUrls.length} document{v.documentUrls.length !== 1 ? 's' : ''} submitted
                      </Text>
                    </View>
                  )}
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
