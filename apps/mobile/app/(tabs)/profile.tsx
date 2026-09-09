import { SignInRequired } from '@/components/SignInRequired'
import { SkeletonLoader } from '@/components/Loading'
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Image,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import { Text, Icon, Button, TouchableRipple } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { VerificationLevel } from '@ubuntu-fund/types'
import { TrustBadge } from '@/components/TrustBadge'
import { UjimoraLogo } from '@/components/UjimoraLogo'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

const { width } = Dimensions.get('window')

interface ProfileStats {
  avatarUrl?: string
  coverUrl?: string
  campaignsCount: number
  totalDonated: number
  totalRaised: number
  verificationLevel: string
  trustScore: number
}

type MenuColorKey = keyof Pick<Palette, 'primary' | 'success' | 'error' | 'secondaryDark' | 'secondary' | 'textSecondary'>

const MENU_ITEMS: { icon: string; label: string; colorKey: MenuColorKey; route: string }[] = [
  { icon: 'account-edit', label: 'Edit profile and images', colorKey: 'primary', route: '/profile/edit' },
  { icon: 'view-dashboard', label: 'Dashboard', colorKey: 'primary', route: '/dashboard' },
  { icon: 'bullhorn', label: 'My Campaigns', colorKey: 'success', route: '/my-campaigns' },
  { icon: 'heart', label: 'My Donations', colorKey: 'error', route: '/my-donations' },
  { icon: 'wallet', label: 'Wallet', colorKey: 'secondaryDark', route: '/(tabs)/wallet' },
  { icon: 'trophy', label: 'Leaderboard', colorKey: 'secondary', route: '/leaderboard' },
  { icon: 'email-open', label: 'Invitations', colorKey: 'textSecondary', route: '/invitations' },
  { icon: 'shield-check', label: 'Verification', colorKey: 'success', route: '/verification' },
  { icon: 'crown', label: 'Subscription', colorKey: 'secondary', route: '/(tabs)/subscription' },
  { icon: 'account-cash', label: 'Affiliate', colorKey: 'success', route: '/affiliate' },
  { icon: 'storefront', label: 'Creator page', colorKey: 'secondaryDark', route: '/creator' },
  { icon: 'cog', label: 'Settings', colorKey: 'textSecondary', route: '/settings' },
  { icon: 'book-open-page-variant-outline', label: 'All policies', colorKey: 'textSecondary', route: '/legal' },
  { icon: 'file-document-outline', label: 'Terms of Use', colorKey: 'textSecondary', route: '/terms' },
  { icon: 'lock-outline', label: 'Privacy Policy', colorKey: 'textSecondary', route: '/privacy' },
]

