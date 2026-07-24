import { useState, useRef, useEffect } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native'
import { Text, ActivityIndicator, Icon } from 'react-native-paper'
import { router } from 'expo-router'
import { CampaignCategory, CampaignStatus } from '@ubuntu-fund/types'
import type { Campaign } from '@ubuntu-fund/types'
import { useCampaigns } from '@/hooks/useCampaigns'
import { ProgressBar } from '@/components/ProgressBar'
import { brandColors } from '@/theme'

const { width } = Dimensions.get('window')

const CATEGORIES: { key: CampaignCategory | null; icon: string; label: string }[] = [
  { key: null, icon: 'earth', label: 'All' },
  { key: CampaignCategory.MEDICAL, icon: 'hospital-box', label: 'Medical' },
  { key: CampaignCategory.EDUCATION, icon: 'book-open-variant', label: 'Education' },
  { key: CampaignCategory.EMERGENCY, icon: 'alert-circle', label: 'Emergency' },
  { key: CampaignCategory.COMMUNITY, icon: 'account-group', label: 'Community' },
  { key: CampaignCategory.BUSINESS, icon: 'briefcase', label: 'Business' },
  { key: CampaignCategory.RELIGIOUS, icon: 'mosque', label: 'Religious' },
  { key: CampaignCategory.CREATIVE, icon: 'palette', label: 'Creative' },
]

const STATUS_FILTERS: { key: string | null; label: string }[] = [
  { key: null, label: 'All' },
  { key: CampaignStatus.ACTIVE, label: 'Active' },
  { key: CampaignStatus.FUNDED, label: 'Funded' },
]

type SortKey = 'newest' | 'most_funded' | 'ending_soon'

