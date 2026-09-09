import { SkeletonLoader } from '@/components/Loading'
import { WalletFunding } from '@/components/WalletFunding'
import { useCallback } from 'react'
import { useState, useEffect, useMemo } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { Text, Icon, TouchableRipple } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
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

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    content: { paddingBottom: 32 },
    centered: { justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { paddingHorizontal: 20, paddingBottom: 20 },
    eyebrow: {
      fontSize: 11,
      fontFamily: 'Outfit_700Bold',
      color: p.secondaryDark,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    title: { fontSize: 28, fontFamily: 'Outfit_800ExtraBold', color: p.text, marginTop: 4 },
    lede: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 6 },

    // Balance card
    balanceCard: {
      ...neu.raised,
      backgroundColor: p.surface,
      marginHorizontal: 20,
      borderRadius: 14,
      padding: 20,
      marginBottom: 28,
    },
    balanceLabel: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginBottom: 4 },
    balanceValue: { fontSize: 32, fontFamily: 'Outfit_800ExtraBold', color: p.text, marginBottom: 2 },
    balanceSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary },

    secureNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: p.border },
    secureNoteText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Outfit_400Regular', color: p.textSecondary },

    // Section
    sectionTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text, paddingHorizontal: 20, marginBottom: 12 },

    // Wallets
    walletScrollView: { flexGrow: 0, marginBottom: 28 },
    walletScroll: { paddingHorizontal: 16, gap: 10, alignItems: 'flex-start' },
    walletCard: {
      ...neu.raised,
      width: 150,
      padding: 16,
      borderRadius: 14,
      backgroundColor: p.surface,
      overflow: 'hidden',
    },
    walletTypeChip: {
      alignSelf: 'flex-start',
      backgroundColor: `${p.textSecondary}47`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      marginBottom: 10,
    },
    walletTypeText: { fontSize: 11, fontFamily: 'Outfit_700Bold', color: p.text },
    walletCurrency: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: p.textSecondary, marginBottom: 2 },
    walletBalance: { fontSize: 20, fontFamily: 'Outfit_800ExtraBold', color: p.text },

    transactionList: { ...neu.raised, marginHorizontal: 20, borderRadius: 14, overflow: 'hidden' },
    transactionRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border },
    transactionRowLast: { borderBottomWidth: 0 },
    transactionIcon: { ...neu.subtle, width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    transactionCopy: { flex: 1 },
    transactionTitle: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: p.text, textTransform: 'capitalize' },
    transactionDate: { marginTop: 2, fontSize: 10, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textTransform: 'capitalize' },
    transactionAmount: { fontSize: 13, fontFamily: 'Outfit_700Bold', color: p.text },
    transactionCredit: { color: p.success },

    // Empty state
    transactionsEmpty: { paddingTop: 40 },
    emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
    emptyIconTile: {
      ...neu.subtle,
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: `${p.textSecondary}47`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    emptyTitle: { fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.text, textAlign: 'center' },
    emptyBody: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 18 },

    // Error state
    errorIconTile: {
      ...neu.subtle,
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: `${p.error}1F`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    errorText: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: p.error, textAlign: 'center' },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

export default function WalletTab() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [revision, setRevision] = useState(0)
  const refreshed = useCallback(() => setRevision(n => n + 1), [])
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
  }, [user, revision])

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
        <SkeletonLoader size="large" color={p.primary} />
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
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <Icon source="shield-check-outline" size={18} color={p.success} />
          <Text style={styles.secureNoteText}>Balances update from completed donations, refunds, and verified payment activity.</Text>
        </View>
      </View>

      {wallets.find(w => w.currency === 'GHS') && <WalletFunding walletId={wallets.find(w => w.currency === 'GHS')!.id} onComplete={refreshed} />}

      {/* ═══ WALLETS ═══ */}
      <Text style={styles.sectionTitle}>My Wallets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletScrollView} contentContainerStyle={styles.walletScroll}>
        {wallets.map((w, i) => (
          <FadeInUp key={w.id} index={i}>
            <TouchableRipple style={styles.walletCard} rippleColor={p.ripple}>
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
                  <Icon source={transactionIcon(transaction.type)} size={19} color={credit ? p.success : p.primary} />
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
