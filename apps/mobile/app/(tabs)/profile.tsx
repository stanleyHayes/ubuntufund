import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import { Text, Icon, ActivityIndicator } from 'react-native-paper'
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
  { icon: 'view-dashboard', label: 'Dashboard', color: '#00695C', route: '/dashboard' },
  { icon: 'bullhorn', label: 'My Campaigns', color: '#2E7D32', route: '/my-campaigns' },
  { icon: 'heart', label: 'My Donations', color: '#E53935', route: '/my-donations' },
  { icon: 'wallet', label: 'Wallet', color: '#1565C0', route: '/(tabs)/wallet' },
  { icon: 'trophy', label: 'Leaderboard', color: '#F57F17', route: '/leaderboard' },
  { icon: 'email-open', label: 'Invitations', color: '#6A1B9A', route: '/invitations' },
  { icon: 'shield-check', label: 'Verification', color: '#00695C', route: '/verification' },
  { icon: 'crown', label: 'Subscription', color: '#F9A825', route: '/(tabs)/subscription' },
  { icon: 'cog', label: 'Settings', color: '#78909C', route: '/settings' },
  { icon: 'file-document-outline', label: 'Terms of Service', color: '#78909C', route: '/terms' },
  { icon: 'lock-outline', label: 'Privacy Policy', color: '#6A1B9A', route: '/privacy' },
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
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, i === MENU_ITEMS.length - 1 && { borderBottomWidth: 0 }]}
              activeOpacity={0.7}
              onPress={() => router.push(item.route as never)}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}14` }]}>
                <Icon source={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Icon source="chevron-right" size={18} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Legal links */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push('/terms')}>
            <Text style={styles.legalLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => router.push('/privacy')}>
            <Text style={styles.legalLink}>Privacy</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Icon source="logout" size={18} color="#E53935" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>UbuntuFund v1.0.0</Text>

        <View style={{ height: 32 }} />
      </Animated.View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F4' },

  // Hero
  hero: {
    backgroundColor: '#0A1A0D',
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
  avatarText: { fontSize: 28, fontFamily: 'TTSquares-Black', color: '#1B5E20' },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0A1A0D',
    borderRadius: 12,
    padding: 2,
  },

  userName: { fontSize: 22, fontFamily: 'TTSquares-Black', color: '#FFFFFF', marginBottom: 2 },
  userEmail: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: 'rgba(255,255,255,0.45)', marginBottom: 12 },
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
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'TTSquares-Regular', marginTop: 2 },

  // Menu
  menuCard: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#1a1a1a' },

  // Legal
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 8 },
  legalLink: { fontSize: 13, color: brandColors.primary, fontFamily: 'TTSquares-Bold' },
  legalDot: { fontSize: 13, fontFamily: 'TTSquares-Regular', color: '#ccc' },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.2)',
    backgroundColor: 'rgba(229,57,53,0.04)',
  },
  logoutText: { fontSize: 15, fontFamily: 'TTSquares-Bold', color: '#E53935' },

  version: { fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 16, fontFamily: 'TTSquares-Regular' },
})
