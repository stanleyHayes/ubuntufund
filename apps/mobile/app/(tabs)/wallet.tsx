import { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Text, Icon, ActivityIndicator, TouchableRipple } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brandColors } from '@/theme'
import { api } from '@/lib/api'
import type { Wallet } from '@ubuntu-fund/types'

const WALLET_TYPE_LABEL: Record<string, string> = {
  local: 'Local',
  foreign: 'Foreign',
  crypto: 'Crypto',
}

const ACTIONS: { icon: string; label: string }[] = [
  { icon: 'arrow-down', label: 'Deposit' },
  { icon: 'arrow-up', label: 'Withdraw' },
  { icon: 'swap-horizontal', label: 'Transfer' },
]

const ghsFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' })

function formatAmount(amount: number) {
  return ghsFormatter.format(amount)
}

function ActionTile({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.actionTile}>
      <TouchableRipple style={styles.actionIcon} rippleColor="rgba(46,61,47,0.16)">
        <Icon source={icon} size={22} color={brandColors.primary} />
      </TouchableRipple>
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
  )
}

export default function WalletTab() {
  const insets = useSafeAreaInsets()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const primary = wallets[0]
  const secondary = wallets.slice(1)

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered, { paddingHorizontal: 32 }]}>
        <View style={styles.errorIconTile}>
          <Icon source="alert-circle-outline" size={24} color={brandColors.error} />
        </View>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.eyebrow}>WALLET</Text>
        <Text style={styles.title}>Your Balance</Text>
        <Text style={styles.lede}>Track balances across your linked wallets.</Text>
      </View>

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceValue}>
          {primary ? formatAmount(primary.balance) : '—'}
        </Text>
        {secondary.map((w) => (
          <Text key={w.id} style={styles.balanceSub}>+ {formatAmount(w.balance)}</Text>
        ))}

        <View style={styles.actionRow}>
          {ACTIONS.map((a) => (
            <ActionTile key={a.label} icon={a.icon} label={a.label} />
          ))}
        </View>
      </View>

      {/* ═══ WALLETS ═══ */}
      <Text style={styles.sectionTitle}>My Wallets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletScrollView} contentContainerStyle={styles.walletScroll}>
        {wallets.map((w) => (
          <TouchableRipple key={w.id} style={styles.walletCard} rippleColor="rgba(46,61,47,0.10)">
            <View>
              <View style={styles.walletTypeChip}>
                <Text style={styles.walletTypeText}>{WALLET_TYPE_LABEL[w.type] ?? w.type}</Text>
              </View>
              <Text style={styles.walletCurrency}>{w.currency}</Text>
              <Text style={styles.walletBalance}>{w.balance.toLocaleString()}</Text>
            </View>
          </TouchableRipple>
        ))}
      </ScrollView>

      {/* Transactions placeholder — endpoint not yet available */}
      <View style={styles.emptyState}>
        <View style={styles.emptyIconTile}>
          <Icon source="receipt-text-outline" size={24} color={brandColors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Transaction history coming soon</Text>
        <Text style={styles.emptyBody}>Check back soon — your activity will appear here.</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  content: { paddingBottom: 32 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'TTSquares-Bold',
    color: brandColors.secondaryDark,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: { fontSize: 28, fontFamily: 'TTSquares-Black', color: brandColors.text, marginTop: 4 },
  lede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginTop: 6 },

  // Balance card
  balanceCard: {
    backgroundColor: brandColors.surface,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    padding: 20,
    marginBottom: 28,
  },
  balanceLabel: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginBottom: 4 },
  balanceValue: { fontSize: 32, fontFamily: 'TTSquares-Black', color: brandColors.text, marginBottom: 2 },
  balanceSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  actionTile: { flex: 1, alignItems: 'center' },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(168,181,160,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  actionLabel: { fontSize: 12, fontFamily: 'TTSquares-Bold', color: brandColors.text },

  // Section
  sectionTitle: { fontSize: 16, fontFamily: 'TTSquares-Bold', color: brandColors.text, paddingHorizontal: 20, marginBottom: 12 },

  // Wallets
  walletScrollView: { flexGrow: 0 },
  walletScroll: { paddingHorizontal: 16, gap: 10, alignItems: 'flex-start' },
  walletCard: {
    width: 150,
    padding: 16,
    borderRadius: 14,
    backgroundColor: brandColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(26,46,34,0.10)',
    overflow: 'hidden',
  },
  walletTypeChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168,181,160,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 10,
  },
  walletTypeText: { fontSize: 11, fontFamily: 'TTSquares-Bold', color: brandColors.text },
  walletCurrency: { fontSize: 13, fontFamily: 'TTSquares-Bold', color: brandColors.textSecondary, marginBottom: 2 },
  walletBalance: { fontSize: 20, fontFamily: 'TTSquares-Black', color: brandColors.text },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  emptyIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(168,181,160,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontFamily: 'TTSquares-Bold', color: brandColors.text, textAlign: 'center' },
  emptyBody: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 18 },

  // Error state
  errorIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(165,67,47,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorText: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: brandColors.error, textAlign: 'center' },
})
