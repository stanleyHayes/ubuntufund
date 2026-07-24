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

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  pending: { color: brandColors.warning, bg: 'rgba(185,138,46,0.12)', icon: 'clock-outline', label: 'Pending' },
  approved: { color: brandColors.success, bg: 'rgba(47,107,70,0.10)', icon: 'check-circle', label: 'Approved' },
  rejected: { color: brandColors.error, bg: 'rgba(165,67,47,0.10)', icon: 'close-circle', label: 'Rejected' },
}

function formatDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current
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
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    } catch (err: any) {
      setError(err.message ?? 'Failed to load verifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVerifications()
  }, [fetchVerifications])

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Verification',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Icon source="shield-check" size={20} color={brandColors.primary} />
          <Text style={styles.infoText}>
            Higher verification levels increase your trust score and unlock more features.
          </Text>
        </View>

        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconTile}>
              <Icon source="alert-circle-outline" size={24} color={brandColors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button
              mode="contained"
              onPress={fetchVerifications}
              style={styles.retryButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={brandColors.secondary}
              textColor="#221B0E"
            >
              Retry
            </Button>
          </View>
        ) : verifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconTile}>
              <Icon source="shield-off-outline" size={24} color={brandColors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No verifications yet</Text>
            <Text style={styles.emptySubtitle}>
              Submit verification documents to increase your trust level and unlock platform features.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {verifications.map((v) => {
              const status = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.pending
              return (
                <View key={v.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeIcon, { backgroundColor: `${brandColors.primary}14` }]}>
                      <Icon source={TYPE_ICONS[v.type] ?? 'shield'} size={20} color={brandColors.primary} />
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
                      <Icon source="information" size={14} color={brandColors.error} />
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
                      <Icon source="file-document-outline" size={14} color={brandColors.textSecondary} />
                      <Text style={styles.docText}>
                        {v.documentUrls.length} document{v.documentUrls.length !== 1 ? 's' : ''} submitted
                      </Text>
                    </View>
                  )}
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
  listWrap: { paddingHorizontal: 16, paddingTop: 4 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: 'rgba(46,61,47,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.text, lineHeight: 18 },

  card: {
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: brandColors.text },
  cardType: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, textTransform: 'capitalize', marginTop: 2 },

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
    backgroundColor: 'rgba(165,67,47,0.08)',
    borderRadius: 8,
    marginBottom: 10,
  },
  rejectionText: { flex: 1, fontSize: 12, fontFamily: 'Outfit_400Regular', color: brandColors.error, lineHeight: 16 },

  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardDate: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  docText: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },

  skeletonCard: {
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    padding: 16,
    marginBottom: 12,
  },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  skeletonIcon: { width: 40, height: 40, backgroundColor: 'rgba(168,181,160,0.28)', borderRadius: 10 },
  skeletonLineWide: { width: '60%', height: 14, backgroundColor: 'rgba(168,181,160,0.28)', borderRadius: 4, marginBottom: 6 },
  skeletonLineNarrow: { width: '40%', height: 10, backgroundColor: 'rgba(168,181,160,0.28)', borderRadius: 4 },
  skeletonLineFooter: { width: '80%', height: 10, backgroundColor: 'rgba(168,181,160,0.28)', borderRadius: 4 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(168,181,160,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: brandColors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  retryButton: { borderRadius: 999, marginTop: 16 },
  buttonContent: { paddingVertical: 4 },
  buttonLabel: { fontSize: 14, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
})
