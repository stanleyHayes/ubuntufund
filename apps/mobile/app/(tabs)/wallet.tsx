import { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Text, Icon, ActivityIndicator, TouchableRipple } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { brandColors } from '@/theme'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { EmptyState } from '@/components/EmptyState'
import { SignInRequired } from '@/components/SignInRequired'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { TransactionType, type Transaction, type Wallet } from '@ubuntu-fund/types'

const WALLET_TYPE_LABEL: Record<string, string> = {
  local: 'Local',
  foreign: 'Foreign',
  crypto: 'Crypto',
}

const ghsFormatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' })

function formatAmount(amount: number) {
  return ghsFormatter.format(amount)
}

function formatDate(value: Date | string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function transactionIcon(type: TransactionType) {
  if (type === TransactionType.DEPOSIT || type === TransactionType.REFUND) return 'arrow-down-left'
  if (type === TransactionType.DONATION) return 'heart-outline'
  return 'arrow-up-right'
}

function isCredit(type: TransactionType) {
  return type === TransactionType.DEPOSIT || type === TransactionType.REFUND
}

export default function WalletTab() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      api.get<Wallet[] | { items: Wallet[] }>('/wallets'),
      api.get<Transaction[] | { items: Transaction[] }>('/wallets/transactions?limit=30'),
    ])
      .then(([walletData, transactionData]) => {
        if (cancelled) return
        setWallets(Array.isArray(walletData) ? walletData : walletData.items ?? [])
        setTransactions(Array.isArray(transactionData) ? transactionData : transactionData.items ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load wallet')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [user])

  const primary = wallets[0]
  const secondary = wallets.slice(1)

  if (!user) {
    return (
      <View style={styles.container}>
        <SignInRequired what="wallet" />
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState variant="error" icon="alert-circle-outline" title="Couldn't load wallet" subtitle={error} />
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

        <View style={styles.secureNote}>
          <Icon source="shield-check-outline" size={18} color={brandColors.success} />
          <Text style={styles.secureNoteText}>Balances update from completed donations, refunds, and verified payment activity.</Text>
        </View>
      </View>

      {/* ═══ WALLETS ═══ */}
      <Text style={styles.sectionTitle}>My Wallets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletScrollView} contentContainerStyle={styles.walletScroll}>
        {wallets.map((w, i) => (
          <FadeInUp key={w.id} index={i}>
            <TouchableRipple style={styles.walletCard} rippleColor="rgba(46,61,47,0.10)">
              <View>
                <View style={styles.walletTypeChip}>
                  <Text style={styles.walletTypeText}>{WALLET_TYPE_LABEL[w.type] ?? w.type}</Text>
                </View>
                <Text style={styles.walletCurrency}>{w.currency}</Text>
                <Text style={styles.walletBalance}>{w.balance.toLocaleString()}</Text>
              </View>
            </TouchableRipple>
          </FadeInUp>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {transactions.length === 0 ? (
        <EmptyState style={styles.transactionsEmpty} icon="receipt-text-outline" title="No wallet activity yet" subtitle="Completed wallet activity will appear here." />
      ) : (
        <View style={styles.transactionList}>
          {transactions.map((transaction, index) => {
            const credit = isCredit(transaction.type)
            return (
              <View key={transaction.id} style={[styles.transactionRow, index === transactions.length - 1 && styles.transactionRowLast]}>
                <View style={styles.transactionIcon}>
                  <Icon source={transactionIcon(transaction.type)} size={19} color={credit ? brandColors.success : brandColors.primary} />
                </View>
                <View style={styles.transactionCopy}>
                  <Text style={styles.transactionTitle}>{transaction.type.replaceAll('_', ' ')}</Text>
                  <Text style={styles.transactionDate}>{formatDate(transaction.createdAt)} · {transaction.status}</Text>
                </View>
                <Text style={[styles.transactionAmount, credit && styles.transactionCredit]}>
                  {credit ? '+' : '−'}{formatAmount(transaction.amount)}
                </Text>
              </View>
            )
          })}
        </View>
      )}
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
    fontFamily: 'Outfit_700Bold',
    color: brandColors.secondaryDark,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: { fontSize: 28, fontFamily: 'Outfit_800ExtraBold', color: brandColors.text, marginTop: 4 },
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
  balanceValue: { fontSize: 32, fontFamily: 'Outfit_800ExtraBold', color: brandColors.text, marginBottom: 2 },
  balanceSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },

  secureNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(26,46,34,0.08)' },
  secureNoteText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary },

  // Section
  sectionTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: brandColors.text, paddingHorizontal: 20, marginBottom: 12 },

  // Wallets
  walletScrollView: { flexGrow: 0, marginBottom: 28 },
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
  walletTypeText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: brandColors.text },
  walletCurrency: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.textSecondary, marginBottom: 2 },
  walletBalance: { fontSize: 20, fontFamily: 'Outfit_800ExtraBold', color: brandColors.text },

  transactionList: { marginHorizontal: 20, borderRadius: 14, backgroundColor: brandColors.surface, borderWidth: 1, borderColor: 'rgba(26,46,34,0.10)', overflow: 'hidden' },
  transactionRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(26,46,34,0.08)' },
  transactionRowLast: { borderBottomWidth: 0 },
  transactionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,181,160,0.22)' },
  transactionCopy: { flex: 1 },
  transactionTitle: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.text, textTransform: 'capitalize' },
  transactionDate: { marginTop: 2, fontSize: 10, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, textTransform: 'capitalize' },
  transactionAmount: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: brandColors.text },
  transactionCredit: { color: brandColors.success },

  // Empty state
  transactionsEmpty: { paddingTop: 40 },
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
  emptyTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: brandColors.text, textAlign: 'center' },
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
