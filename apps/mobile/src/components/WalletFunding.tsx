import { useEffect, useState } from 'react'
import { Linking, Platform, View } from 'react-native'
import { Text } from 'react-native-paper'
import * as WebBrowser from 'expo-web-browser'
import { api } from '@/lib/api'
import { checkout, clearPending, loadPending, paymentScope, type PendingPayment } from '@/lib/payments'
import { BrandedTextInput as TextInput } from './BrandedTextInput'
import { Button, Skeleton } from './Loading'
import { PaymentStatus } from './PaymentStatus'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import { walletFundingUrl } from '@/lib/fundraising'
import { parseMoneyInput, validTopUpAmount } from '@/lib/moneyInput'

export function WalletFunding(props: { walletId: string; onComplete: () => void }) {
  return Platform.OS === 'ios' ? <ExternalWalletFunding /> : <InAppWalletFunding {...props} />
}

/** App Review 3.2.1(vi)/3.2.2: wallet balance pays for donations, so iOS adds funds on the website like donations do. */
function ExternalWalletFunding() {
  const p = usePalette(); const neu = useNeu()
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  async function open() {
    setOpening(true); setError('')
    try { await Linking.openURL(walletFundingUrl()) }
    catch { setError('Could not open the Ujimora website. Please try again.') }
    finally { setOpening(false) }
  }
  return <View style={{ ...neu.raised, backgroundColor: p.surface, padding: 20, borderRadius: 24, gap: 12, marginBottom: 20 }}>
    <Text variant="titleLarge">Fund your wallet</Text>
    <Text>Wallet top-ups are made on the Ujimora website. Sign in there to add funds; your balance here updates after payment verification.</Text>
    <Button mode="contained" icon="open-in-new" loading={opening} disabled={opening} onPress={() => void open()}>Continue in browser</Button>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
  </View>
}

function InAppWalletFunding({ walletId, onComplete }: { walletId: string; onComplete: () => void }) {
  const p = usePalette(); const neu = useNeu()
  const [config, setConfig] = useState<{ enabled: boolean; mode: string } | null>(null)
  const [amount, setAmount] = useState('100')
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const scope = paymentScope('topup', walletId)
  useEffect(() => {
    let active = true
    api.get<{ enabled: boolean; mode: string }>('/wallets/topups/config').then(v => { if (active) setConfig(v) }).catch(e => { if (active) { setError(e.message); setConfig({ enabled: false, mode: 'unknown' }) } })
    void loadPending(scope).then(v => { if (active) setPending(v) }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not recover the saved payment.') })
    return () => { active = false }
  }, [scope, retry])
  async function fund() {
    setBusy(true); setError('')
    try {
      const result = await checkout(scope, '/wallets/topups', { walletId, amount: parseMoneyInput(amount) }, true)
      setPending(result)
      if (result.authorizationUrl?.startsWith('https://')) await WebBrowser.openBrowserAsync(result.authorizationUrl)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start wallet funding.') }
    finally { setBusy(false) }
  }
  if (pending?.storageKey === scope) return <PaymentStatus payment={pending} topup onComplete={onComplete} onReset={() => { void clearPending(scope).then(() => setPending(null)) }} />
  if (!config) return <Skeleton height={180} />
  return <View style={{ ...neu.raised, backgroundColor: p.surface, padding: 20, borderRadius: 24, gap: 12, marginBottom: 20 }}>
    <Text variant="titleLarge">Fund your wallet</Text>
    <Text>Use card or mobile money to add funds. Your wallet is credited after payment verification.</Text>
    {config.mode === 'test' && <Text style={{ color: p.warningText }}>Test mode: this checkout does not collect live money.</Text>}
    {config.enabled ? <>
      <TextInput label="Top-up amount (GHS)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <Text style={{ color: p.textSecondary, fontSize: 12 }}>GHS 1–10,000, at most two decimals.</Text>
      <Button mode="contained" loading={busy} disabled={busy || !validTopUpAmount(amount)} onPress={() => void fund()}>Fund wallet</Button>
    </> : <Text>Wallet funding is not currently available.</Text>}
    {error ? <><Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text><Button onPress={() => { setError(''); setRetry(value => value + 1) }}>Retry connection</Button></> : null}
  </View>
}