export default function ProfileTab() {
  const p = usePalette()
  const styles = useStyles()
  const { user, logout } = useAuth()
  const insets = useSafeAreaInsets()
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')

  const [heroOpacity] = useState(() => new Animated.Value(0))
  const [heroSlide] = useState(() => new Animated.Value(20))
  const [bodyOpacity] = useState(() => new Animated.Value(0))
  const [bodySlide] = useState(() => new Animated.Value(30))

  const fetchProfile = useCallback(async () => {
    if (!user) { setStatsLoading(false); return }
    setStatsLoading(true)
    setStatsError('')
    try {
      const data = await api.get<ProfileStats>('/profile')
      setStats(data)
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : 'Your profile could not be loaded.')
    } finally {
      setStatsLoading(false)
    }
  }, [user])

  useFocusEffect(useCallback(() => { void fetchProfile() }, [fetchProfile]))

  useEffect(() => {
    if (!statsLoading) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(heroSlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(bodyOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(bodySlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        ]),
      ]).start()
    }
  }, [bodyOpacity, bodySlide, heroOpacity, heroSlide, statsLoading])

  const displayName = user?.name ?? 'User'
  const displayEmail = user?.email ?? ''
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase()

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  if (!user) return <View style={{ flex: 1, backgroundColor: p.background, paddingBottom: 110 }}><SignInRequired what="profile" /><Button onPress={() => router.push('/legal')}>Legal & trust · All policies</Button></View>

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {stats?.coverUrl && <Image accessibilityLabel="Your cover image" source={{ uri: stats.coverUrl }} style={{ width: '100%', height: 170 }} />}
      {/* ═══ HERO ═══ */}
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.bgCircle, styles.circleRight]} />
        <View style={[styles.bgCircle, styles.circleLeft]} />

        <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroSlide }], alignItems: 'center', width: '100%' }}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <>{stats?.avatarUrl ? <Image source={{ uri: stats.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 50 }} /> : <Text style={styles.avatarText}>{initials}</Text>}</>
            </View>
            <View style={styles.avatarBadge}>
              <UjimoraLogo size={20} />
            </View>
          </View>

          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>

          <View style={styles.trustWrap}>
            <TrustBadge
              level={(stats?.verificationLevel as unknown as VerificationLevel) ?? VerificationLevel.NONE}
              trustScore={stats?.trustScore ?? 0}
            />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {statsLoading ? (
              <SkeletonLoader size="small" color="rgba(255,255,255,0.5)" />
            ) : statsError ? (
              <View><Text accessibilityRole="alert" style={{ color: 'white' }}>{statsError}</Text><Button textColor="white" onPress={() => void fetchProfile()}>Try again</Button></View>
            ) : (
              <>
                {[
                  { value: stats?.campaignsCount ?? 0, label: 'Campaigns' },
                  { value: `GH₵ ${stats?.totalDonated ?? 0}`, label: 'Donated' },
                  { value: `GH₵ ${stats?.totalRaised ?? 0}`, label: 'Raised' },
                ].map((s, i) => (
                  <View key={s.label} style={styles.statBox}>
                    {i > 0 && <View style={styles.statDivider} />}
                    <View style={styles.statInner}>
                      <Text style={styles.statValue}>{s.value}</Text>
                      <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </Animated.View>
      </View>

      {/* ═══ MENU ═══ */}
      <Animated.View style={{ opacity: bodyOpacity, transform: [{ translateY: bodySlide }] }}>
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => {
            const tint = p[item.colorKey]
            return (
              <TouchableRipple
                key={item.label}
                style={[styles.menuRow, i === MENU_ITEMS.length - 1 && { borderBottomWidth: 0 }]}
                rippleColor={p.ripple}
                onPress={() => router.push(item.route as never)}
              >
                <>
                  <View style={[styles.menuIcon, { backgroundColor: `${tint}14` }]}>
                    <Icon source={item.icon} size={20} color={tint} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Icon source="chevron-right" size={18} color={`${p.text}4D`} />
                </>
              </TouchableRipple>
            )
          })}
        </View>

        {/* Legal links */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push('/terms')} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <Text style={styles.legalLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/privacy')} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <Text style={styles.legalLink}>Privacy</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <Button
          mode="outlined"
          icon="logout"
          onPress={handleLogout}
          textColor={p.error}
          style={styles.logoutBtn}
          contentStyle={styles.logoutBtnContent}
          labelStyle={styles.logoutText}
        >
          Sign Out
        </Button>

        <Text style={styles.version}>Ujimora v1.0.0</Text>

        <View style={{ height: 32 }} />
      </Animated.View>
    </ScrollView>
  )
}

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },

    // Hero
    hero: {
      backgroundColor: p.primaryDark,
      paddingBottom: 24,
      paddingHorizontal: 20,
      alignItems: 'center',
      overflow: 'hidden',
    },
    bgCircle: { position: 'absolute', borderRadius: 9999, backgroundColor: p.primary, opacity: 0.06 },
    circleRight: { width: width * 0.5, height: width * 0.5, top: -width * 0.15, right: -width * 0.15 },
    circleLeft: { width: width * 0.3, height: width * 0.3, bottom: -width * 0.1, left: -width * 0.05 },

    avatarWrap: { position: 'relative', marginBottom: 12 },
    avatar: {
      ...neu.greenRaised,
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: p.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { fontSize: 28, fontFamily: 'Outfit_800ExtraBold', color: p.text },
    avatarBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      backgroundColor: p.primaryDark,
      borderRadius: 12,
      padding: 2,
    },

    userName: { fontSize: 22, fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF', marginBottom: 2 },
    userEmail: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: 'rgba(255,255,255,0.45)', marginBottom: 12 },
    trustWrap: { marginBottom: 16 },

    statsRow: {
      flexDirection: 'row',
      width: '100%',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 4,
      justifyContent: 'center',
    },
    statBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 8 },
    statInner: { alignItems: 'center' },
    statValue: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: p.secondary },
    statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Outfit_400Regular', marginTop: 2 },

    // Menu
    menuCard: {
      ...neu.raised,
      marginHorizontal: 16,
      marginTop: 20,
      borderRadius: 14,
      overflow: 'hidden',
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 44,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    menuIcon: {
      ...neu.subtle,
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    menuLabel: { flex: 1, fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.text },

    // Legal
    legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 8 },
    legalLink: { fontSize: 13, color: p.primary, fontFamily: 'Outfit_700Bold' },
    legalDot: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: `${p.text}40` },

    // Logout
    logoutBtn: {
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 999,
      borderColor: `${p.error}4D`,
    },
    logoutBtnContent: { paddingVertical: 4 },
    logoutText: { fontSize: 15, fontFamily: 'Outfit_700Bold' },

    version: { fontSize: 11, color: `${p.text}4D`, textAlign: 'center', marginTop: 16, fontFamily: 'Outfit_400Regular' },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}
