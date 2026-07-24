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

interface LeaderboardEntry {
  id: string
  userId: string
  name?: string
  avatar?: string
  totalDonated: number
  donationCount: number
  campaignsSupported: number
  rank?: number
  isAnonymous?: boolean
}

const PERIODS = ['Weekly', 'Monthly', 'Yearly', 'Lifetime'] as const
type Period = (typeof PERIODS)[number]

const PERIOD_PARAMS: Record<Period, string> = {
  Weekly: 'weekly',
  Monthly: 'monthly',
  Yearly: 'yearly',
  Lifetime: 'lifetime',
}

// Rank 1-3 badge colors, drawn from the gold family only.
const MEDAL_COLORS = [brandColors.secondary, brandColors.secondaryDark, brandColors.secondaryLight]

const ghsFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' })

function formatAmount(amount?: number) {
  const val = amount ?? 0
  if (val >= 1_000_000) return `GH₵ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `GH₵ ${(val / 1_000).toFixed(1)}K`
  return ghsFormatter.format(val)
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonRows() {
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
    <Animated.View style={{ opacity, paddingHorizontal: 16, paddingTop: 8 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={styles.skeletonRank} />
          <View style={styles.skeletonAvatar} />
          <View style={{ flex: 1 }}>
            <View style={[styles.skeletonLine, { width: '60%', marginBottom: 4 }]} />
            <View style={[styles.skeletonLine, { width: '35%', height: 10 }]} />
          </View>
          <View style={[styles.skeletonLine, { width: 50 }]} />
        </View>
      ))}
    </Animated.View>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePeriod, setActivePeriod] = useState<Period>('Monthly')

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<LeaderboardEntry[]>(`/leaderboard?period=${PERIOD_PARAMS[activePeriod]}`)
      setEntries(Array.isArray(res) ? res : [])
    } catch (err: any) {
      setError(err.message ?? 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [activePeriod])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Leaderboard',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'Outfit_700Bold' },
        }}
      />

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Community Impact</Text>
        <Text style={styles.pageTitle}>Leaderboard</Text>
        <Text style={styles.pageLede}>See who's making the biggest difference right now.</Text>
      </View>

      {/* Period Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodScroll}
        contentContainerStyle={styles.periodRow}
      >
        {PERIODS.map((period) => (
          <TouchableOpacity
            key={period}
            style={[styles.periodTab, activePeriod === period && styles.periodTabActive]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => setActivePeriod(period)}
          >
            <Text style={[styles.periodTabText, activePeriod === period && styles.periodTabTextActive]}>
              {period}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <SkeletonRows />
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
              onPress={fetchLeaderboard}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
            >
              Retry
            </Button>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconTile}>
              <Icon source="trophy-outline" size={24} color={brandColors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No leaderboard data yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to make a donation!</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {entries.map((entry, i) => {
              const rank = entry.rank ?? i + 1
              const isTopThree = rank <= 3
              const isCurrentUser = entry.userId === user?.id
              const medalColor = isTopThree ? MEDAL_COLORS[rank - 1] : undefined

              return (
                <View
                  key={entry.userId ?? entry.id}
                  style={[
                    styles.entryRow,
                    isTopThree && styles.entryRowTop,
                    isCurrentUser && styles.entryRowCurrent,
                  ]}
                >
                  {/* Rank */}
                  <View style={styles.rankWrap}>
                    {isTopThree ? (
                      <View style={[styles.medalBadge, { backgroundColor: medalColor }]}>
                        <Text style={styles.medalText}>{rank}</Text>
                      </View>
                    ) : (
                      <Text style={styles.rankText}>{rank}</Text>
                    )}
                  </View>

                  {/* Avatar */}
                  <View style={[styles.avatar, isTopThree && { borderColor: medalColor, borderWidth: 2 }]}>
                    <Text style={styles.avatarText}>
                      {entry.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '??'}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.entryName, isCurrentUser && { color: brandColors.primary }]} numberOfLines={1}>
                      {entry.name}{isCurrentUser ? ' (You)' : ''}
                    </Text>
                    <Text style={styles.entrySub}>
                      {entry.campaignsSupported} campaign{entry.campaignsSupported !== 1 ? 's' : ''} supported
                    </Text>
                  </View>

                  {/* Amount */}
                  <Text style={styles.entryAmount}>
                    {formatAmount(entry.totalDonated)}
                  </Text>
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

  periodScroll: { flexGrow: 0 },
  periodRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  periodTab: { height: 38, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(26,46,34,0.10)' },
  periodTabActive: { backgroundColor: brandColors.primary, borderColor: brandColors.primary },
  periodTabText: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary },
  periodTabTextActive: { color: '#fff' },

  listWrap: { paddingHorizontal: 16 },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  entryRowTop: {
    borderColor: 'rgba(199,162,74,0.35)',
    backgroundColor: 'rgba(199,162,74,0.05)',
  },
  entryRowCurrent: {
    borderWidth: 1.5,
    borderColor: brandColors.primary,
    backgroundColor: `${brandColors.primary}0A`,
  },

  rankWrap: { width: 32, alignItems: 'center', marginRight: 8 },
  rankText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary },
  medalBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  medalText: { fontSize: 12, fontFamily: 'Outfit_800ExtraBold', color: '#fff' },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(168,181,160,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: brandColors.primary },

  entryName: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: brandColors.text },
  entrySub: { fontSize: 11, color: brandColors.textSecondary, marginTop: 1, fontFamily: 'Outfit_400Regular' },
  entryAmount: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: brandColors.text },

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

  skeletonRank: { width: 28, height: 14, backgroundColor: 'rgba(168,181,160,0.35)', borderRadius: 4, marginRight: 12 },
  skeletonAvatar: { width: 40, height: 40, backgroundColor: 'rgba(168,181,160,0.35)', borderRadius: 20, marginRight: 12 },
  skeletonLine: { height: 14, backgroundColor: 'rgba(168,181,160,0.35)', borderRadius: 4 },
})
