import { payoutInstitutionName } from '@ubuntu-fund/types'
import { BankPicker } from '@/components/account/BankPicker'
import type { Account } from '@/components/account/SavedPayoutAccounts'
import { AccountPageSkeleton } from '@/components/account/AccountPage'
import { useRef, useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { AccountHeading } from '@/components/account/AccountPage'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import { SHAPE, LoadingDots } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

const INK = 'text.primary'
const INK_SECONDARY = 'text.secondary'

interface Balance {
  availableBalance: number
  paidOutBalance: number
  totalReceived: number
  currency: string
}
interface Profile {
  handle: string
  displayName: string
  tagline?: string
  bio?: string
  tipsEnabled: boolean
  presetAmounts: number[]
  thankYouMessage?: string
  currency: string
}
interface Payout {
  id: string
  amount: number
  fee?: number
  netAmount?: number
  status: string
  createdAt: string
}

export function CreatorDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [policy, setPolicy] = useState<{
    eligible: boolean
    planName: string
    feePercent: number
  } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])

  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [tipsEnabled, setTipsEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [snack, setSnack] = useState('')

  const [accounts, setAccounts] = useState<Account[]>([])
  const [savedAccountId, setSavedAccountId] = useState('')
  useEffect(() => {
    let active = true
    api
      .get<{ accounts: Account[] }>('/payout-accounts')
      .then((d) => {
        if (active) setAccounts(d.accounts)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  const [destination, setDestination] = useState('paystack')
  const requestKey = useRef({ details: '', key: '' })
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [wAmount, setWAmount] = useState(0)
  const [wType, setWType] = useState<'mobile_money' | 'ghipss'>('mobile_money')
  const [wAccount, setWAccount] = useState('')
  const [wBank, setWBank] = useState('')
  const [withdrawBanks, setWithdrawBanks] = useState<{ name: string; code: string }[]>([])
  useEffect(() => {
    if (!withdrawOpen) return
    let active = true
    setWithdrawBanks([])
    api
      .get<{ name: string; code: string }[]>(`/banks?currency=GHS&type=${wType}`)
      .then((banks) => {
        if (active) setWithdrawBanks(banks)
      })
      .catch(() => {
        if (active)
          setWError('Could not load banks. Close and reopen the withdrawal form to retry.')
      })
    return () => {
      active = false
    }
  }, [withdrawOpen, wType])
  const [wName, setWName] = useState('')
  const [wSubmitting, setWSubmitting] = useState(false)
  const [wError, setWError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // /creators/me returns 200 { profile: null } for a genuine first-time
      // creator, so a thrown error here is a REAL failure (5xx, network, expired
      // session) — surface it instead of showing an empty claim form.
      const me = await api.get<{
        profile: Profile | null
        balance: Balance | null
        policy: { eligible: boolean; planName: string; feePercent: number }
      }>('/creators/me')
      setPolicy(me.policy)
      setProfile(me.profile)
      setBalance(me.balance)
      if (me.profile) {
        setHandle(me.profile.handle)
        setDisplayName(me.profile.displayName)
        setTagline(me.profile.tagline ?? '')
        setBio(me.profile.bio ?? '')
        setTipsEnabled(me.profile.tipsEnabled)
        const p = await api.get<Payout[]>('/creators/me/payouts')
        setPayouts(p)
      }
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'We couldn’t load your creator page. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveProfile() {
    setError(null)
    setSaving(true)
    try {
      await api.post('/creators/profile', { handle, displayName, tagline, bio, tipsEnabled })
      setSnack('Your creator page is saved')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your page.')
    } finally {
      setSaving(false)
    }
  }

  async function withdraw() {
    setWError(null)
    setWSubmitting(true)
    try {
      const details = JSON.stringify({ amount: wAmount, destination, fee: policy?.feePercent })
      if (requestKey.current.details !== details)
        requestKey.current = { details, key: crypto.randomUUID() }
      await api.post('/creators/withdraw', {
        amount: wAmount,
        expectedFeePercent: policy?.feePercent,
        ...(destination === 'ujimora_wallet'
          ? { destination, idempotencyKey: requestKey.current.key }
          : savedAccountId
            ? { savedAccountId }
            : {
                recipient: {
                  type: wType,
                  accountNumber: wAccount,
                  bankCode: wBank,
                  accountName: wName || displayName,
                },
              }),
      })
      setWithdrawOpen(false)
      setSnack(
        destination === 'ujimora_wallet'
          ? 'Funds added to your Ujimora Wallet'
          : 'Withdrawal started',
      )
      requestKey.current = { details: '', key: '' }
      await load()
    } catch (err) {
      setWError(err instanceof Error ? err.message : 'Could not start the withdrawal.')
    } finally {
      setWSubmitting(false)
    }
  }

  const fmt = (n: number) => `GH₵${(n ?? 0).toLocaleString()}`
  const pageUrl = profile ? `${window.location.origin}/creators/${profile.handle}` : ''

  if (loading) return <AccountPageSkeleton layout="cards" />

  if (loadError) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 6 } }}>
        <Container maxWidth="sm">
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void load()}>
                Try again
              </Button>
            }
          >
            {loadError}
          </Alert>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="md">
        <AccountHeading
          title="Your creator page"
          description="Get a shareable tip link and receive support — no campaign needed."
          icon={<StorefrontRoundedIcon />}
        />

        {profile && balance && (
          <Box
            sx={{
              p: 3,
              mb: 3,
              borderRadius: SHAPE.card,
              bgcolor: 'background.paper',
              boxShadow: 'var(--neu-raised)',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
                mb: 2,
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: INK_SECONDARY,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Available to withdraw
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: INK }}>
                  {fmt(balance.availableBalance)}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: INK_SECONDARY }}>
                  Received {fmt(balance.totalReceived)} · Withdrawn {fmt(balance.paidOutBalance)}
                </Typography>
              </Box>
              <Button
                variant="contained"
                disabled={balance.availableBalance <= 0}
                onClick={() => {
                  setWAmount(balance.availableBalance)
                  setWithdrawOpen(true)
                }}
                sx={{
                  borderRadius: '999px',
                  fontWeight: 800,
                  textTransform: 'none',
                  px: 3,
                  '&.Mui-disabled': {
                    color: 'text.secondary',
                    bgcolor: 'action.disabledBackground',
                  },
                }}
              >
                Withdraw
              </Button>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                borderRadius: SHAPE.sm,
                bgcolor: 'action.hover',
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
              }}
            >
              <Typography
                sx={{
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  fontSize: '0.85rem',
                  color: INK,
                  flex: 1,
                }}
              >
                {pageUrl}
              </Typography>
              <Button
                size="small"
                startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => {
                  navigator.clipboard?.writeText(pageUrl)
                  setSnack('Link copied')
                }}
                sx={{ textTransform: 'none' }}
              >
                Copy
              </Button>
            </Box>
            <Button
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mt: 1, whiteSpace: 'nowrap' }}
            >
              Preview public page
            </Button>
            <Typography variant="body2" color="text.secondary">
              Visitors see your public profile and support form. Your balance, payout details and
              editing controls stay private.
            </Typography>
          </Box>
        )}

        {!policy?.eligible && (
          <Alert
            severity="info"
            sx={{ mb: 3 }}
            action={
              <Button
                href="/subscription"
                sx={{ whiteSpace: 'nowrap', flexShrink: 0, minWidth: 'max-content' }}
              >
                View plans
              </Button>
            }
          >
            Creator donations require an active paid plan. Upgrade to receive new tips. You can
            still withdraw your existing balance.
          </Alert>
        )}
        {/* Setup / edit */}
        <Box
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: SHAPE.card,
            bgcolor: 'background.paper',
            boxShadow: 'var(--neu-raised)',
          }}
        >
          <Button href="/profile" sx={{ mb: 2 }}>
            Edit your profile photo & cover
          </Button>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: INK, mb: 2 }}>
            {profile ? 'Edit your page' : 'Claim your page'}
          </Typography>
          <TextField
            label="Handle (your link)"
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            fullWidth
            sx={{ mb: 2 }}
            helperText="letters, numbers, - or _ · your link becomes /creators/your-handle"
            disabled={!policy?.eligible}
            slotProps={{ input: { readOnly: !!profile } }}
          />
          <TextField
            disabled={!policy?.eligible}
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            disabled={!policy?.eligible}
            label="Tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="What you do in a line"
          />
          <TextField
            disabled={!policy?.eligible}
            label="About you"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                disabled={!policy?.eligible}
                checked={!!policy?.eligible && tipsEnabled}
                onChange={(_, v) => setTipsEnabled(v)}
              />
            }
            label="Accept tips"
            sx={{ mb: 1 }}
          />
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            onClick={saveProfile}
            disabled={saving || !policy?.eligible}
            variant="contained"
            sx={{ borderRadius: '999px', fontWeight: 800, textTransform: 'none', px: 4 }}
          >
            {saving ? (
              <>
                <LoadingDots size={6} /> <span>Saving…</span>
              </>
            ) : profile ? (
              'Save changes'
            ) : (
              'Create my page'
            )}
          </Button>
        </Box>

        {/* Withdrawal history */}
        {payouts.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography sx={{ fontWeight: 800, color: INK, mb: 1.5 }}>Withdrawals</Typography>
            {payouts.map((p) => (
              <Box
                key={p.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  mb: 1,
                  borderRadius: SHAPE.sm,
                  bgcolor: 'background.paper',
                  boxShadow: 'var(--neu-subtle)',
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700, color: INK }}>{fmt(p.amount)}</Typography>
                  <Typography variant="caption">
                    Fee {fmt(p.fee ?? 0)} · Net transfer {fmt(p.netAmount ?? p.amount)}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={p.status}
                  color={
                    p.status === 'PAID' ? 'success' : p.status === 'FAILED' ? 'error' : 'default'
                  }
                />
              </Box>
            ))}
          </Box>
        )}
      </Container>

      {/* Withdraw dialog */}
      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Withdraw funds</DialogTitle>
        <DialogContent>
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
          {destination === 'ujimora_wallet' && (
            <Alert severity="info">
              The net amount is added to your GHS wallet for use on Ujimora. Your plan's withdrawal
              fee still applies.
            </Alert>
          )}
          {destination !== 'ujimora_wallet' && (
            <>
              <TextField
                select
                fullWidth
                label="Saved payout account"
                value={savedAccountId}
                onChange={(e) => setSavedAccountId(e.target.value)}
                sx={{ my: 2 }}
              >
                <MenuItem value="">Enter a new account</MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.accountName} · {payoutInstitutionName(a.bankCode, a.bankCode)} · {a.last4}
                  </MenuItem>
                ))}
              </TextField>
              <Typography
                component="a"
                href="/payout-accounts"
                variant="caption"
                sx={{ display: 'block', textAlign: 'right', mb: 2, color: 'text.secondary' }}
              >
                Manage saved accounts ↗
              </Typography>
            </>
          )}

          <TextField
            label="Amount"
            type="number"
            value={wAmount}
            onChange={(e) => setWAmount(Number(e.target.value))}
            fullWidth
            sx={{ mt: 1, mb: 2 }}
          />
          {destination !== 'ujimora_wallet' && !savedAccountId && (
            <>
              <TextField
                select
                label="Destination"
                value={wType}
                onChange={(e) => {
                  setWType(e.target.value as 'mobile_money' | 'ghipss')
                  setWBank('')
                }}
                fullWidth
                sx={{ mb: 2 }}
              >
                <MenuItem value="mobile_money">Mobile money</MenuItem>
                <MenuItem value="ghipss">Bank account</MenuItem>
              </TextField>
              <TextField
                label={wType === 'mobile_money' ? 'Phone number' : 'Account number'}
                value={wAccount}
                onChange={(e) => setWAccount(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              />
              <Box sx={{ mb: 2 }}>
                <BankPicker banks={withdrawBanks} value={wBank} onChange={setWBank} required />
              </Box>
              <TextField
                label="Account name"
                value={wName}
                onChange={(e) => setWName(e.target.value)}
                fullWidth
                placeholder={displayName}
              />
            </>
          )}
          {policy && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {policy.planName} transfer fee: {policy.feePercent}%. Fee: GH₵
              {(Math.round(wAmount * policy.feePercent) / 100).toFixed(2)} · You receive: GH₵
              {(
                Math.round((wAmount - Math.round(wAmount * policy.feePercent) / 100) * 100) / 100
              ).toFixed(2)}
              . The full requested amount is deducted from your creator balance.
            </Alert>
          )}
          {wError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {wError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setWithdrawOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={withdraw}
            disabled={wSubmitting || !policy || !Number.isFinite(wAmount) || wAmount <= 0}
            variant="contained"
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {wSubmitting ? (
              <>
                <LoadingDots size={6} /> <span>Starting…</span>
              </>
            ) : (
              'Withdraw'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack('')}
        message={snack}
      />
    </Box>
  )
}
