import { campaignPayoutBreakdownRows } from '@ubuntu-fund/types'
import type { CampaignPayoutBreakdown } from '@ubuntu-fund/types'
import { EmptyState } from '@ubuntu-fund/ui'
import type { Account } from '@/components/account/SavedPayoutAccounts'
import { useCallback, useEffect, useState, useRef } from 'react'
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
  Skeleton,
  Link,
} from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import type { Payout, PayoutType } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

type Options = {
  breakdown?: CampaignPayoutBreakdown
  requiresEarlyCashout?: boolean
  eligible: number
  currency: string
  fees: Record<string, number>
  recipient: {
    accountName: string
    last4: string
    type: string
    verificationStatus?: string
    resolvedAccountName?: string
  } | null
}
type Bank = { code: string; name: string }
const types: PayoutType[] = ['standard', 'priority', 'early', 'urgent', 'assisted']
const round = (n: number) => Math.round(n * 100) / 100
export function CampaignCashout({
  campaignId,
  initiallyExpanded = false,
}: {
  campaignId: string
  initiallyExpanded?: boolean
}) {
  const [destination, setDestination] = useState('paystack')
  const requestKey = useRef({ details: '', key: '' })
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [options, setOptions] = useState<Options | null>(null)
  const [history, setHistory] = useState<Payout[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [savedAccountId, setSavedAccountId] = useState('')
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
  const refresh = useCallback(() => {
    setError('')
    setRevision((v) => v + 1)
  }, [])
  useEffect(() => {
    if (!expanded) return
    let active = true
    api
      .get<{ accounts: Account[] }>('/payout-accounts')
      .then((d) => {
        if (active) setAccounts(d.accounts)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    Promise.all([
      api.get<Options>(`/campaigns/${campaignId}/payout-options`),
      api.get<Payout[]>(`/campaigns/${campaignId}/payouts`),
    ])
      .then(([o, h]) => {
        if (active) {
          setOptions(o)
          setType((current) =>
            o.requiresEarlyCashout && current !== 'early' && current !== 'urgent'
              ? 'early'
              : current,
          )
          setHistory(h)
          setError('')
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [campaignId, expanded, revision])
  useEffect(() => {
    if (!expanded) return
    let active = true
    api
      .get<Bank[]>(`/banks?currency=GHS&type=${recipientType}`)
      .then((b) => {
        if (active) setBanks(b)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [expanded, recipientType])
  const value = Number(amount)
  const f = options?.fees ?? {}
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
  const cap = options
    ? round(
        options.eligible *
          (type === 'early' || type === 'urgent' ? f.earlyMaxWithdrawalPercent / 100 : 1),
      )
    : 0
  const valid =
    (destination === 'ujimora_wallet' || Boolean(options?.recipient)) &&
    Number.isFinite(value) &&
    value > fee &&
    value <= cap
  const money = (n: number) =>
    `${options?.currency ?? 'GHS'} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  async function saveRecipient() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.post(
        `/campaigns/${campaignId}/payout-recipient`,
        savedAccountId
          ? { savedAccountId }
          : { type: recipientType, bankCode, accountName, accountNumber },
      )
      setNotice(
        'Account submitted. Check the name-verification result below; beneficiary ownership is reviewed before transfer.',
      )
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save payout account.')
    } finally {
      setBusy(false)
    }
  }
  async function requestPayout() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const details = JSON.stringify({ campaignId, amount: value, type, destination })
      if (requestKey.current.details !== details)
        requestKey.current = { details, key: crypto.randomUUID() }
      const p = await api.post<Payout>(`/campaigns/${campaignId}/payouts`, {
        amount: value,
        type,
        ...(destination === 'ujimora_wallet'
          ? { destination, idempotencyKey: requestKey.current.key }
          : {}),
      })
      setNotice(
        `Request submitted for admin review. Fee: ${money(p.fee)}. You receive: ${money(p.netAmount)}. No transfer has been sent yet.`,
      )
      requestKey.current = { details: '', key: '' }
      setAmount('')
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not request cashout.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Accordion
      id="payout-account"
      expanded={expanded}
      onChange={(_, open) => setExpanded(open)}
      sx={{ my: 3 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Typography sx={{ fontWeight: 800 }}>Cashout & payout history</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {error && (
          <Alert severity="error" action={<Button onClick={refresh}>Retry</Button>}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {notice}
          </Alert>
        )}
        {!options ? (
          !error ? (
            <Box
              role="status"
              aria-label="Loading payout details"
              aria-busy="true"
              sx={{
                display: 'grid',
                gap: 2,
                '& .MuiSkeleton-root': {
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                },
              }}
            >
              <Skeleton width="55%" height={40} />
              <Skeleton width="95%" />
              <Skeleton width="80%" />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" width={160} height={44} />
              <Skeleton width="35%" height={32} />
              <Skeleton variant="rounded" height={90} />
            </Box>
          ) : null
        ) : (
          <>
            <Typography variant="h6">{money(options.eligible)} eligible balance</Typography>
            {options.breakdown && (
              <Box
                sx={{
                  my: 2,
                  p: { xs: 2, sm: 3 },
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  boxShadow: 'var(--neu-inset)',
                }}
              >
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  How your balance is calculated
                </Typography>
                {options.breakdown.lockedPlatformFeePercent !== undefined && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Campaign plan rate: {options.breakdown.lockedPlatformFeePercent}% (locked when
                    this campaign was created). Upgrading your plan does not change this campaign’s
                    locked rate.
                  </Typography>
                )}
                {campaignPayoutBreakdownRows(options.breakdown).map((row, index, rows) => (
                  <Box
                    key={row.label}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 2,
                      py: 1,
                      ...(index === rows.length - 1
                        ? { borderTop: '1px solid', borderColor: 'divider', mt: 1 }
                        : {}),
                    }}
                  >
                    <Typography variant="body2">{row.label}</Typography>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {money(row.amount)}
                    </Typography>
                  </Box>
                ))}
                <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 2 }}>
                  Fees above are the amounts recorded for each donation, rounded per payment.
                  Paystack fees apply to the full checkout payment, including any optional tip.
                  Wallet donations have no payment processing fee. Plan changes can result in
                  different rates across donations. They are not charged again when you cash out.
                  Optional tips to Ujimora are separate from campaign funds.
                </Typography>
                {options.breakdown.tips > 0 && (
                  <Typography variant="caption" component="p" sx={{ mt: 1 }}>
                    Optional tips to Ujimora: {money(options.breakdown.tips)}. These are in addition
                    to the campaign total and are not payable to the organizer.
                  </Typography>
                )}
                {options.breakdown.raisedDifference !== 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    The campaign total and accounted donations differ by{' '}
                    {money(Math.abs(options.breakdown.raisedDifference))}. This is not a fee. The
                    difference needs reconciliation before it can be included in the payout balance.
                  </Alert>
                )}
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Eligible balance includes recorded proceeds awaiting clearance. Requests require admin
              approval; bank and MoMo transfers also require provider funding. Test payments cannot
              be withdrawn as real money.
            </Typography>
            <TextField
              select
              fullWidth
              label="Receive funds in"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              sx={{ my: 2 }}
            >
              <MenuItem value="paystack">Bank or mobile money</MenuItem>
              <MenuItem value="ujimora_wallet">Ujimora Wallet</MenuItem>
            </TextField>
            {destination === 'ujimora_wallet' ? (
              <Alert severity="info">
                The net amount will be credited to your Ujimora GHS wallet after admin approval. The
                same cashout fees and early-withdrawal rules apply. You can use wallet funds to
                support campaigns.
              </Alert>
            ) : (
              <>
                {options.recipient && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Payout account: {options.recipient.accountName} · ending{' '}
                    {options.recipient.last4}
                  </Alert>
                )}
                {options.recipient && (
                  <Alert
                    severity={
                      options.recipient.verificationStatus === 'name_matched' ? 'info' : 'warning'
                    }
                    sx={{ mb: 2 }}
                  >
                    {options.recipient.verificationStatus === 'name_matched'
                      ? 'Registered account name matched. Ownership and receiving capacity still require review.'
                      : 'Account verification needs admin review. Saving this account does not confirm it can receive funds.'}
                    {options.recipient.resolvedAccountName &&
                      ` Provider name: ${options.recipient.resolvedAccountName}.`}
                  </Alert>
                )}
                <TextField
                  select
                  fullWidth
                  label="Use a saved payout account"
                  value={savedAccountId}
                  onChange={(e) => setSavedAccountId(e.target.value)}
                  sx={{ my: 2 }}
                >
                  <MenuItem value="">Add a new account</MenuItem>
                  {accounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.accountName} · {a.bankCode} · {a.last4}
                    </MenuItem>
                  ))}
                </TextField>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                  <Link
                    href="/payout-accounts"
                    variant="caption"
                    underline="hover"
                    color="text.secondary"
                  >
                    Manage saved accounts ↗
                  </Link>
                </Box>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>
                  {options.recipient ? 'Change payout account' : 'Add your payout account'}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                    mb: 2,
                    ...(savedAccountId ? { display: 'none' } : {}),
                  }}
                >
                  <TextField
                    select
                    label="Account type"
                    value={recipientType}
                    onChange={(e) => {
                      setRecipientType(e.target.value)
                      setBankCode('')
                    }}
                  >
                    <MenuItem value="mobile_money">Mobile money</MenuItem>
                    <MenuItem value="ghipss">Bank account</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Bank or mobile network"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                  >
                    {banks.map((b) => (
                      <MenuItem key={b.code} value={b.code}>
                        {b.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Account holder name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                  <TextField
                    label="Account or mobile money number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </Box>
                <Button
                  disabled={
                    busy ||
                    (!savedAccountId && (!bankCode || !accountName.trim() || !accountNumber.trim()))
                  }
                  onClick={() => void saveRecipient()}
                >
                  Verify & save payout account
                </Button>
                <Alert severity="info" sx={{ mt: 2 }}>
                  Before cashout, confirm your account can receive the net amount. MoMo has
                  wallet-balance and transaction limits that vary by network and verification tier.
                  We cannot read your balance or remaining allowance. MTN: *170# → My Wallet → Check
                  Wallet Limits. For larger payouts, consider a verified bank account or ask your
                  network about a wallet upgrade. Never share your MoMo PIN.
                </Alert>
              </>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                my: 3,
              }}
            >
              <TextField
                label="Cashout amount (GHS)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              />
              <TextField
                select
                label="Cashout service"
                value={type}
                onChange={(e) => setType(e.target.value as PayoutType)}
              >
                {types
                  .filter((t) => !options.requiresEarlyCashout || t === 'early' || t === 'urgent')
                  .map((t) => (
                    <MenuItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </MenuItem>
                  ))}
              </TextField>
            </Box>
            <Typography variant="body2">
              Maximum for this service: {money(cap)}.{' '}
              {type === 'early' || type === 'urgent'
                ? `Keeps ${100 - f.earlyMaxWithdrawalPercent}% of the current eligible balance in reserve.`
                : type === 'standard'
                  ? 'Standard cashout has no additional Ujimora service fee.'
                  : 'The selected service adds the fee shown below.'}
            </Typography>
            {value > 0 && Number.isFinite(fee) && (
              <Box
                sx={{ my: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                {[
                  ['Amount requested', value],
                  ['Additional cashout service fee', -fee],
                  ['You receive', round(value - fee)],
                ].map(([label, amount]) => (
                  <Box
                    key={String(label)}
                    sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}
                  >
                    <Typography fontWeight={label === 'You receive' ? 700 : 400}>
                      {label}
                    </Typography>
                    <Typography fontWeight={700}>{money(Number(amount))}</Typography>
                  </Box>
                ))}
                <Typography variant="caption" color="text.secondary">
                  Plan and payment processing fees above are already deducted. This quote subtracts
                  only the selected cashout service fee.
                </Typography>
              </Box>
            )}
            <Button
              variant="contained"
              sx={{ mt: 2 }}
              disabled={busy || !valid}
              onClick={() => void requestPayout()}
            >
              {busy ? 'Saving…' : 'Request cashout'}
            </Button>
            <Typography variant="h6" sx={{ mt: 4 }}>
              Payout history
            </Typography>
            <Button size="small" onClick={refresh}>
              Refresh status
            </Button>
            <Typography variant="body2" color="text.secondary">
              Pending requests await review. Processing transfers must be confirmed before retrying.
              For failed or reversed transfers, refresh your balance and correct the account or its
              limits before submitting a new request. If review is needed, contact support with the
              payout reference; do not submit a duplicate.
            </Typography>
            {history.length === 0 && (
              <EmptyState
                compact
                variant="noData"
                title="No payout requests yet"
                description="Your requests and their status will appear here after you submit a cashout or wallet transfer."
              />
            )}
            {history.map((p) => (
              <Box key={p.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography>
                  {money(p.amount)} · {p.type} · {p.status.replaceAll('_', ' ')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fee {money(p.fee)} · Net {money(p.netAmount)} ·{' '}
                  {new Date(p.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
            ))}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  )
}
