import { useRef, useEffect } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  FlatList,
  TouchableOpacity,
} from 'react-native'
import { Text, ActivityIndicator, Icon } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { Campaign } from '@ubuntu-fund/types'
import { CampaignCategory } from '@ubuntu-fund/types'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useAuth } from '@/context/AuthContext'
import { ProgressBar } from '@/components/ProgressBar'
import { UbuntuLogo } from '@/components/UbuntuLogo'
import { RemoteImage } from '@/components/RemoteImage'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { PressableScale } from '@/components/anim/PressableScale'
import { brandColors } from '@/theme'

const { width } = Dimensions.get('window')
const CARD_WIDTH = width * 0.78
const SMALL_CARD_WIDTH = width * 0.6

// ─── Category config ─────────────────────────────────────────

const CATEGORIES: { key: CampaignCategory; icon: string; label: string; color: string }[] = [
  { key: CampaignCategory.MEDICAL, icon: 'hospital-box', label: 'Medical', color: '#E53935' },
  { key: CampaignCategory.EDUCATION, icon: 'book-open-variant', label: 'Education', color: '#1565C0' },
  { key: CampaignCategory.EMERGENCY, icon: 'alert-circle', label: 'Emergency', color: '#E65100' },
  { key: CampaignCategory.COMMUNITY, icon: 'account-group', label: 'Community', color: '#2E7D32' },
  { key: CampaignCategory.BUSINESS, icon: 'briefcase', label: 'Business', color: '#6A1B9A' },
  { key: CampaignCategory.RELIGIOUS, icon: 'mosque', label: 'Religious', color: '#00695C' },
  { key: CampaignCategory.CREATIVE, icon: 'palette', label: 'Creative', color: '#F57F17' },
]

// ─── Helpers ──────────────────────────────────────────────────

const ghsFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' })

function formatCurrency(amount: number) {
  if (amount >= 1_000_000) return `GH₵ ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `GH₵ ${(amount / 1_000).toFixed(1)}K`
  return ghsFormatter.format(amount)
}

function daysLeft(end: Date) {
  const d = Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000))
  if (d === 0) return 'Ended'
  return `${d}d left`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Featured Campaign Card ──────────────────────────────────

function FeaturedCard({ campaign, index }: { campaign: Campaign; index: number }) {
  const pct = campaign.goalAmount > 0 ? Math.min(campaign.raisedAmount / campaign.goalAmount, 1) : 0
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, delay: index * 100, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/campaign/${campaign.id}`)}
        style={styles.featuredCard}
      >
        <RemoteImage uri={campaign.imageUrls[0]} style={styles.featuredImage} />
        <View style={styles.featuredImageOverlay} />

        {/* Priority badge */}
        {campaign.priority !== 'normal' && (
          <View style={[styles.priorityBadge, { backgroundColor: campaign.priority === 'critical' ? brandColors.error : brandColors.warning }]}>
            <Text style={styles.priorityText}>{campaign.priority === 'critical' ? 'Critical' : 'Urgent'}</Text>
          </View>
        )}

        {/* Content overlay at bottom */}
        <View style={styles.featuredContent}>
          <View style={styles.featuredCategoryRow}>
            <View style={styles.featuredCategoryPill}>
              <Text style={styles.featuredCategoryText}>
                {CATEGORIES.find((c) => c.key === campaign.category)?.label ?? campaign.category}
              </Text>
            </View>
            <Text style={styles.featuredDays}>{daysLeft(campaign.endDate)}</Text>
          </View>

          <Text style={styles.featuredTitle} numberOfLines={2}>{campaign.title}</Text>

          <ProgressBar progress={pct} height={4} backgroundColor="rgba(255,255,255,0.2)" fillColor={brandColors.secondary} />

          <View style={styles.featuredStats}>
            <Text style={styles.featuredRaised}>{formatCurrency(campaign.raisedAmount)}</Text>
            <Text style={styles.featuredGoal}> of {formatCurrency(campaign.goalAmount)}</Text>
            <Text style={styles.featuredPct}>{Math.round(pct * 100)}%</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Compact Campaign Row ────────────────────────────────────