function formatCurrency(amount: number, currency: string) {
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${currency} ${(amount / 1_000).toFixed(1)}K`
  return `${currency} ${amount.toLocaleString()}`
}

function CampaignRow({ campaign, index }: { campaign: Campaign; index: number }) {
  const pct = campaign.goalAmount > 0 ? Math.min(campaign.raisedAmount / campaign.goalAmount, 1) : 0
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, delay: index * 60, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/campaign/${campaign.id}`)}
        style={styles.campaignRow}
      >
        {campaign.imageUrls[0] ? (
          <Image source={{ uri: campaign.imageUrls[0] }} style={styles.campaignImage} />
        ) : (
          <View style={[styles.campaignImage, { backgroundColor: 'rgba(168,181,160,0.28)' }]} />
        )}
        <View style={styles.campaignContent}>
          <View style={styles.campaignMeta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Icon source={CATEGORIES.find((c) => c.key === campaign.category)?.icon ?? 'help-circle'} size={12} color={brandColors.textSecondary} />
              <Text style={styles.campaignCategory}>
                {campaign.category}
              </Text>
            </View>
            {campaign.priority !== 'normal' && (
              <View style={[styles.priorityDot, { backgroundColor: campaign.priority === 'critical' ? brandColors.error : brandColors.warning }]} />
            )}
          </View>
          <Text style={styles.campaignTitle} numberOfLines={2}>{campaign.title}</Text>
          <ProgressBar progress={pct} height={3} />
          <View style={styles.campaignStats}>
            <Text style={styles.campaignRaised}>{formatCurrency(campaign.raisedAmount, campaign.currency)}</Text>
            <Text style={styles.campaignPct}>{Math.round(pct * 100)}%</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

export default function ExploreTab() {
  const { campaigns, isLoading } = useCampaigns()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CampaignCategory | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('newest')

  const filtered = campaigns.filter((c) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
    if (selectedCategory && c.category !== selectedCategory) return false
    if (selectedStatus && c.status !== selectedStatus) return false
    return true
  }).sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (sort === 'most_funded') return (b.raisedAmount / b.goalAmount) - (a.raisedAmount / a.goalAmount)
    if (sort === 'ending_soon') return new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    return 0
  })

  return (
    <View style={styles.container}>
      {/* Lede */}
      <View style={styles.ledeWrap}>
        <Text style={styles.lede}>Find causes that need your support</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Icon source="magnify" size={16} color={brandColors.textSecondary} />
          <TextInput
            placeholder="Search campaigns..."
            placeholderTextColor="rgba(74,90,80,0.55)"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon source="close" size={16} color={brandColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.key
          return (
            <TouchableOpacity
              key={cat.label}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setSelectedCategory(active ? null : cat.key)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon source={cat.icon} size={14} color={active ? '#FFFFFF' : brandColors.text} />
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {cat.label}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Status + Sort row */}
      <View style={styles.secondaryFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
          {STATUS_FILTERS.map((s) => {
            const active = selectedStatus === s.key
            return (
              <TouchableOpacity
                key={s.label}
                style={[styles.miniPill, active && styles.miniPillActive]}
                onPress={() => setSelectedStatus(active ? null : s.key)}
              >
                <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            )
          })}
          <View style={styles.sortDivider} />
          {([['newest', 'Newest'], ['most_funded', 'Top Funded'], ['ending_soon', 'Ending Soon']] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.miniPill, sort === key && styles.miniPillSort]}
              onPress={() => setSort(key)}
            >
              <Text style={[styles.miniPillText, sort === key && styles.miniPillTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>{filtered.length} campaign{filtered.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Campaign list */}
      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 60 }} color={brandColors.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconTile}>
            <Icon source="magnify" size={22} color={brandColors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No campaigns found</Text>
          <Text style={styles.emptyBody}>Try adjusting your search or filters</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
          {filtered.map((c, i) => (
            <CampaignRow key={c.id} campaign={c} index={i} />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },

  // Lede
  ledeWrap: { paddingHorizontal: 16, paddingTop: 12 },
  lede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: brandColors.text, fontFamily: 'Outfit_400Regular' },
  searchClear: { fontSize: 16, color: brandColors.textSecondary, paddingLeft: 8 },

  // Filter pills
  filterScroll: { paddingHorizontal: 16, paddingRight: 24, paddingBottom: 10, gap: 8 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(168,181,160,0.28)',
  },
  filterPillActive: { backgroundColor: brandColors.primary },
  filterPillText: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: brandColors.text, lineHeight: 18 },
  filterPillTextActive: { color: '#FFFFFF' },

  // Secondary filters
  secondaryFilters: { paddingHorizontal: 16, paddingBottom: 8 },
  miniPill: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(168,181,160,0.28)',
  },
  miniPillActive: { backgroundColor: brandColors.primary },
  miniPillSort: { backgroundColor: brandColors.primary },
  miniPillText: { fontSize: 11, fontFamily: 'TTSquares-Bold', color: brandColors.textSecondary },
  miniPillTextActive: { color: '#FFFFFF', fontFamily: 'TTSquares-Bold' },
  sortDivider: { width: 1, backgroundColor: 'rgba(26,46,34,0.10)', marginHorizontal: 4 },

  // Results
  resultsHeader: { paddingHorizontal: 16, paddingBottom: 6 },
  resultsCount: { fontSize: 12, color: brandColors.textSecondary, fontFamily: 'Outfit_400Regular' },
  results: { paddingHorizontal: 16 },

  // Campaign row
  campaignRow: {
    flexDirection: 'row',
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  campaignImage: { width: 100, height: 100 },
  campaignContent: { flex: 1, padding: 10, justifyContent: 'center' },
  campaignMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  campaignCategory: { fontSize: 11, color: brandColors.textSecondary, fontFamily: 'TTSquares-Bold', flex: 1 },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  campaignTitle: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: brandColors.text, marginBottom: 6, lineHeight: 18 },
  campaignStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  campaignRaised: { fontSize: 12, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  campaignPct: { fontSize: 12, fontFamily: 'TTSquares-Bold', color: brandColors.textSecondary },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168,181,160,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'TTSquares-Bold', color: brandColors.text, marginBottom: 4 },
  emptyBody: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },
})
