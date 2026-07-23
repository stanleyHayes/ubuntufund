import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
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
  status: 'pending' | 'approved' | 'rejected'
  documentUrls: string[]
  rejectionReason?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Email & Phone',
  2: 'National ID',
  3: 'Institutional',
  4: 'Community',
}

const TYPE_ICONS: Record<string, string> = {
  email_phone: 'email-check',
  national_id: 'card-account-details',
  institutional: 'domain',
  community: 'account-group',
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  pending: { color: '#F57F17', bg: 'rgba(245,127,23,0.08)', icon: 'clock-outline', label: 'Pending' },
  approved: { color: '#2E7D32', bg: 'rgba(46,125,50,0.08)', icon: 'check-circle', label: 'Approved' },
  rejected: { color: '#E53935', bg: 'rgba(229,57,53,0.08)', icon: 'close-circle', label: 'Rejected' },
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonCard() {
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View style={{ width: 40, height: 40, backgroundColor: '#E0E0E0', borderRadius: 10 }} />
        <View style={{ flex: 1 }}>
          <View style={{ width: '60%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 6 }} />
          <View style={{ width: '40%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
        </View>
      </View>
      <View style={{ width: '80%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
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
      const res = await api.get<{ data: Verification[] }>('/verifications/mine')
      setVerifications(Array.isArray(res) ? res : res.data ?? [])
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
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
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
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchVerifications} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : verifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="shield-off-outline" size={48} color="#ccc" />
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
                      <Icon source="information" size={14} color="#E53935" />
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
                      <Icon source="file-document-outline" size={14} color="#999" />
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
  container: { flex: 1, backgroundColor: '#F8F8F4' },
  listWrap: { paddingHorizontal: 16, paddingTop: 4 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: 'rgba(46,125,50,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(46,125,50,0.12)',
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#444', lineHeight: 18 },

  card: {
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#1a1a1a' },
  cardType: { fontSize: 12, fontFamily: 'TTSquares-Regular', color: '#999', textTransform: 'capitalize', marginTop: 2 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontFamily: 'TTSquares-Bold' },

  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(229,57,53,0.06)',
    borderRadius: 8,
    marginBottom: 10,
  },
  rejectionText: { flex: 1, fontSize: 12, fontFamily: 'TTSquares-Regular', color: '#C62828', lineHeight: 16 },

  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardDate: { fontSize: 11, fontFamily: 'TTSquares-Regular', color: '#ccc' },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  docText: { fontSize: 12, fontFamily: 'TTSquares-Regular', color: '#999' },

  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#666', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 6, textAlign: 'center', lineHeight: 18 },
})
