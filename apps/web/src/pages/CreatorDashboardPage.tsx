import { useState, useEffect, useCallback } from 'react'
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

const FOREST = '#2E3D2F'
const INK = 'text.primary'
const INK_SECONDARY = 'text.secondary'

interface Balance { availableBalance: number; paidOutBalance: number; totalReceived: number; currency: string }
interface Profile { handle: string; displayName: string; tagline?: string; bio?: string; tipsEnabled: boolean; presetAmounts: number[]; thankYouMessage?: string; currency: string }
interface Payout { id: string; amount: number; status: string; createdAt: string }

export function CreatorDashboardPage() {
  const [loading, setLoading] = useState(true)
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

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [wAmount, setWAmount] = useState(0)
  const [wType, setWType] = useState<'mobile_money' | 'ghipss'>('mobile_money')
  const [wAccount, setWAccount] = useState('')
  const [wBank, setWBank] = useState('')
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
      const me = await api.get<{ profile: Profile | null; balance: Balance | null }>('/creators/me')
      setProfile(me.profile)
      setBalance(me.balance)
      if (me.profile) {
        setHandle(me.profile.handle); setDisplayName(me.profile.displayName)
        setTagline(me.profile.tagline ?? ''); setBio(me.profile.bio ?? ''); setTipsEnabled(me.profile.tipsEnabled)
        const p = await api.get<Payout[]>('/creators/me/payouts')
        setPayouts(p)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'We couldn’t load your creator page. Please try again.')
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveProfile() {
    setError(null); setSaving(true)
    try {
      await api.post('/creators/profile', { handle, displayName, tagline, bio, tipsEnabled })
      setSnack('Your creator page is saved')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your page.')
    } finally { setSaving(false) }
  }

  async function withdraw() {
    setWError(null); setWSubmitting(true)
    try {
      await api.post('/creators/withdraw', {
        amount: wAmount,
        recipient: { type: wType, accountNumber: wAccount, bankCode: wBank, accountName: wName || displayName },
      })
      setWithdrawOpen(false); setSnack('Withdrawal started')
      await load()
    } catch (err) {
      setWError(err instanceof Error ? err.message : 'Could not start the withdrawal.')
    } finally { setWSubmitting(false) }
  }

  const fmt = (n: number) => `GH₵${(n ?? 0).toLocaleString()}`
  const pageUrl = profile ? `${window.location.origin}/creators/${profile.handle}` : ''

  if (loading) return <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}><LoadingDots /></Box>

  if (loadError) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 6 } }}>
        <Container maxWidth="sm">
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => void load()}>Try again</Button>}
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
        <AccountHeading title="Your creator page" description="Get a shareable tip link and receive support — no campaign needed." icon={<StorefrontRoundedIcon />} />

        {profile && balance && (
          <Box sx={{ p: 3, mb: 3, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', color: INK_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5 }}>Available to withdraw</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: FOREST }}>{fmt(balance.availableBalance)}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: INK_SECONDARY }}>Received {fmt(balance.totalReceived)} · Withdrawn {fmt(balance.paidOutBalance)}</Typography>
              </Box>
              <Button variant="contained" disabled={balance.availableBalance <= 0} onClick={() => { setWAmount(balance.availableBalance); setWithdrawOpen(true) }} sx={{ borderRadius: '999px', fontWeight: 800, textTransform: 'none', px: 3 }}>
                Withdraw
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: SHAPE.sm, bgcolor: 'rgba(46,61,47,0.06)' }}>
              <Typography noWrap sx={{ fontSize: '0.85rem', color: INK, flex: 1 }}>{pageUrl}</Typography>
              <Button size="small" startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => { navigator.clipboard?.writeText(pageUrl); setSnack('Link copied') }} sx={{ textTransform: 'none' }}>Copy</Button>
            </Box>
          </Box>
        )}

        {/* Setup / edit */}
        <Box sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: INK, mb: 2 }}>{profile ? 'Edit your page' : 'Claim your page'}</Typography>
          <TextField label="Handle (your link)" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} fullWidth sx={{ mb: 2 }} helperText="letters, numbers, - or _ · your link becomes /creators/your-handle" disabled={!!profile} />
          <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth sx={{ mb: 2 }} />
          <TextField label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} fullWidth sx={{ mb: 2 }} placeholder="What you do in a line" />
          <TextField label="About you" value={bio} onChange={(e) => setBio(e.target.value)} fullWidth multiline minRows={3} sx={{ mb: 2 }} />
          <FormControlLabel control={<Switch checked={tipsEnabled} onChange={(_, v) => setTipsEnabled(v)} />} label="Accept tips" sx={{ mb: 1 }} />
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Button onClick={saveProfile} disabled={saving} variant="contained" sx={{ borderRadius: '999px', fontWeight: 800, textTransform: 'none', px: 4 }}>
            {saving ? 'Saving…' : profile ? 'Save changes' : 'Create my page'}
          </Button>
        </Box>

        {/* Withdrawal history */}
        {payouts.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography sx={{ fontWeight: 800, color: INK, mb: 1.5 }}>Withdrawals</Typography>
            {payouts.map((p) => (
              <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, mb: 1, borderRadius: SHAPE.sm, bgcolor: 'background.paper', boxShadow: 'var(--neu-subtle)' }}>
                <Typography sx={{ fontWeight: 700, color: INK }}>{fmt(p.amount)}</Typography>
                <Chip size="small" label={p.status} color={p.status === 'PAID' ? 'success' : p.status === 'FAILED' ? 'error' : 'default'} />
              </Box>
            ))}
          </Box>
        )}
      </Container>

      {/* Withdraw dialog */}
      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Withdraw funds</DialogTitle>
        <DialogContent>
          <TextField label="Amount" type="number" value={wAmount} onChange={(e) => setWAmount(Number(e.target.value))} fullWidth sx={{ mt: 1, mb: 2 }} />
          <TextField select label="Destination" value={wType} onChange={(e) => setWType(e.target.value as 'mobile_money' | 'ghipss')} fullWidth sx={{ mb: 2 }}>
            <MenuItem value="mobile_money">Mobile money</MenuItem>
            <MenuItem value="ghipss">Bank account</MenuItem>
          </TextField>
          <TextField label={wType === 'mobile_money' ? 'Phone number' : 'Account number'} value={wAccount} onChange={(e) => setWAccount(e.target.value)} fullWidth sx={{ mb: 2 }} />
          <TextField label={wType === 'mobile_money' ? 'Network code (e.g. MTN)' : 'Bank code'} value={wBank} onChange={(e) => setWBank(e.target.value)} fullWidth sx={{ mb: 2 }} />
          <TextField label="Account name" value={wName} onChange={(e) => setWName(e.target.value)} fullWidth placeholder={displayName} />
          {wError && <Alert severity="error" sx={{ mt: 2 }}>{wError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setWithdrawOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={withdraw} disabled={wSubmitting} variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>{wSubmitting ? 'Starting…' : 'Withdraw'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={2200} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
