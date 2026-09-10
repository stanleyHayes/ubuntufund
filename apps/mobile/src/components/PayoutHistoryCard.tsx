import { View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import type { Payout } from '@ubuntu-fund/types'
import { usePalette } from '@/context/ColorModeContext'
import { GlassSurface } from './GlassSurface'

export function PayoutHistoryCard({ payout: p }: { payout: Payout }) {
  const palette = usePalette()
  const wallet = p.provider === 'ujimora_wallet'
  const status =
    p.status === 'PAID'
      ? 'Completed'
      : p.status === 'PROCESSING' && p.providerStatus === 'otp'
        ? 'Awaiting authorization'
        : p.status.replaceAll('_', ' ').toLowerCase()
  const money = (amount: number) =>
    `${p.currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <GlassSurface style={{ padding: 20, borderRadius: 20, marginVertical: 8, overflow: 'hidden' }}>
      <View
        pointerEvents="none"
        accessible={false}
        style={{
          position: 'absolute',
          right: -20,
          top: 10,
          opacity: 0.06,
          transform: [{ rotate: '-18deg' }],
        }}
      >
        <Icon
          source={wallet ? 'wallet-outline' : 'bank-transfer'}
          size={150}
          color={palette.primary}
        />
      </View>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <Text style={{ color: palette.textSecondary }}>
          {wallet ? 'Ujimora Wallet' : 'Bank / mobile money'}
        </Text>
        <Text
          style={{
            color: p.status === 'PAID' ? palette.success : palette.primary,
            fontFamily: 'Outfit_700Bold',
            textTransform: 'capitalize',
          }}
        >
          {status}
        </Text>
      </View>
      <Text variant="titleMedium" style={{ marginTop: 16, textTransform: 'capitalize' }}>
        {p.type} cashout
      </Text>
      <Text variant="bodySmall" style={{ color: palette.textSecondary, marginTop: 16 }}>
        {p.status === 'PAID' ? 'AMOUNT RECEIVED' : 'EXPECTED NET AMOUNT'}
      </Text>
      <Text variant="headlineMedium" style={{ fontFamily: 'Outfit_700Bold', marginVertical: 8 }}>
        {money(p.netAmount)}
      </Text>
      <View style={{ borderTopWidth: 1, borderColor: palette.border, paddingTop: 12, gap: 8 }}>
        <Text>Requested · {money(p.amount)}</Text>
        <Text>Cashout service fee · {money(p.fee)}</Text>
        <Text style={{ color: palette.textSecondary }}>
          {new Date(p.createdAt).toLocaleDateString()}
        </Text>
        <Text selectable variant="bodySmall" style={{ color: palette.textSecondary }}>
          Request · {p.id}
        </Text>
        {p.providerRef && (
          <Text selectable variant="bodySmall" style={{ color: palette.textSecondary }}>
            Transfer · {p.providerRef}
          </Text>
        )}
      </View>
    </GlassSurface>
  )
}
