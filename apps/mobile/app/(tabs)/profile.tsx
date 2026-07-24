import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import { Text, Icon, ActivityIndicator, Button, TouchableRipple } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { VerificationLevel } from '@ubuntu-fund/types'
import { TrustBadge } from '@/components/TrustBadge'
import { UbuntuLogo } from '@/components/UbuntuLogo'
import { brandColors } from '@/theme'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

const { width } = Dimensions.get('window')

interface ProfileStats {
  campaignsCount: number
  totalDonated: number
  totalRaised: number
  verificationLevel: string
  trustScore: number
}

const MENU_ITEMS: { icon: string; label: string; color: string; route: string }[] = [
  { icon: 'view-dashboard', label: 'Dashboard', color: brandColors.primary, route: '/dashboard' },
  { icon: 'bullhorn', label: 'My Campaigns', color: brandColors.success, route: '/my-campaigns' },
  { icon: 'heart', label: 'My Donations', color: brandColors.error, route: '/my-donations' },
  { icon: 'wallet', label: 'Wallet', color: brandColors.secondaryDark, route: '/(tabs)/wallet' },
  { icon: 'trophy', label: 'Leaderboard', color: brandColors.secondary, route: '/leaderboard' },
  { icon: 'email-open', label: 'Invitations', color: brandColors.textSecondary, route: '/invitations' },
  { icon: 'shield-check', label: 'Verification', color: brandColors.success, route: '/verification' },
  { icon: 'crown', label: 'Subscription', color: brandColors.secondary, route: '/(tabs)/subscription' },
  { icon: 'cog', label: 'Settings', color: brandColors.textSecondary, route: '/settings' },
  { icon: 'file-document-outline', label: 'Terms of Service', color: brandColors.textSecondary, route: '/terms' },
  { icon: 'lock-outline', label: 'Privacy Policy', color: brandColors.textSecondary, route: '/privacy' },
]

export default function ProfileTab() {
  const { user, logout } = useAuth()
  const insets = useSafeAreaInsets()
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const heroOpacity = useRef(new Animated.Value(0)).current
  const heroSlide = useRef(new Animated.Value(20)).current
  const bodyOpacity = useRef(new Animated.Value(0)).current
  const bodySlide = useRef(new Animated.Value(30)).current

  const fetchProfile = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await api.get<ProfileStats>('/profile')
      setStats(data)
    } catch {
      // silently fail — show zeros
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

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
  }, [statsLoading])

  const displayName = user?.name ?? 'User'
  const displayEmail = user?.email ?? ''
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase()

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ═══ HERO ═══ */}
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.bgCircle, styles.circleRight]} />
        <View style={[styles.bgCircle, styles.circleLeft]} />

        <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroSlide }], alignItems: 'center', width: '100%' }}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.avatarBadge}>
              <UbuntuLogo size={20} />
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
              <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
            ) : (
              <>
                {[
                  { value: stats?.campaignsCount ?? 0, label: 'Campaigns' },
                  { value: `$${stats?.totalDonated ?? 0}`, label: 'Donated' },
                  { value: `$${stats?.totalRaised ?? 0}`, label: 'Raised' },
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
          {MENU_ITEMS.map((item, i) => (
            <TouchableRipple
              key={item.label}
              style={[styles.menuRow, i === MENU_ITEMS.length - 1 && { borderBottomWidth: 0 }]}
              rippleColor="rgba(26,46,34,0.08)"
              onPress={() => router.push(item.route as never)}
            >
              <>
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}14` }]}>
                  <Icon source={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Icon source="chevron-right" size={18} color="rgba(26,46,34,0.3)" />
              </>
            </TouchableRipple>
          ))}
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
          textColor={brandColors.error}
          style={styles.logoutBtn}
          contentStyle={styles.logoutBtnContent}
          labelStyle={styles.logoutText}
        >
          Sign Out
        </Button>

        <Text style={styles.version}>UbuntuFund v1.0.0</Text>

        <View style={{ height: 32 }} />
      </Animated.View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },

  // Hero
  hero: {
    backgroundColor: brandColors.primaryDark,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  bgCircle: { position: 'absolute', borderRadius: 9999, backgroundColor: brandColors.primary, opacity: 0.06 },
  circleRight: { width: width * 0.5, height: width * 0.5, top: -width * 0.15, right: -width * 0.15 },
  circleLeft: { width: width * 0.3, height: width * 0.3, bottom: -width * 0.1, left: -width * 0.05 },

  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: brandColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarText: { fontSize: 28, fontFamily: 'TTSquares-Black', color: brandColors.text },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: brandColors.primaryDark,
    borderRadius: 12,
    padding: 2,
  },

  userName: { fontSize: 22, fontFamily: 'TTSquares-Black', color: '#FFFFFF', marginBottom: 2 },
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
  statValue: { fontSize: 17, fontFamily: 'TTSquares-Bold', color: brandColors.secondary },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Outfit_400Regular', marginTop: 2 },

  // Menu
  menuCard: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,46,34,0.08)',
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'TTSquares-Bold', color: brandColors.text },

  // Legal
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 8 },
  legalLink: { fontSize: 13, color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
  legalDot: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: 'rgba(26,46,34,0.25)' },

  // Logout
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 999,
    borderColor: 'rgba(165,67,47,0.3)',
  },
  logoutBtnContent: { paddingVertical: 4 },
  logoutText: { fontSize: 15, fontFamily: 'TTSquares-Bold' },

  version: { fontSize: 11, color: 'rgba(26,46,34,0.3)', textAlign: 'center', marginTop: 16, fontFamily: 'Outfit_400Regular' },
})
