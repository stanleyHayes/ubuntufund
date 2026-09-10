import { useCallback, useEffect, useState } from 'react'
import { Accordion, AccordionSummary, AccordionDetails, Alert, Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import type { Payout, PayoutType } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

type Options = { requiresEarlyCashout?: boolean; eligible: number; currency: string; fees: Record<string, number>; recipient: { accountName: string; last4: string; type: string; verificationStatus?: string; resolvedAccountName?: string } | null }
type Bank = { code: string; name: string }
const types: PayoutType[] = ['standard', 'priority', 'early', 'urgent', 'assisted']
const round = (n: number) => Math.round(n * 100) / 100
export function CampaignCashout({ campaignId, initiallyExpanded = false }: { campaignId: string; initiallyExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [options, setOptions] = useState<Options | null>(null)
  const [history, setHistory] = useState<Payout[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [recipientType, setRecipientType] = useState('mobile_money')
  const [bankCode, setBankCode] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<PayoutType>('standard')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  useEffect(() => {
    if (!expanded) return
    let active = true
    Promise.all([api.get<Options>(`/campaigns/${campaignId}/payout-options`), api.get<Payout[]>(`/campaigns/${campaignId}/payouts`)])
      .then(([o, h]) => { if (active) { setOptions(o); setType(current => o.requiresEarlyCashout && current !== 'early' && current !== 'urgent' ? 'early' : current); setHistory(h); setError('') } })
      .catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [campaignId, expanded, revision])
  useEffect(() => {
    if (!expanded) return
    let active = true
    api.get<Bank[]>(`/banks?currency=GHS&type=${recipientType}`).then(b => { if (active) setBanks(b) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [expanded, recipientType])
  const value = Number(amount)
  const f = options?.fees ?? {}
  const fee = type === 'standard' ? 0 : Math.min(value, round(type === 'assisted' ? value * f.assistedFeePercent / 100 + f.assistedFixedFee : Math.max(round(value * f[`${type}FeePercent`] / 100), f[`${type}MinFee`], ...(type === 'urgent' ? [round(value * f.earlyFeePercent / 100), f.earlyMinFee] : []))))
  const cap = options ? round(options.eligible * (type === 'early' || type === 'urgent' ? f.earlyMaxWithdrawalPercent / 100 : 1)) : 0
  const valid = Boolean(options?.recipient) && Number.isFinite(value) && value > fee && value <= cap
  const money = (n: number) => `${options?.currency ?? 'GHS'} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  async function saveRecipient() {
    setBusy(true); setError(''); setNotice('')
    try {
      await api.post(`/campaigns/${campaignId}/payout-recipient`, { type: recipientType, bankCode, accountName, accountNumber })
      setNotice('Account submitted. Check the name-verification result below; beneficiary ownership is reviewed before transfer.'); refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save payout account.') }
    finally { setBusy(false) }
  }
  async function requestPayout() {
    setBusy(true); setError(''); setNotice('')
    try {
      const p = await api.post<Payout>(`/campaigns/${campaignId}/payouts`, { amount: value, type })
      setNotice(`Request submitted for admin review. Fee: ${money(p.fee)}. You receive: ${money(p.netAmount)}. No transfer has been sent yet.`)
      setAmount(''); refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not request cashout.') }
    finally { setBusy(false) }
  }
  return <Accordion id="payout-account" expanded={expanded} onChange={(_, open) => setExpanded(open)} sx={{ my: 3 }}>
    <AccordionSummary expandIcon={<ExpandMoreRounded />}><Typography sx={{ fontWeight: 800 }}>Cashout & payout history</Typography></AccordionSummary>
    <AccordionDetails>
      {error && <Alert severity="error" action={<Button onClick={refresh}>Retry</Button>}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {!options ? <Typography>Loading payout details…</Typography> : <>
        <Typography variant="h6">{money(options.eligible)} eligible balance</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Based on settled campaign proceeds after the regular plan and payment fees. Early cashout adds a separate service fee. Requests require admin approval and sufficient Paystack transfer balance. Test payments cannot be withdrawn as real money.</Typography>
        {options.recipient && <Alert severity="info" sx={{ mb: 2 }}>Payout account: {options.recipient.accountName} · ending {options.recipient.last4}</Alert>}
        {options.recipient && <Alert severity={options.recipient.verificationStatus === 'name_matched' ? 'info' : 'warning'} sx={{ mb: 2 }}>{options.recipient.verificationStatus === 'name_matched' ? 'Registered account name matched. Ownership and receiving capacity still require review.' : 'Account verification needs admin review. Saving this account does not confirm it can receive funds.'}{options.recipient.resolvedAccountName && ` Provider name: ${options.recipient.resolvedAccountName}.`}</Alert>}
        <Typography sx={{ fontWeight: 700, mb: 1 }}>{options.recipient ? 'Change payout account' : 'Add your payout account'}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
          <TextField select label="Account type" value={recipientType} onChange={e => { setRecipientType(e.target.value); setBankCode('') }}><MenuItem value="mobile_money">Mobile money</MenuItem><MenuItem value="ghipss">Bank account</MenuItem></TextField>
          <TextField select label="Bank or mobile network" value={bankCode} onChange={e => setBankCode(e.target.value)}>{banks.map(b => <MenuItem key={b.code} value={b.code}>{b.name}</MenuItem>)}</TextField>
          <TextField label="Account holder name" value={accountName} onChange={e => setAccountName(e.target.value)} />
          <TextField label="Account or mobile money number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
        </Box>
        <Button disabled={busy || !bankCode || !accountName.trim() || !accountNumber.trim()} onClick={() => void saveRecipient()}>Verify & save payout account</Button>
        <Alert severity="info" sx={{ mt: 2 }}>Before cashout, confirm your account can receive the net amount. MoMo has wallet-balance and transaction limits that vary by network and verification tier. We cannot read your balance or remaining allowance. MTN: *170# → My Wallet → Check Wallet Limits. For larger payouts, consider a verified bank account or ask your network about a wallet upgrade. Never share your MoMo PIN.</Alert>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, my: 3 }}>
          <TextField label="Cashout amount (GHS)" type="number" value={amount} onChange={e => setAmount(e.target.value)} slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} />
          <TextField select label="Cashout service" value={type} onChange={e => setType(e.target.value as PayoutType)}>{types.filter(t => !options.requiresEarlyCashout || t === 'early' || t === 'urgent').map(t => <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>)}</TextField>
        </Box>
        <Typography variant="body2">Maximum for this service: {money(cap)}. {type === 'early' || type === 'urgent' ? `Keeps ${100 - f.earlyMaxWithdrawalPercent}% of the current eligible balance in reserve.` : 'Standard cashout has no Ujimora service fee.'}</Typography>
        {value > 0 && Number.isFinite(fee) && <Typography sx={{ my: 1 }}>Estimated fee {money(fee)} · You receive {money(value - fee)}</Typography>}
        <Button variant="contained" sx={{ mt: 2 }} disabled={busy || !valid} onClick={() => void requestPayout()}>{busy ? 'Saving…' : 'Request cashout'}</Button>
        <Typography variant="h6" sx={{ mt: 4 }}>Payout history</Typography>
        <Button size="small" onClick={refresh}>Refresh status</Button>
        <Typography variant="body2" color="text.secondary">Pending requests await review. Processing transfers must be confirmed before retrying. For failed or reversed transfers, refresh your balance and correct the account or its limits before submitting a new request. If review is needed, contact support with the payout reference; do not submit a duplicate.</Typography>
        {history.length === 0 && <Typography color="text.secondary">No payout requests yet.</Typography>}
        {history.map(p => <Box key={p.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}><Typography>{money(p.amount)} · {p.type} · {p.status.replaceAll('_', ' ')}</Typography><Typography variant="body2" color="text.secondary">Fee {money(p.fee)} · Net {money(p.netAmount)} · {new Date(p.createdAt).toLocaleDateString()}</Typography></Box>)}
      </>}
    </AccordionDetails>
  </Accordion>
}
