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
          <View style={[styles.campaignImage, { backgroundColor: '#E8F5E9' }]} />
        )}
        <View style={styles.campaignContent}>
          <View style={styles.campaignMeta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Icon source={CATEGORIES.find((c) => c.key === campaign.category)?.icon ?? 'help-circle'} size={12} color="#888" />
              <Text style={styles.campaignCategory}>
                {campaign.category}
              </Text>
            </View>
            {campaign.priority !== 'normal' && (
              <View style={[styles.priorityDot, { backgroundColor: campaign.priority === 'critical' ? '#E53935' : '#F9A825' }]} />
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
      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Icon source="magnify" size={16} color="#999" />
          <TextInput
            placeholder="Search campaigns..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon source="close" size={16} color="#999" />
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
                <Icon source={cat.icon} size={14} color={active ? '#fff' : '#555'} />
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
              <Text style={[styles.miniPillText, sort === key && { color: brandColors.primary, fontFamily: 'TTSquares-Bold' }]}>{label}</Text>
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
          <Icon source="magnify" size={40} color="#ccc" />
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
  container: { flex: 1, backgroundColor: '#F8F8F4' },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1a1a1a', fontFamily: 'TTSquares-Regular' },
  searchClear: { fontSize: 16, color: '#999', paddingLeft: 8 },

  // Filter pills
  filterScroll: { paddingHorizontal: 16, paddingRight: 24, paddingBottom: 10, gap: 8 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  filterPillActive: { backgroundColor: brandColors.primary, borderColor: brandColors.primary },
  filterPillText: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: '#555', lineHeight: 18 },
  filterPillTextActive: { color: '#fff' },

  // Secondary filters
  secondaryFilters: { paddingHorizontal: 16, paddingBottom: 8 },
  miniPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  miniPillActive: { backgroundColor: 'rgba(46,125,50,0.1)' },
  miniPillSort: { backgroundColor: 'rgba(46,125,50,0.06)' },
  miniPillText: { fontSize: 11, fontFamily: 'TTSquares-Bold', color: '#777' },
  miniPillTextActive: { color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
  sortDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: 4 },

  // Results
  resultsHeader: { paddingHorizontal: 16, paddingBottom: 6 },
  resultsCount: { fontSize: 12, color: '#999', fontFamily: 'TTSquares-Regular' },
  results: { paddingHorizontal: 16 },

  // Campaign row
  campaignRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  campaignImage: { width: 100, height: 100 },
  campaignContent: { flex: 1, padding: 10, justifyContent: 'center' },
  campaignMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  campaignCategory: { fontSize: 11, color: '#888', fontFamily: 'TTSquares-Bold', flex: 1 },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  campaignTitle: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 6, lineHeight: 18 },
  campaignStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  campaignRaised: { fontSize: 12, fontFamily: 'TTSquares-Bold', color: brandColors.primary },
  campaignPct: { fontSize: 12, fontFamily: 'TTSquares-Bold', color: '#999' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', marginBottom: 4 },
  emptyBody: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#999' },
})
