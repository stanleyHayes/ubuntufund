import { payoutInstitutionName } from '@ubuntu-fund/types'
import { campaignPayoutBreakdownRows } from '@ubuntu-fund/types'
import type { CampaignPayoutBreakdown } from '@ubuntu-fund/types'
import { randomUUID } from 'expo-crypto'
import { EmptyState } from './EmptyState'
import type { SavedAccount } from './SavedPayoutAccounts'
import { useEffect, useState, useRef } from 'react'
import { AppState, View } from 'react-native'
import { PayoutHistoryCard } from './PayoutHistoryCard'
import { Text } from 'react-native-paper'
import type { Payout, PayoutType } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { Button, Skeleton } from './Loading'
import { BrandedTextInput as Input } from './BrandedTextInput'
import { SelectionField } from './SelectionField'
import { useNeu } from '@/context/ColorModeContext'
type Options = {
  breakdown?: CampaignPayoutBreakdown
  eligible: number
  requiresEarlyCashout: boolean
  fees: Record<string, number>
  recipient: {
    accountName: string
    last4: string
    verificationStatus?: string
    resolvedAccountName?: string
  } | null
}
const round = (n: number) => Math.round(n * 100) / 100
export function CampaignCashout({ campaignId }: { campaignId: string }) {
  const [destination, setDestination] = useState('paystack')
  const requestKey = useRef({ details: '', key: '' })
  const [accounts, setAccounts] = useState<SavedAccount[]>([])
  const [savedAccountId, setSavedAccountId] = useState('')
  useEffect(() => {
    let active = true
    api
      .get<{ accounts: SavedAccount[] }>('/payout-accounts')
      .then((d) => {
        if (active) setAccounts(d.accounts)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  const neu = useNeu()
  const [options, setOptions] = useState<Options | null>(null)
  const [history, setHistory] = useState<Payout[]>([])
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([])
  const [rail, setRail] = useState('mobile_money')
  const [bankCode, setBank] = useState('')
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<PayoutType>('standard')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    api
      .get<Payout[]>(`/campaigns/${campaignId}/payouts`)
      .then(async (history) => {
        const options = await api.get<Options>(`/campaigns/${campaignId}/payout-options`)
        return [options, history] as const
      })
      .then(async ([o, h]) => {
        if (!active) return
        setOptions(o)
        setHistory(h)
        setType((t) => (o.requiresEarlyCashout && !['early', 'urgent'].includes(t) ? 'early' : t))
        setError('')

        // Listing payouts is a pure read now, so ask the provider explicitly for
        // any still in flight. A server-side per-payout lease bounds this, so
        // repeated opens still cause at most one provider call per window.
        const inFlight = h.filter((p) => p.status === 'PROCESSING' && !p.legs?.length)
        if (!inFlight.length) return
        const settled = await Promise.all(
          inFlight.map((p) =>
            api
              .post<Payout | null>(`/campaigns/${campaignId}/payouts/${p.id}/refresh`)
              .catch(() => null),
          ),
        )
        if (!active) return
        const byId = new Map(settled.filter(Boolean).map((p) => [p!.id, p!]))
        if (byId.size) setHistory((rows) => rows.map((row) => byId.get(row.id) ?? row))
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [campaignId, revision])
  useEffect(() => {
    const refresh = () => setRevision((r) => r + 1)
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh()
    }, 30000)
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh()
    })
    return () => {
      clearInterval(timer)
      listener.remove()
    }
  }, [])
  useEffect(() => {
    let active = true
    api
      .get<{ code: string; name: string }[]>(`/banks?currency=GHS&type=${rail}`)
      .then((b) => {
        if (active) setBanks(b)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [rail])
  const f = options?.fees ?? {}
  const value = Number(amount)
  const fee =
    type === 'standard'
      ? 0
      : Math.min(
          value,
          round(
            type === 'assisted'
              ? (value * f.assistedFeePercent) / 100 + f.assistedFixedFee
              : Math.max(
                  round((value * f[`${type}FeePercent`]) / 100),
                  f[`${type}MinFee`],
                  ...(type === 'urgent'
                    ? [round((value * f.earlyFeePercent) / 100), f.earlyMinFee]
                    : []),
                ),
          ),
        )
  const cap = round(
    (options?.eligible ?? 0) *
      (['early', 'urgent'].includes(type) ? f.earlyMaxWithdrawalPercent / 100 : 1),
  )
  async function submit(recipient: boolean) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (recipient) {
        await api.post(
          `/campaigns/${campaignId}/payout-recipient`,
          savedAccountId
            ? { savedAccountId }
            : { type: rail, accountNumber: account, accountName: name, bankCode },
        )
        setNotice(
          'Account submitted. Check the verification result below; ownership is reviewed before transfer.',
        )
      } else {
        const details = JSON.stringify({ campaignId, amount: value, type, destination })
        if (requestKey.current.details !== details)
          requestKey.current = { details, key: randomUUID() }
        const p = await api.post<Payout>(`/campaigns/${campaignId}/payouts`, {
          amount: value,
          idempotencyKey: requestKey.current.key,
          type,
          ...(destination === 'ujimora_wallet'
            ? { destination, idempotencyKey: requestKey.current.key }
            : {}),
        })
        requestKey.current = { details: '', key: '' }
        setNotice(
          `Request ${p.id}: ${p.status === 'PENDING' ? 'awaiting admin review' : p.status === 'PAID' ? 'completed' : p.providerStatus === 'otp' ? 'awaiting Paystack authorization' : 'processing'}. Fee GHS ${p.fee.toFixed(2)}; net GHS ${p.netAmount.toFixed(2)}.`,
        )
        setAmount('')
      }
      setRevision((r) => r + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save cashout request.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <View style={{ ...neu.raised, padding: 20, borderRadius: 20, gap: 16 }}>
      <Text variant="titleLarge">Cashout & payout history</Text>
      {error && <Text accessibilityRole="alert">{error}</Text>}
      {notice && <Text accessibilityRole="alert">{notice}</Text>}
      {!options && !error && (
        <View
          accessibilityLabel="Loading payout details"
          accessibilityState={{ busy: true }}
          style={{ gap: 16 }}
        >
          <Skeleton width="65%" height={36} />
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton width="50%" height={44} />
          <Skeleton height={90} />
        </View>
      )}
      {options && (
        <>
          <Text variant="titleMedium">GHS {options.eligible.toFixed(2)} eligible balance</Text>
          {options.breakdown && (
            <View style={{ gap: 10, paddingVertical: 16 }}>
              <Text variant="titleSmall">How your balance is calculated</Text>
              {options.breakdown.lockedPlatformFeePercent !== undefined && (
                <Text>
                  Campaign plan rate: {options.breakdown.lockedPlatformFeePercent}% (locked at
                  creation). Upgrading does not change this campaign’s rate.
                </Text>
              )}
              {campaignPayoutBreakdownRows(options.breakdown).map((row) => (
                <View
                  key={row.label}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
                >
                  <Text style={{ flex: 1 }}>{row.label}</Text>
                  <Text style={{ fontWeight: '700' }}>GHS {row.amount.toFixed(2)}</Text>
                </View>
              ))}
              <Text variant="bodySmall">
                These are recorded fees per donation, rounded per payment. Plan changes can mean
                different rates. They are not charged again at cashout. Optional Ujimora tips are
                separate.
              </Text>
              {options.breakdown.raisedDifference !== 0 && (
                <Text>
                  The campaign total differs from accounted donations by GHS{' '}
                  {Math.abs(options.breakdown.raisedDifference).toFixed(2)}. This is not a fee and
                  needs reconciliation before it can be included.
                </Text>
              )}
            </View>
          )}
          <Text>
            Eligible proceeds may await clearance. Admin approval is required. Test funds cannot pay
            out real money.
          </Text>
          <SelectionField
            label="Receive funds in"
            value={destination}
            onChange={setDestination}
            options={[
              { value: 'paystack', label: 'Bank or mobile money' },
              { value: 'ujimora_wallet', label: 'Ujimora Wallet' },
            ]}
          />
          {destination === 'ujimora_wallet' ? (
            <Text>
              The net amount will be credited to your GHS wallet after admin approval. The same fees
              and early-cashout rules apply.
            </Text>
          ) : (
            <>
              {options.recipient && (
                <Text>
                  Account: {options.recipient.accountName} · ending {options.recipient.last4}
                </Text>
              )}
              {options.recipient && (
                <Text>
                  {options.recipient.verificationStatus === 'name_matched'
                    ? 'Registered name matched. Ownership and receiving capacity still require review.'
                    : 'Account needs admin verification before transfer.'}
                  {options.recipient.resolvedAccountName
                    ? ` Provider name: ${options.recipient.resolvedAccountName}`
                    : ''}
                </Text>
              )}
              <SelectionField
                label="Saved payout account"
                value={savedAccountId}
                onChange={setSavedAccountId}
                options={[
                  { value: '', label: 'Add a new account' },
                  ...accounts.map((a) => ({
                    value: a.id,
                    label: `${a.accountName} · ${payoutInstitutionName(a.bankCode, a.bankCode)} · ${a.last4}`,
                  })),
                ]}
              />
              {!savedAccountId && (
                <>
                  <SelectionField
                    label="Account type"
                    value={rail}
                    onChange={(v) => {
                      setRail(v)
                      setBank('')
                    }}
                    options={[
                      { value: 'mobile_money', label: 'Mobile money' },
                      { value: 'ghipss', label: 'Bank account' },
                    ]}
                  />
                  <SelectionField
                    label="Bank or mobile network"
                    value={bankCode}
                    onChange={setBank}
                    options={banks.map((b) => ({ value: b.code, label: b.name }))}
                  />
                  <Input label="Account holder name" value={name} onChangeText={setName} />
                  <Input
                    label="Account or phone number"
                    value={account}
                    onChangeText={setAccount}
                    keyboardType="phone-pad"
                  />
                </>
              )}
              <Button
                disabled={
                  busy || (!savedAccountId && (!name.trim() || !account.trim() || !bankCode))
                }
                onPress={() => void submit(true)}
              >
                Verify & save payout account
              </Button>
              <Text>
                Check that your account can receive the net payout. MoMo wallet-balance and
                transaction limits vary by network and verification tier. We cannot read your
                balance or remaining allowance. MTN: *170# → My Wallet → Check Wallet Limits.
                Consider a verified bank account for larger payouts or ask your network about
                upgrading your wallet. Never share your MoMo PIN.
              </Text>
            </>
          )}
          <SelectionField
            label="Cashout service"
            value={type}
            onChange={(v) => setType(v as PayoutType)}
            options={(options.requiresEarlyCashout
              ? ['early', 'urgent']
              : ['standard', 'priority', 'early', 'urgent', 'assisted']
            ).map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
          />
          <Input
            label="Cashout amount (GHS)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[25, 50, 100].map((percent) => (
              <Button
                key={percent}
                mode="outlined"
                disabled={busy || !Number.isFinite(cap) || cap <= 0}
                onPress={() => setAmount(round((cap * percent) / 100).toFixed(2))}
              >
                {percent === 100 ? 'Max' : `${percent}%`}
              </Button>
            ))}
          </View>
          <Text>Maximum GHS {cap.toFixed(2)}</Text>
          {value > 0 && Number.isFinite(fee) && (
            <View style={{ gap: 8, paddingVertical: 12 }}>
              {[
                ['Amount requested', value],
                ['Additional cashout service fee', -fee],
                ['You receive', round(value - fee)],
              ].map(([label, amount]) => (
                <View
                  key={String(label)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
                >
                  <Text style={{ flex: 1 }}>{label}</Text>
                  <Text style={{ fontWeight: '700' }}>GHS {Number(amount).toFixed(2)}</Text>
                </View>
              ))}
              <Text variant="bodySmall">
                Plan and processing fees are already deducted. Only the selected cashout service fee
                is subtracted here.
              </Text>
            </View>
          )}
          <Button
            mode="contained"
            loading={busy}
            disabled={
              busy ||
              (destination !== 'ujimora_wallet' && !options.recipient) ||
              !Number.isFinite(value) ||
              value <= fee ||
              value > cap
            }
            onPress={() => void submit(false)}
          >
            Request cashout
          </Button>
          <Text>
            Pending requests await review. Do not retry processing transfers. For failed or reversed
            payouts, refresh your balance and correct account or limit issues first. Contact support
            with the payout reference if review is needed.
          </Text>
          <Text variant="titleMedium">Payout history</Text>
          {history.length === 0 && (
            <EmptyState
              icon="bank-transfer"
              title="No payout requests yet"
              subtitle="Your cashout and wallet transfer requests will appear here."
            />
          )}
          {history.map((p) => (
            <PayoutHistoryCard key={p.id} payout={p} />
          ))}
        </>
      )}
      <Button onPress={() => setRevision((r) => r + 1)}>Refresh payout details</Button>
    </View>
  )
}
