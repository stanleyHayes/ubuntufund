import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Text, Icon, ActivityIndicator } from 'react-native-paper'
import { Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'
import { SignInRequired } from '@/components/SignInRequired'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

interface Invitation {
  id: string
  campaignName: string
  inviterName: string
  role: string
  revenueShare?: number
  createdAt: string
  status: string
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

    invCard: {
      ...neu.raised,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    invCampaign: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 10 },
    invDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    invDetailText: { fontSize: 13, color: p.textSecondary, fontFamily: 'Outfit_400Regular' },
    invDate: { fontSize: 11, color: p.textSecondary, marginTop: 8, marginBottom: 14, fontFamily: 'Outfit_400Regular' },

    invActions: { flexDirection: 'row', gap: 10 },
    acceptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flex: 1,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: p.primary,
    },
    acceptBtnText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: '#fff' },
    declineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flex: 1,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: `${p.error}14`,
      borderWidth: 1,
      borderColor: `${p.error}40`,
    },
    declineBtnText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.error },

    skeletonCard: {
      ...neu.raised,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },
    skeletonLine: { height: 14, backgroundColor: p.skeleton, borderRadius: 4 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 72, paddingHorizontal: 32 },
    emptyIconTile: {
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
    emptySubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 18 },
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

function SkeletonCard() {
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
      <View style={[styles.skeletonLine, { width: '70%', marginBottom: 8 }]} />
      <View style={[styles.skeletonLine, { width: '45%', height: 10, marginBottom: 6 }]} />
      <View style={[styles.skeletonLine, { width: '55%', height: 10, marginBottom: 14 }]} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[styles.skeletonLine, { width: 100, height: 36, borderRadius: 8 }]} />
        <View style={[styles.skeletonLine, { width: 100, height: 36, borderRadius: 8 }]} />
      </View>
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function InvitationsScreen() {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [responding, setResponding] = useState<string | null>(null)

  const fetchInvitations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Invitation[]>('/collaborations/invitations')
      setInvitations(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchInvitations()
  }, [user, fetchInvitations])

  const handleRespond = async (id: string, accept: boolean) => {
    setResponding(id)
    try {
      await api.put(`/collaborations/${id}/respond`, { accept })
      setInvitations((prev) => prev.filter((inv) => inv.id !== id))
      Alert.alert(
        accept ? 'Accepted' : 'Declined',
        accept ? 'You have joined the collaboration.' : 'Invitation declined.',
      )
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to respond to invitation.')
    } finally {
      setResponding(null)
    }
  }

  const pending = invitations.filter((inv) => inv.status === 'pending')

  const headerOptions = {
    title: 'Invitations',
    headerStyle: { backgroundColor: p.primary },
    headerTintColor: p.onPrimary,
    headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={headerOptions} />
        <SignInRequired what="invitations" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={headerOptions} />

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Collaborations</Text>
        <Text style={styles.pageTitle}>Invitations</Text>
        <Text style={styles.pageLede}>Review requests to collaborate on campaigns.</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
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
            onCtaPress={fetchInvitations}
          />
        ) : pending.length === 0 ? (
          <EmptyState
            icon="email-open-outline"
            title="No pending invitations"
            subtitle="When someone invites you to collaborate on a campaign, it will appear here"
          />
        ) : (
          <View style={styles.listWrap}>
            {pending.map((inv, i) => (
              <FadeInUp key={inv.id} index={i}>
              <View style={styles.invCard}>
                <Text style={styles.invCampaign} numberOfLines={1}>{inv.campaignName}</Text>

                <View style={styles.invDetail}>
                  <Icon source="account" size={14} color={p.textSecondary} />
                  <Text style={styles.invDetailText}>Invited by {inv.inviterName}</Text>
                </View>

                <View style={styles.invDetail}>
                  <Icon source="shield-account" size={14} color={p.textSecondary} />
                  <Text style={styles.invDetailText}>
                    Role: <Text style={{ fontFamily: 'Outfit_700Bold', color: p.text }}>{inv.role}</Text>
                  </Text>
                </View>

                {inv.revenueShare !== undefined && inv.revenueShare !== null && (
                  <View style={styles.invDetail}>
                    <Icon source="percent" size={14} color={p.textSecondary} />
                    <Text style={styles.invDetailText}>
                      Revenue share: <Text style={{ fontFamily: 'Outfit_700Bold', color: p.primary }}>{inv.revenueShare}%</Text>
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
                    <Icon source="close" size={16} color={p.error} />
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
              </FadeInUp>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
