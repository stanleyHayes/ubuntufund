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

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']

function formatAmount(amount?: number) {
  const val = amount ?? 0
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toLocaleString()}`
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
    <Animated.View style={{ opacity, paddingHorizontal: 16, paddingTop: 16 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 28, height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginRight: 12 }} />
          <View style={{ width: 40, height: 40, backgroundColor: '#E0E0E0', borderRadius: 20, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <View style={{ width: '60%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 4 }} />
            <View style={{ width: '35%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
          </View>
          <View style={{ width: 50, height: 14, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
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
      const res = await api.get<{ data: LeaderboardEntry[] } | LeaderboardEntry[]>(`/leaderboard?period=${PERIOD_PARAMS[activePeriod]}`)
      const data = Array.isArray(res) ? res : res.data ?? []
      setEntries(data)
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
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      {/* Period Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
        {PERIODS.map((period) => (
          <TouchableOpacity
            key={period}
            style={[styles.periodTab, activePeriod === period && styles.periodTabActive]}
            activeOpacity={0.7}
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
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchLeaderboard} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="trophy-outline" size={48} color="#ccc" />
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
                  <Text style={[styles.entryAmount, isTopThree && { color: brandColors.primary }]}>
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
  container: { flex: 1, backgroundColor: '#F8F8F4' },

  periodRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  periodTab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  periodTabActive: { backgroundColor: brandColors.primary, borderColor: brandColors.primary },
  periodTabText: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: '#666' },
  periodTabTextActive: { color: '#fff' },

  listWrap: { paddingHorizontal: 16 },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  entryRowTop: {
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  entryRowCurrent: {
    borderWidth: 1.5,
    borderColor: brandColors.primary,
    backgroundColor: `${brandColors.primary}06`,
  },

  rankWrap: { width: 32, alignItems: 'center', marginRight: 8 },
  rankText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#999' },
  medalBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  medalText: { fontSize: 12, fontFamily: 'TTSquares-Black', color: '#fff' },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: brandColors.primary },

  entryName: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#1a1a1a' },
  entrySub: { fontSize: 11, color: '#999', marginTop: 1, fontFamily: 'TTSquares-Regular' },
  entryAmount: { fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#1a1a1a' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#666', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 6, textAlign: 'center' },
})
