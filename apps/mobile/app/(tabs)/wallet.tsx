import { useState, useEffect, useRef } from 'react'
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brandColors } from '@/theme'
import { api } from '@/lib/api'
import type { Wallet } from '@ubuntu-fund/types'

const { width } = Dimensions.get('window')

const TX_CONFIG: Record<string, { icon: string; color: string; sign: string; label: string }> = {
  donation: { icon: 'heart', color: '#E53935', sign: '-', label: 'Donation' },
  deposit: { icon: 'arrow-down-circle', color: '#2E7D32', sign: '+', label: 'Deposit' },
  withdrawal: { icon: 'arrow-up-circle', color: '#F57F17', sign: '-', label: 'Withdrawal' },
  transfer: { icon: 'swap-horizontal', color: '#1565C0', sign: '-', label: 'Transfer' },
  refund: { icon: 'undo', color: '#6A1B9A', sign: '+', label: 'Refund' },
  escrow_lock: { icon: 'lock', color: '#E65100', sign: '-', label: 'Escrow Lock' },
  escrow_release: { icon: 'lock-open', color: '#00695C', sign: '+', label: 'Escrow Release' },
}

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`
}

function formatDate(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function WalletTab() {
  const insets = useSafeAreaInsets()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const heroOpacity = useRef(new Animated.Value(0)).current
  const heroSlide = useRef(new Animated.Value(20)).current
  const cardOpacity = useRef(new Animated.Value(0)).current
  const cardSlide = useRef(new Animated.Value(30)).current

  useEffect(() => {
    let cancelled = false
    api
      .get<Wallet[] | { items: Wallet[] }>('/wallets')
      .then((data) => {
        if (!cancelled) setWallets(Array.isArray(data) ? data : data.items ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load wallet')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isLoading) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(heroSlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(cardSlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        ]),
      ]).start()
    }
  }, [isLoading])

  const primary = wallets[0]
  const secondary = wallets.slice(1)

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={{ marginBottom: 12 }}><Icon source="alert-circle-outline" size={40} color="#D32F2F" /></View>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ═══ HERO ═══ */}
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.bgCircle, styles.circleRight]} />
        <View style={[styles.bgCircle, styles.circleLeft]} />

        <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroSlide }], alignItems: 'center' }}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceValue}>
            {primary ? formatAmount(primary.balance, primary.currency) : '—'}
          </Text>
          {secondary.map((w) => (
            <Text key={w.id} style={styles.balanceSub}>+ {formatAmount(w.balance, w.currency)}</Text>
          ))}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn}>
              <View style={styles.actionIcon}>
                <Icon source="arrow-down" size={20} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Deposit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <View style={styles.actionIcon}>
                <Icon source="arrow-up" size={20} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <View style={styles.actionIcon}>
                <Icon source="swap-horizontal" size={20} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Transfer</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* ═══ WALLETS ═══ */}
      <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardSlide }] }}>
        <Text style={styles.sectionTitle}>My Wallets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.walletScroll}>
          {wallets.map((w) => (
            <View key={w.id} style={styles.walletCard}>
              <View style={styles.walletCardTop}>
                <View style={[styles.walletDot, { backgroundColor: w.type === 'local' ? brandColors.primary : '#1565C0' }]} />
                <Text style={styles.walletType}>{w.type === 'local' ? 'Local' : 'Foreign'}</Text>
              </View>
              <Text style={styles.walletCurrency}>{w.currency}</Text>
              <Text style={styles.walletBalance}>{w.balance.toLocaleString()}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Transactions placeholder — endpoint not yet available */}
        <View style={styles.emptyTx}>
          <View style={{ marginBottom: 8 }}><Icon source="inbox-outline" size={32} color="#ccc" /></View>
          <Text style={styles.emptyText}>Transaction history coming soon</Text>
        </View>

        <View style={{ height: 24 }} />
      </Animated.View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F4' },

  // Hero
  hero: {
    backgroundColor: '#0A1A0D',
    paddingBottom: 28,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  bgCircle: { position: 'absolute', borderRadius: 9999, backgroundColor: brandColors.primary, opacity: 0.06 },
  circleRight: { width: width * 0.5, height: width * 0.5, top: -width * 0.15, right: -width * 0.15 },
  circleLeft: { width: width * 0.3, height: width * 0.3, bottom: -width * 0.1, left: -width * 0.05 },

  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: 'TTSquares-Regular', marginBottom: 4 },
  balanceValue: { fontSize: 32, fontFamily: 'TTSquares-Black', color: '#FFFFFF', marginBottom: 2 },
  balanceSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'TTSquares-Regular' },

  actionRow: { flexDirection: 'row', gap: 24, marginTop: 24 },
  actionBtn: { alignItems: 'center' },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'TTSquares-Bold' },

  // Section
  sectionTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: '#1a1a1a', paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },

  // Wallets
  walletScroll: { paddingHorizontal: 16, gap: 10 },
  walletCard: {
    width: 150,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  walletCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  walletDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  walletType: { fontSize: 11, color: '#999', fontFamily: 'TTSquares-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  walletCurrency: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: '#555', marginBottom: 2 },
  walletBalance: { fontSize: 20, fontFamily: 'TTSquares-Black', color: '#1a1a1a' },

  // Transactions
  txList: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 14, fontFamily: 'TTSquares-Bold', color: '#1a1a1a' },
  txDate: { fontSize: 11, fontFamily: 'TTSquares-Regular', color: '#999', marginTop: 1 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontFamily: 'TTSquares-Bold' },
  txStatusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },

  // Empty
  emptyTx: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, fontFamily: 'TTSquares-Regular', color: '#999' },
  errorText: { fontSize: 15, fontFamily: 'TTSquares-Regular', color: '#D32F2F', textAlign: 'center' },
})
