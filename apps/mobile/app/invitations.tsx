import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Text, Icon, Button, ActivityIndicator } from 'react-native-paper'
import { Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { brandColors } from '@/theme'

interface Invitation {
  id: string
  campaignName: string
  inviterName: string
  role: string
  revenueShare?: number
  createdAt: string
  status: string
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
      <View style={{ width: '70%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 8 }} />
      <View style={{ width: '45%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 6 }} />
      <View style={{ width: '55%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 100, height: 36, backgroundColor: '#E0E0E0', borderRadius: 8 }} />
        <View style={{ width: 100, height: 36, backgroundColor: '#E0E0E0', borderRadius: 8 }} />
      </View>
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function InvitationsScreen() {
  const { user } = useAuth()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [responding, setResponding] = useState<string | null>(null)

  const fetchInvitations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Invitation[]>('/collaborations/invitations')
      setInvitations(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  const handleRespond = async (id: string, accept: boolean) => {
    setResponding(id)
    try {
      await api.put(`/collaborations/${id}/respond`, { accept })
      setInvitations((prev) => prev.filter((inv) => inv.id !== id))
      Alert.alert(
        accept ? 'Accepted' : 'Declined',
        accept ? 'You have joined the collaboration.' : 'Invitation declined.',
      )
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to respond to invitation.')
    } finally {
      setResponding(null)
    }
  }

  const pending = invitations.filter((inv) => inv.status === 'pending')

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Invitations',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchInvitations} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : pending.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="email-open-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No pending invitations</Text>
            <Text style={styles.emptySubtitle}>
              When someone invites you to collaborate on a campaign, it will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {pending.map((inv) => (
              <View key={inv.id} style={styles.invCard}>
                <Text style={styles.invCampaign} numberOfLines={1}>{inv.campaignName}</Text>

                <View style={styles.invDetail}>
                  <Icon source="account" size={14} color="#999" />
                  <Text style={styles.invDetailText}>Invited by {inv.inviterName}</Text>
                </View>

                <View style={styles.invDetail}>
                  <Icon source="shield-account" size={14} color="#999" />
                  <Text style={styles.invDetailText}>
                    Role: <Text style={{ fontFamily: 'TTSquares-Bold', color: '#1a1a1a' }}>{inv.role}</Text>
                  </Text>
                </View>

                {inv.revenueShare !== undefined && inv.revenueShare !== null && (
                  <View style={styles.invDetail}>
                    <Icon source="percent" size={14} color="#999" />
                    <Text style={styles.invDetailText}>
                      Revenue share: <Text style={{ fontFamily: 'TTSquares-Bold', color: brandColors.primary }}>{inv.revenueShare}%</Text>
                    </Text>
                  </View>
                )}

                <Text style={styles.invDate}>{formatDate(inv.createdAt)}</Text>

                <View style={styles.invActions}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    activeOpacity={0.7}
                    onPress={() => handleRespond(inv.id, true)}
                    disabled={responding === inv.id}
                  >
                    {responding === inv.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon source="check" size={16} color="#fff" />
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.declineBtn}
                    activeOpacity={0.7}
                    onPress={() => handleRespond(inv.id, false)}
                    disabled={responding === inv.id}
                  >
                    <Icon source="close" size={16} color="#E53935" />
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F4' },
  listWrap: { paddingHorizontal: 16, paddingTop: 16 },

  invCard: {
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
  invCampaign: { fontSize: 17, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 10 },
  invDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  invDetailText: { fontSize: 13, color: '#666', fontFamily: 'TTSquares-Regular' },
  invDate: { fontSize: 11, color: '#ccc', marginTop: 8, marginBottom: 14, fontFamily: 'TTSquares-Regular' },

  invActions: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: brandColors.primary,
  },
  acceptBtnText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#fff' },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(229,57,53,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.2)',
  },
  declineBtnText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#E53935' },

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
