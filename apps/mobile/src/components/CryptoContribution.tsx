import QRCode from 'react-native-qrcode-svg'
import { useEffect, useState, useCallback } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Clipboard from 'expo-clipboard'
import type { CryptoAssetInfo, CryptoQuote, CryptoDepositView } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { paymentKey, paymentScope, clearPending, isPaymentTerminal, cryptoStatusFromIntent } from '@/lib/payments'
import { SelectionField } from './SelectionField'
import { Button, Skeleton } from './Loading'
import { PaymentStatus } from './PaymentStatus'
import { usePalette } from '@/context/ColorModeContext'

export function CryptoContribution({ campaignId, amount, email, name, message, isAnonymous }: { campaignId: string; amount: number; email: string; name: string; message: string; isAnonymous: boolean }) {
  const p = usePalette()
  const scope = paymentScope('crypto', campaignId)
  const [assets, setAssets] = useState<CryptoAssetInfo[] | null>(null)
  const [asset, setAsset] = useState('')
  const [network, setNetwork] = useState('')
  const [quote, setQuote] = useState<CryptoQuote | null>(null)
  const [deposit, setDeposit] = useState<CryptoDepositView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    let active = true
    api.get<{ enabled: boolean; assets: CryptoAssetInfo[] }>('/payments/crypto/assets').then(data => { if (active) setAssets(data.enabled ? data.assets : []) }).catch(e => { if (active) { setError(e.message); setAssets([]) } })
    AsyncStorage.getItem(`${scope}:deposit`).then(raw => { if (active && raw) { try { setDeposit(JSON.parse(raw)) } catch { /* Invalid local draft can be recreated. */ } } })
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => { active = false; clearInterval(timer) }
  }, [scope, retry])
  const selected = assets?.find(a => a.asset === asset)
  const valid = Number.isFinite(amount) && amount > 0 && amount === Math.round(amount * 100) / 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const expired = !quote || Date.parse(quote.expiresAt) <= now || quote.fiatAmount !== amount || quote.asset !== asset || quote.network !== network
  async function getQuote() {
    setBusy(true); setError('')
    try { setQuote(await api.post<CryptoQuote>(`/campaigns/${campaignId}/donations/crypto/quote`, { fiatAmount: amount, asset, network })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Quote unavailable.') } finally { setBusy(false) }
  }
  async function accept() {
    if (!quote || expired) return
    setBusy(true); setError('')
    try {
      const input = { quoteId: quote.quoteId, donorEmail: email, donorName: name || undefined, message: message || undefined, isAnonymous }
      const result = await api.post<CryptoDepositView>(`/campaigns/${campaignId}/donations/crypto`, { ...input, idempotencyKey: await paymentKey(scope, input) })
      await AsyncStorage.setItem(`${scope}:deposit`, JSON.stringify(result)); setDeposit(result)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create a deposit.') } finally { setBusy(false) }
  }
  const changedStatus = useCallback((status: string) => {
    setDeposit(previous => {
      const mapped = cryptoStatusFromIntent(status)
      if (!previous || !mapped || previous.status === mapped) return previous
      return { ...previous, status: mapped }
    })
  }, [])
  useEffect(() => { if (deposit) void AsyncStorage.setItem(`${scope}:deposit`, JSON.stringify(deposit)).catch(() => {}) }, [scope, deposit])
  if (!assets) return <Skeleton height={180} />
  return <View style={{ gap: 16 }}>
    {error ? <><Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text><Button onPress={() => { setError(''); setRetry(value => value + 1) }}>Retry connection</Button></> : null}
    {deposit ? <>
      {!isPaymentTerminal(deposit.status) && <>
      <Text variant="titleLarge">{deposit.cryptoAmount} {deposit.asset} · {deposit.network}</Text>
      <Text>Send only this asset on this network. Sending another asset or using another network may permanently lose funds.</Text>
      <View style={{ padding: 12, backgroundColor: 'white', alignSelf: 'center' }} accessibilityLabel="Deposit address QR code"><QRCode value={deposit.walletAddress} size={190} quietZone={10} /></View>
      <Text>The QR code contains the address only. Confirm the network and enter the exact amount and any required memo separately.</Text>
      <Text selectable>{deposit.walletAddress}</Text><Button icon="content-copy" onPress={() => void Clipboard.setStringAsync(deposit.walletAddress)}>Copy address</Button>
      {deposit.addressTag && <><Text selectable>Required memo / tag: {deposit.addressTag}</Text><Button onPress={() => void Clipboard.setStringAsync(deposit.addressTag!)}>Copy memo / tag</Button></>}
      <Text>{Date.parse(deposit.expiresAt) <= now ? 'Payment window expired. Do not send more funds; check the payment status.' : `Payment window ends ${new Date(deposit.expiresAt).toLocaleString()}`}</Text>
      </>}
      <PaymentStatus onStatusChange={changedStatus} payment={{ id: deposit.donationIntentId, status: deposit.status, storageKey: scope }} onReset={() => { void clearPending(scope).then(() => { setDeposit(null); setQuote(null) }) }} />
    </> : assets.length ? <>
      <SelectionField label="Crypto asset" value={asset} options={assets.map(a => ({ value: a.asset, label: a.label }))} onChange={v => { setAsset(v); setNetwork(''); setQuote(null) }} />
      <SelectionField label="Network" value={network} options={selected?.networks.map(n => ({ value: n.id, label: n.label })) || []} onChange={v => { setNetwork(v); setQuote(null) }} disabled={!selected} />
      <Button mode="outlined" disabled={busy || !valid || !network} loading={busy} onPress={() => void getQuote()}>Get quote</Button>
      {quote && <>
        <Text>Send {quote.cryptoAmount} {quote.asset} on {quote.network} for {quote.fiatCurrency} {quote.fiatAmount}.</Text>
        <Text>Exchange rate: 1 {quote.asset} = {quote.rate} {quote.fiatCurrency}</Text>
        {quote.providerFeeFiat !== undefined && <Text>Provider fee: {quote.providerFeeFiat} {quote.fiatCurrency}</Text>}
        {quote.networkFeeFiat !== undefined && <Text>Network fee: {quote.networkFeeFiat} {quote.fiatCurrency}</Text>}
        <Text>{expired ? 'Quote changed or expired. Get a new quote.' : `Quote expires ${new Date(quote.expiresAt).toLocaleTimeString()}`}</Text>
        <Button mode="contained" disabled={busy || expired || !valid} loading={busy} onPress={() => void accept()}>Accept quote and get address</Button>
      </>}
    </> : <Text>Crypto donations are not currently available.</Text>}
  </View>
}
