import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from 'react-native-paper'
import type { Payout, PayoutType } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { Button } from './Loading'
import { BrandedTextInput as Input } from './BrandedTextInput'
import { SelectionField } from './SelectionField'
import { useNeu } from '@/context/ColorModeContext'
type Options = { eligible: number; requiresEarlyCashout: boolean; fees: Record<string, number>; recipient: { accountName: string; last4: string } | null }
const round = (n: number) => Math.round(n * 100) / 100
export function CampaignCashout({ campaignId }: { campaignId: string }) {
  const neu = useNeu(); const [options, setOptions] = useState<Options | null>(null); const [history, setHistory] = useState<Payout[]>([])
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]); const [rail, setRail] = useState('mobile_money'); const [bankCode, setBank] = useState(''); const [name, setName] = useState(''); const [account, setAccount] = useState(''); const [amount, setAmount] = useState(''); const [type, setType] = useState<PayoutType>('standard'); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0)
  useEffect(() => { let active = true; Promise.all([api.get<Options>(`/campaigns/${campaignId}/payout-options`), api.get<Payout[]>(`/campaigns/${campaignId}/payouts`)]).then(([o,h]) => { if (active) { setOptions(o); setHistory(h); setType(t => o.requiresEarlyCashout && !['early','urgent'].includes(t) ? 'early' : t); setError('') } }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [campaignId, revision])
  useEffect(() => { let active = true; api.get<{code:string;name:string}[]>(`/banks?currency=GHS&type=${rail}`).then(b => { if (active) setBanks(b) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [rail])
  const f = options?.fees ?? {}; const value = Number(amount); const fee = type === 'standard' ? 0 : Math.min(value, round(type === 'assisted' ? value * f.assistedFeePercent / 100 + f.assistedFixedFee : Math.max(round(value * f[`${type}FeePercent`] / 100), f[`${type}MinFee`], ...(type === 'urgent' ? [round(value * f.earlyFeePercent / 100), f.earlyMinFee] : []))))
  const cap = round((options?.eligible ?? 0) * (['early','urgent'].includes(type) ? f.earlyMaxWithdrawalPercent / 100 : 1))
  async function submit(recipient: boolean) {
    setBusy(true); setError(''); setNotice('')
    try {
      if (recipient) { await api.post(`/campaigns/${campaignId}/payout-recipient`, { type: rail, accountNumber: account, accountName: name, bankCode }); setNotice('Payout account saved.') }
      else { const p = await api.post<Payout>(`/campaigns/${campaignId}/payouts`, { amount: value, type }); setNotice(`Request awaiting admin approval. Fee GHS ${p.fee.toFixed(2)}; net GHS ${p.netAmount.toFixed(2)}. No transfer sent yet.`); setAmount('') }
      setRevision(r => r + 1)
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not save cashout request.') } finally { setBusy(false) }
  }
  return <View style={{ ...neu.raised, padding: 20, borderRadius: 20, gap: 16 }}><Text variant="titleLarge">Cashout & payout history</Text>{error && <Text accessibilityRole="alert">{error}</Text>}{notice && <Text accessibilityRole="alert">{notice}</Text>}
    {options && <><Text variant="titleMedium">GHS {options.eligible.toFixed(2)} eligible balance</Text><Text>The regular plan fee is already deducted. Early cashout adds a service fee. Test funds cannot pay out real money.</Text>{options.recipient && <Text>Account: {options.recipient.accountName} · ending {options.recipient.last4}</Text>}
    <SelectionField label="Account type" value={rail} onChange={v => { setRail(v); setBank('') }} options={[{value:'mobile_money',label:'Mobile money'},{value:'ghipss',label:'Bank account'}]} />
    <SelectionField label="Bank or mobile network" value={bankCode} onChange={setBank} options={banks.map(b => ({value:b.code,label:b.name}))} />
    <Input label="Account holder name" value={name} onChangeText={setName}/><Input label="Account or phone number" value={account} onChangeText={setAccount} keyboardType="phone-pad"/>
    <Button disabled={busy || !name.trim() || !account.trim() || !bankCode} onPress={() => void submit(true)}>Save payout account</Button>
    <SelectionField label="Cashout service" value={type} onChange={v => setType(v as PayoutType)} options={(options.requiresEarlyCashout ? ['early','urgent'] : ['standard','priority','early','urgent','assisted']).map(t => ({value:t,label:t.charAt(0).toUpperCase()+t.slice(1)}))}/>
    <Input label="Cashout amount (GHS)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/><Text>Maximum GHS {cap.toFixed(2)}</Text>
    {value > 0 && Number.isFinite(fee) && <Text>Estimated fee GHS {fee.toFixed(2)} · You receive GHS {(value-fee).toFixed(2)}</Text>}
    <Button mode="contained" loading={busy} disabled={busy || !options.recipient || !Number.isFinite(value) || value <= fee || value > cap} onPress={() => void submit(false)}>Request cashout</Button>
    <Text variant="titleMedium">Payout history</Text>{history.length === 0 && <Text>No payout requests yet.</Text>}{history.map(p => <Text key={p.id}>GHS {p.amount.toFixed(2)} · {p.type} · {p.status}</Text>)}</>}
    <Button onPress={() => setRevision(r => r+1)}>Refresh payout details</Button></View>
}
