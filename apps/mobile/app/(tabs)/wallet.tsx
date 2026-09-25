import { TouchableRipple } from '@/components/RoundedControls'
import { SkeletonLoader } from '@/components/Loading'
import { WalletFunding } from '@/components/WalletFunding'
import { useMemo } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { formatAmountValue, formatMoney } from '@/lib/money'
import { useWallet } from '@/hooks/useWallet'
import { useAuth } from '@/context/AuthContext'
import { EmptyState } from '@/components/EmptyState'
import { SignInRequired } from '@/components/SignInRequired'
import { FadeInUp } from '@/components/anim/FadeInUp'
import { TransactionType } from '@ubuntu-fund/types'
import { KeyboardAvoider } from '@/components/KeyboardAvoider'

const WALLET_TYPE_LABEL: Record<string, string> = {
  local: 'Local',
  foreign: 'Foreign',
  crypto: 'Crypto',
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
  const { wallets, transactions, isLoading, refreshing, loaded, error, reload, refresh } = useWallet(user?.id)

  const primary = wallets[0]
  const secondary = wallets.slice(1)

  if (!user) {
    return (
      <View style={styles.container}>
        <SignInRequired what="wallet" />
      </View>
    )
  }

  // The full-screen states apply only before anything has loaded; a later
  // reload keeps the current balance on screen.
  if (isLoading && !loaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <SkeletonLoader size="large" color={p.primary} />
      </View>
    )
  }

  if (error && !loaded) {
    return (
      <View style={styles.container}>
        <EmptyState variant="error" icon="alert-circle-outline" title="Couldn't load wallet" subtitle={error} ctaLabel="Try again" ctaIcon="refresh" onCtaPress={reload} />
      </View>
    )
  }

  return (
    <KeyboardAvoider style={styles.container}>
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.primary} colors={[p.primary]} />}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.eyebrow}>WALLET</Text>
        <Text style={styles.title}>Your Balance</Text>
        <Text style={styles.lede}>Track balances across your linked wallets.</Text>
        {error ? <Text accessibilityRole="alert" style={{ color: p.error, marginTop: 8 }}>Couldn't refresh your wallet: {error} Pull down to try again.</Text> : null}
      </View>

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceValue}>
          {primary ? formatMoney(primary.balance, primary.currency) : '—'}
        </Text>
        {secondary.map((w) => (
          <Text key={w.id} style={styles.balanceSub}>+ {formatMoney(w.balance, w.currency)}</Text>
        ))}

        <View style={styles.secureNote}>
          <Icon source="shield-check-outline" size={18} color={p.success} />
          <Text style={styles.secureNoteText}>Balances update from completed donations, refunds, and verified payment activity.</Text>
        </View>
      </View>

      {wallets.find(w => w.currency === 'GHS') && <WalletFunding walletId={wallets.find(w => w.currency === 'GHS')!.id} onComplete={reload} />}

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
                <Text style={styles.walletBalance}>{formatAmountValue(w.balance)}</Text>
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
                  {credit ? '+' : '−'}{formatMoney(transaction.amount, transaction.currency)}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
    </KeyboardAvoider>
  )
}
