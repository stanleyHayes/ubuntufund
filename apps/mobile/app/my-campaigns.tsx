import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
} from 'react-native'
import { Text, Icon, Button } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { ProgressBar } from '@/components/ProgressBar'
import { brandColors } from '@/theme'

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
  active: brandColors.success,
  draft: brandColors.textSecondary,
  completed: brandColors.primaryLight,
  paused: brandColors.warning,
  cancelled: brandColors.error,
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
        <View style={[styles.skeletonLine, { width: '70%', marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: '40%', height: 10, marginBottom: 12 }]} />
        <View style={[styles.skeletonLine, { width: '100%', height: 6, marginBottom: 8, borderRadius: 3 }]} />
        <View style={[styles.skeletonLine, { width: '50%', height: 10 }]} />
      </View>
    </Animated.View>
  )
}

// ─── Campaign Card ───────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const pct = campaign.goalAmount > 0 ? Math.min(campaign.raisedAmount / campaign.goalAmount, 1) : 0
  const statusColor = STATUS_COLORS[campaign.status] ?? brandColors.textSecondary

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/campaign/${campaign.id}`)}
      style={styles.card}
    >
      {campaign.imageUrls?.[0] ? (
        <Image source={{ uri: campaign.imageUrls[0] }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImageFallback]} />
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

      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Your Campaigns</Text>
        <Text style={styles.pageTitle}>My Campaigns</Text>
        <Text style={styles.pageLede}>Manage and track the causes you've started.</Text>
      </View>

      {/* Create button */}
      <Button
        mode="contained"
        buttonColor={brandColors.secondary}
        textColor="#221B0E"
        icon="plus"
        onPress={() => router.push('/campaign/create')}
        style={styles.createBtn}
        labelStyle={styles.btnLabel}
      >
        Create New Campaign
      </Button>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        {loading ? (
          <View style={styles.listWrap}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </View>
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
              onPress={fetchCampaigns}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
            >
              Retry
            </Button>
          </View>
        ) : campaigns.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconTile}>
              <Icon source="bullhorn-outline" size={24} color={brandColors.primary} />
            </View>
            <Text style={styles.emptyTitle}>You haven't created any campaigns yet</Text>
            <Text style={styles.emptySubtitle}>Start your first campaign and make a difference</Text>
            <Button
              mode="contained"
              buttonColor={brandColors.secondary}
              textColor="#221B0E"
              onPress={() => router.push('/campaign/create')}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
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
  container: { flex: 1, backgroundColor: brandColors.background },

  headerBlock: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  eyebrow: { fontSize: 11, fontFamily: 'TTSquares-Bold', fontWeight: '700', color: brandColors.secondaryDark, textTransform: 'uppercase', letterSpacing: 2 },
  pageTitle: { fontSize: 24, fontFamily: 'TTSquares-Black', color: brandColors.text, marginTop: 4 },
  pageLede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 4 },

  createBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 999,
  },
  listWrap: { paddingHorizontal: 16, paddingTop: 8 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  cardImage: { width: '100%', height: 120 },
  cardImageFallback: { backgroundColor: 'rgba(168,181,160,0.28)' },
  cardContent: { padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: 'TTSquares-Bold', color: brandColors.text, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: 'TTSquares-Bold' },
  cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cardRaised: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  cardGoal: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, flex: 1 },
  cardPct: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: brandColors.textSecondary },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(26,46,34,0.08)', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  actionText: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: brandColors.primary },

  // Skeleton
  skeletonCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  skeletonImage: { width: '100%', height: 120, backgroundColor: 'rgba(168,181,160,0.28)' },
  skeletonContent: { padding: 14 },
  skeletonLine: { height: 14, backgroundColor: 'rgba(168,181,160,0.35)', borderRadius: 4 },

  // Empty
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
  emptyTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: brandColors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 6, textAlign: 'center' },
  btnLabel: { fontFamily: 'TTSquares-Bold' },
})
