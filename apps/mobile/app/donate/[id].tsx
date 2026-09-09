import { useEffect, useState } from 'react'
import { View, ScrollView } from 'react-native'
import { Text, Checkbox } from 'react-native-paper'
import { Stack, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCampaign } from '@/hooks/useCampaigns'
import { useAuth } from '@/context/AuthContext'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { SelectionField } from '@/components/SelectionField'
import { Button, PageSkeleton } from '@/components/Loading'
import { PaymentStatus } from '@/components/PaymentStatus'
import { CryptoContribution } from '@/components/CryptoContribution'
import { checkout, clearPending, loadPending, paymentScope, type PendingPayment } from '@/lib/payments'

export default function DonateScreen() {
  const { id, liveSessionId, amount: presetAmount } = useLocalSearchParams<{ id: string; liveSessionId?: string; amount?: string }>()
  const { campaign, isLoading, error: campaignError } = useCampaign(id || '')
  const { user } = useAuth(); const p = usePalette(); const neu = useNeu()
  const [amount, setAmount] = useState(presetAmount || '')
  const [tip, setTip] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [name, setName] = useState(user?.name || '')
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [method, setMethod] = useState('paystack')
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scope = paymentScope('donation', id || '')
  useEffect(() => { let active = true; void loadPending(scope).then(v => { if (active) setPending(v) }); return () => { active = false } }, [scope])
  const currentPending = pending?.storageKey === scope ? pending : null
  const valid = Number.isFinite(Number(amount)) && Number(amount) > 0 && Number(amount) === Math.round(Number(amount) * 100) / 100
  const tipValue = Number(tip || '0')
  const tipValid = Number.isFinite(tipValue) && tipValue >= 0 && tipValue === Math.round(tipValue * 100) / 100
  async function donate() {
    setBusy(true); setError('')
    try {
      const result = await checkout(scope, '/donation-intents', { campaignId: id, liveSessionId, amount: Number(amount), tip: tipValue || undefined, provider: method, donorEmail: email || undefined, donorName: name || undefined, message: message || undefined, isAnonymous: anonymous })
      setPending(result)
      if (result.authorizationUrl?.startsWith('https://')) await WebBrowser.openBrowserAsync(result.authorizationUrl)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start checkout.') }
    finally { setBusy(false) }
  }
  if (isLoading) return <PageSkeleton />
  return <ScrollView automaticallyAdjustKeyboardInsets style={{ flex: 1, backgroundColor: p.background }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>
    <Stack.Screen options={{ title: 'Support this campaign' }} />
    <Text style={{ fontFamily: 'Outfit_800ExtraBold', fontSize: 26, color: p.text }}>{campaign?.title || 'Campaign donation'}</Text>
    {campaignError && <Text style={{ color: p.error }}>{campaignError}</Text>}
    {currentPending ? <PaymentStatus key={currentPending.id} payment={currentPending} onReset={() => { void clearPending(scope).then(() => setPending(null)) }} /> : campaign?.status !== 'active' ? <Text>This campaign is not accepting donations.</Text> : <View style={{ ...neu.raised, backgroundColor: p.surface, padding: 20, borderRadius: 24, gap: 16 }}>
      <TextInput label={`Amount (${campaign.currency})`} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <TextInput label="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput label="Name (optional)" value={name} onChangeText={setName} />
      <TextInput label="Message (optional)" value={message} onChangeText={setMessage} multiline />
      <Checkbox.Item label="Donate anonymously" status={anonymous ? 'checked' : 'unchecked'} onPress={() => setAnonymous(v => !v)} />
      <SelectionField label="Payment method" value={method} onChange={setMethod} options={[{ value: 'paystack', label: 'Card or mobile money · secure checkout' }, ...(user ? [{ value: 'wallet', label: 'Ujimora wallet · existing balance' }] : []), { value: 'crypto', label: 'Crypto · supported assets and networks' }]} />
      {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
      {method !== 'crypto' && <TextInput label="Support Ujimora (optional tip)" value={tip} onChangeText={setTip} keyboardType="decimal-pad" />}
      {method === 'crypto' ? <CryptoContribution key={scope} campaignId={id} amount={Number(amount)} email={email.trim()} name={name} message={message} isAnonymous={anonymous} /> : <>
        <Text style={{ color: p.textSecondary }}>{method === 'wallet' ? 'Your existing Ujimora wallet balance funds this donation.' : 'Card and mobile-money availability follows the secure checkout options for this merchant.'}</Text>
        <Button mode="contained" loading={busy} disabled={busy || !valid || !tipValid || (method === 'paystack' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))} onPress={() => void donate()}>Donate {valid && tipValid ? (Number(amount) + tipValue).toFixed(2) : '0'} {campaign.currency}</Button>
      </>}
    </View>}
  </ScrollView>
}