function CompactCard({ campaign }: { campaign: Campaign }) {
  const pct = campaign.goalAmount > 0 ? Math.min(campaign.raisedAmount / campaign.goalAmount, 1) : 0

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/campaign/${campaign.id}`)}
      style={styles.compactCard}
    >
      <RemoteImage uri={campaign.imageUrls[0]} style={styles.compactImage} />
      <View style={styles.compactContent}>
        <Text style={styles.compactTitle} numberOfLines={2}>{campaign.title}</Text>
        <ProgressBar progress={pct} height={3} />
        <View style={styles.compactStats}>
          <Text style={styles.compactRaised}>{formatCurrency(campaign.raisedAmount)}</Text>
          <Text style={styles.compactPct}>{Math.round(pct * 100)}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Section Header ──────────────────────────────────────────

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>See all →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── Main Component ──────────────────────────────────────────

export default function HomeTab() {
  const { campaigns, isLoading } = useCampaigns()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

  const active = campaigns.filter((c) => c.status === 'active')
  const featured = active.slice(0, 5)
  const urgent = active.filter((c) => c.priority === 'critical' || c.priority === 'urgent')
  const recent = [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6)

  // Stats
  const totalRaised = active.reduce((s, c) => s + c.raisedAmount, 0)
  const totalCampaigns = active.length

  // Hero animation
  const heroOpacity = useRef(new Animated.Value(0)).current
  const heroSlide = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(heroSlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ═══ HERO ═══ */}
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.bgCircle, styles.circleRight]} />
        <View style={[styles.bgCircle, styles.circleBottom]} />

        <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroSlide }] }}>
          {/* Greeting row */}
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.userName}>{user?.name?.split(' ')[0] ?? 'Friend'}</Text>
            </View>
            <UbuntuLogo size={44} />
          </View>

          {/* Quick stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalCampaigns}</Text>
              <Text style={styles.statLabel}>Active Campaigns</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>GH₵ {(totalRaised / 1000).toFixed(0)}K+</Text>
              <Text style={styles.statLabel}>Total Raised</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{urgent.length}</Text>
              <Text style={styles.statLabel}>Need Help</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 60 }} color={brandColors.primary} />
      ) : (
        <>
          {/* ═══ CATEGORIES ═══ */}
          <View style={{ marginTop: 20 }}>
            <SectionHeader title="Browse Categories" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollView} contentContainerStyle={styles.categoryScroll}>
              {CATEGORIES.map((cat, i) => {
                const count = active.filter((c) => c.category === cat.key).length
                return (
                  <FadeInUp key={cat.key} index={i}>
                    <TouchableOpacity
                      style={styles.categoryPill}
                      activeOpacity={0.7}
                      onPress={() => router.push({ pathname: '/(tabs)/explore', params: { category: cat.key } })}
                    >
                      <View style={styles.categoryEmoji}>
                        <Icon source={cat.icon} size={20} color={brandColors.primary} />
                      </View>
                      <Text style={styles.categoryLabel}>{cat.label}</Text>
                      <Text style={styles.categoryCount}>{count}</Text>
                    </TouchableOpacity>
                  </FadeInUp>
                )
              })}
            </ScrollView>
          </View>

          {/* ═══ FEATURED ═══ */}
          {featured.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <SectionHeader title="Featured Campaigns" onSeeAll={() => router.push('/(tabs)/explore')} />
              <FlatList
                horizontal
                data={featured}
                keyExtractor={(c) => c.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
                snapToInterval={CARD_WIDTH + 14}
                decelerationRate="fast"
                renderItem={({ item, index }) => <FeaturedCard campaign={item} index={index} />}
              />
            </View>
          )}

          {/* ═══ URGENT ═══ */}
          {urgent.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader title="Urgent — Needs Help Now" />
              <View style={{ paddingHorizontal: 16 }}>
                {urgent.slice(0, 3).map((c, i) => (
                  <FadeInUp key={c.id} index={i}>
                    <CompactCard campaign={c} />
                  </FadeInUp>
                ))}
              </View>
            </View>
          )}

          {/* ═══ RECENTLY ADDED ═══ */}
          {recent.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader title="Recently Added" onSeeAll={() => router.push('/(tabs)/explore')} />
              <FlatList
                horizontal
                data={recent}
                keyExtractor={(c) => c.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                snapToInterval={SMALL_CARD_WIDTH + 12}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push(`/campaign/${item.id}`)}
                    style={styles.recentCard}
                  >
                    <RemoteImage uri={item.imageUrls[0]} style={styles.recentImage} />
                    <View style={styles.recentContent}>
                      <Text style={styles.recentTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.recentAmount}>{formatCurrency(item.raisedAmount)}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* ═══ START A CAMPAIGN CTA ═══ */}
          <PressableScale
            style={styles.ctaBanner}
            onPress={() => router.push('/campaign/create')}
          >
            <View>
              <Text style={styles.ctaTitle}>Have a cause?</Text>
              <Text style={styles.ctaSubtitle}>Start your own campaign today</Text>
            </View>
            <View style={styles.ctaArrow}>
              <Icon source="arrow-right" size={20} color="#221B0E" />
            </View>
          </PressableScale>

          <View style={{ height: 24 }} />
        </>
      )}
    </ScrollView>
  )
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },

  // Hero
  hero: {
    backgroundColor: brandColors.primaryDark,
    paddingBottom: 24,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  bgCircle: { position: 'absolute', borderRadius: 9999, backgroundColor: brandColors.primary, opacity: 0.06 },
  circleRight: { width: width * 0.6, height: width * 0.6, top: -width * 0.2, right: -width * 0.2 },
  circleBottom: { width: width * 0.4, height: width * 0.4, bottom: -width * 0.15, left: -width * 0.1 },

  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit_400Regular' },
  userName: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF', marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  statValue: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: brandColors.secondary },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: 'Outfit_400Regular' },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: brandColors.text },
  seeAll: { fontSize: 13, color: brandColors.primary, fontFamily: 'Outfit_700Bold' },

  // Categories
  categoryScrollView: { flexGrow: 0 },
  categoryScroll: { paddingHorizontal: 16, paddingRight: 24, gap: 10, alignItems: 'flex-start' },
  categoryPill: {
    alignItems: 'center',
    width: 72,
  },
  categoryEmoji: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: 'rgba(168,181,160,0.28)',
  },
  categoryLabel: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary, textAlign: 'center' },
  categoryCount: { fontSize: 10, fontFamily: 'Outfit_400Regular', color: 'rgba(74,90,80,0.65)', marginTop: 1 },

  // Featured card
  featuredCard: {
    width: CARD_WIDTH,
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: brandColors.primaryDark,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  featuredImage: { width: '100%', height: '100%', position: 'absolute' },
  featuredImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  priorityBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#fff' },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  featuredCategoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  featuredCategoryPill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  featuredCategoryText: { fontSize: 11, color: '#fff', fontFamily: 'Outfit_700Bold' },
  featuredDays: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: 'rgba(255,255,255,0.6)' },
  featuredTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#fff', marginBottom: 8, lineHeight: 21 },
  featuredStats: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  featuredRaised: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.secondary },
  featuredGoal: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: 'rgba(255,255,255,0.5)', flex: 1 },
  featuredPct: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: '#fff' },

  // Compact card (urgent)
  compactCard: {
    flexDirection: 'row',
    backgroundColor: brandColors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  compactImage: { width: 90, height: 90 },
  compactContent: { flex: 1, padding: 10, justifyContent: 'center' },
  compactTitle: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.text, marginBottom: 6, lineHeight: 18 },
  compactStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  compactRaised: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: brandColors.primary },
  compactPct: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary },

  // Recent cards
  recentCard: {
    width: SMALL_CARD_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
  },
  recentImage: { width: '100%', height: 100 },
  recentContent: { padding: 10 },
  recentTitle: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.text, marginBottom: 4, lineHeight: 17 },
  recentAmount: { fontSize: 12, fontFamily: 'Outfit_700Bold', color: brandColors.primary },

  // CTA banner
  ctaBanner: {
    marginHorizontal: 16,
    marginTop: 28,
    backgroundColor: brandColors.secondary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaTitle: { fontSize: 17, fontFamily: 'Outfit_800ExtraBold', color: '#221B0E' },
  ctaSubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: 'rgba(34,27,14,0.72)', marginTop: 2 },
  ctaArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
