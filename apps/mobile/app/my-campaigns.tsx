import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
} from 'react-native'
import { Text, Icon, Chip, Button } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { ProgressBar } from '@/components/ProgressBar'
import { brandColors } from '@/theme'

const { width } = Dimensions.get('window')

interface Campaign {
  id: string
  title: string
  status: string
  raisedAmount: number
  goalAmount: number
  currency: string
  imageUrls: string[]
  createdAt: string
  endDate: string
  creatorId: string
}

function formatCurrency(amount: number, currency: string) {
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${currency} ${(amount / 1_000).toFixed(1)}K`
  return `${currency} ${amount.toLocaleString()}`
}

const STATUS_COLORS: Record<string, string> = {
  active: '#2E7D32',
  draft: '#78909C',
  completed: '#1565C0',
  paused: '#F57F17',
  cancelled: '#E53935',
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonCard({ index }: { index: number }) {
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
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonContent}>
        <View style={{ width: '70%', height: 14, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 8 }} />
        <View style={{ width: '40%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 12 }} />
        <View style={{ width: '100%', height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, marginBottom: 8 }} />
        <View style={{ width: '50%', height: 10, backgroundColor: '#E0E0E0', borderRadius: 4 }} />
      </View>
    </Animated.View>
  )
}

// ─── Campaign Card ───────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const pct = campaign.goalAmount > 0 ? Math.min(campaign.raisedAmount / campaign.goalAmount, 1) : 0
  const statusColor = STATUS_COLORS[campaign.status] ?? '#78909C'

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/campaign/${campaign.id}`)}
      style={styles.card}
    >
      {campaign.imageUrls?.[0] ? (
        <Image source={{ uri: campaign.imageUrls[0] }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: '#E8F5E9' }]} />
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>{campaign.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </Text>
          </View>
        </View>

        <ProgressBar progress={pct} height={5} />

        <View style={styles.cardStats}>
          <Text style={styles.cardRaised}>
            {formatCurrency(campaign.raisedAmount, campaign.currency)}
          </Text>
          <Text style={styles.cardGoal}>
            {' '}of {formatCurrency(campaign.goalAmount, campaign.currency)}
          </Text>
          <Text style={styles.cardPct}>{Math.round(pct * 100)}%</Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/campaign/${campaign.id}`)}
          >
            <Icon source="eye" size={16} color={brandColors.primary} />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/campaign/${campaign.id}`)}
          >
            <Icon source="pencil" size={16} color={brandColors.primary} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Main ────────────────────────────────────────────────────

export default function MyCampaignsScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Campaign[]>('/campaigns')
      const mine = data.filter((c) => c.creatorId === user?.id)
      setCampaigns(mine)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Campaigns',
          headerStyle: { backgroundColor: brandColors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'TTSquares-Bold' },
        }}
      />

      {/* Create button */}
      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.85}
        onPress={() => router.push('/campaign/create')}
      >
        <Icon source="plus" size={18} color="#1B5E20" />
        <Text style={styles.createBtnText}>Create New Campaign</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Icon source="alert-circle-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>{error}</Text>
            <Button mode="outlined" onPress={fetchCampaigns} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </View>
        ) : campaigns.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="bullhorn-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>You haven't created any campaigns yet</Text>
            <Text style={styles.emptySubtitle}>Start your first campaign and make a difference</Text>
            <Button
              mode="contained"
              onPress={() => router.push('/campaign/create')}
              style={{ marginTop: 16, backgroundColor: brandColors.primary }}
              labelStyle={{ fontFamily: 'TTSquares-Bold' }}
            >
              Create Campaign
            </Button>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F4' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: brandColors.secondary,
  },
  createBtnText: { fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#1B5E20' },
  listWrap: { paddingHorizontal: 16, paddingTop: 8 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: { width: '100%', height: 120 },
  cardContent: { padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: 'TTSquares-Bold' },
  cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cardRaised: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  cardGoal: { fontSize: 11, fontFamily: 'TTSquares-Regular', color: '#999', flex: 1 },
  cardPct: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: '#666' },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: brandColors.primary },

  // Skeleton
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  skeletonImage: { width: '100%', height: 120, backgroundColor: '#E0E0E0' },
  skeletonContent: { padding: 14 },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#666', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 6, textAlign: 'center' },
})
