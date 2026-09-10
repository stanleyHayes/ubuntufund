import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import { AccountPageSkeleton } from '@/components/account/AccountPage'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import Alert from '@mui/material/Alert'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import { SHAPE, LoadingDots } from '@ubuntu-fund/ui'
import { api, ApiError } from '@/lib/api'

const FOREST = '#2E3D2F'
const INK = 'text.primary'
const INK_SECONDARY = 'text.secondary'

interface CreatorPage {
  handle: string
  displayName: string
  tagline?: string
  bio?: string
  avatarUrl?: string
  tipsEnabled: boolean
  presetAmounts: number[]
  currency: string
  supporterCount: number
  totalReceived: number
  recentTips: Array<{ supporterName: string; amount: number; message?: string }>
}

export function CreatorTipPage() {
  const { handle = '' } = useParams()
  const [page, setPage] = useState<CreatorPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [amount, setAmount] = useState(25)
  const [anonymous, setAnonymous] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setNotFound(false); setLoadError(false)
    try {
      const data = await api.get<CreatorPage>(`/creators/${handle}`)
      setPage(data)
      if (data.presetAmounts?.[0]) setAmount(data.presetAmounts[0])
    } catch (err) {
      // Only a real 404 means "no such creator"; anything else (5xx, network) is
      // a transient error the visitor can retry — don't imply the page is gone.
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [handle])

  useEffect(() => { void load() }, [load, reloadKey])

  async function handleSupport() {
    setError(null)
    if (!Number.isFinite(amount) || amount <= 0) { setError('Choose an amount.'); return }
    if (!email) { setError('Enter your email so we can send a receipt.'); return }
    setSubmitting(true)
    try {
      const res = await api.post<{ checkoutUrl: string }>(`/creators/${handle}/tips`, {
        amount, supporterEmail: email.trim(), supporterName: name.trim() || undefined, message: message.trim() || undefined, isAnonymous: anonymous,
      })
      window.location.href = res.checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <AccountPageSkeleton layout="cards" />
  }
  if (notFound) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Page not found</Typography>
        <Typography sx={{ color: INK_SECONDARY }}>We couldn’t find a creator at @{handle}.</Typography>
      </Container>
    )
  }
  if (loadError || !page) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Something went wrong</Typography>
        <Typography sx={{ color: INK_SECONDARY, mb: 3 }}>We couldn’t load @{handle} just now. Please try again.</Typography>
        <Button variant="contained" onClick={() => setReloadKey((k) => k + 1)} sx={{ borderRadius: '999px', fontWeight: 800, textTransform: 'none', px: 4 }}>
          Try again
        </Button>
      </Container>
    )
  }

  const initials = page.displayName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const fmt = (n: number) => `${page.currency === 'GHS' ? 'GH₵' : ''}${n.toLocaleString()}`

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 7 } }}>
      <Container maxWidth="sm">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Avatar src={page.avatarUrl} sx={{ width: 88, height: 88, mx: 'auto', mb: 2, bgcolor: FOREST, color: '#F5F2EA', fontSize: '2rem', fontWeight: 800 }}>
            {initials}
          </Avatar>
          <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color: INK }}>{page.displayName}</Typography>
          {page.tagline && <Typography sx={{ color: INK_SECONDARY, mt: 0.5 }}>{page.tagline}</Typography>}
          <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', mt: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, color: INK }}>{page.supporterCount}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: INK_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5 }}>Supporters</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, color: INK }}>{fmt(page.totalReceived)}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: INK_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5 }}>Received</Typography>
            </Box>
          </Box>
        </Box>

        <Typography sx={{ textAlign: 'center', color: INK_SECONDARY, mb: 2 }}>Choose an amount → Pay securely with Paystack → Receive confirmation. No Ujimora account needed.</Typography>
        {/* Tip form */}
        <Box component="form" onSubmit={e => { e.preventDefault(); void handleSupport() }} sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <VolunteerActivismRoundedIcon sx={{ color: 'text.primary' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: INK }}>Support {page.displayName.split(' ')[0]}</Typography>
          </Box>
          {!page.tipsEnabled ? (
            <Alert severity="info">This creator isn’t accepting tips right now.</Alert>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {page.presetAmounts.map((a) => (
                  <Button
                    key={a}
                    onClick={() => setAmount(a)}
                    variant={amount === a ? 'contained' : 'outlined'}
                    sx={{ borderRadius: '999px', fontWeight: 700, minWidth: 72, textTransform: 'none' }}
                  >
                    {fmt(a)}
                  </Button>
                ))}
              </Box>
              <TextField
                label="Amount" type="number" value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                fullWidth sx={{ mb: 2 }} inputProps={{ min: 1, step: 0.01 }}
              />
              <TextField label="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mb: 2 }} />
              <TextField label="Email (for your receipt)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required sx={{ mb: 2 }} />
              <TextField label="Say something nice (optional)" value={message} onChange={(e) => setMessage(e.target.value)} fullWidth multiline minRows={2} sx={{ mb: 2 }} />
              <FormControlLabel control={<Checkbox checked={anonymous} onChange={(_, value) => setAnonymous(value)} />} label="Show my support anonymously" />
              <Typography variant="body2" sx={{ color: INK_SECONDARY, mb: 2 }}>Your name and message may appear in recent supporters. Anonymous support hides your name. Your email is private. Available payment methods are shown by Paystack.</Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Button
                type="submit"
                disabled={submitting}
                variant="contained"
                fullWidth
                startIcon={submitting ? <LoadingDots size={6} /> : <FavoriteRoundedIcon />}
                sx={{ borderRadius: '999px', py: 1.3, fontWeight: 800, textTransform: 'none', fontSize: '1rem' }}
              >
                {submitting ? 'Starting checkout…' : `Support ${fmt(amount)}`}
              </Button>
            </>
          )}
        </Box>

        {page.bio && (
          <Box sx={{ p: 3, mb: 3, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)' }}>
            <Typography sx={{ fontWeight: 800, color: INK, mb: 1 }}>About {page.displayName.split(' ')[0]}</Typography>
            <Typography sx={{ color: INK_SECONDARY, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{page.bio}</Typography>
          </Box>
        )}

        {/* Recent supporters */}
        {page.recentTips.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontWeight: 800, color: INK, mb: 1.5 }}>Recent supporters</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {page.recentTips.map((t, i) => (
                <Box key={i} sx={{ p: 2, borderRadius: SHAPE.sm, bgcolor: 'background.paper', boxShadow: 'var(--neu-subtle)' }}>
                  <Typography sx={{ fontWeight: 700, color: INK, fontSize: '0.9rem' }}>
                    {t.supporterName} · {fmt(t.amount)}
                  </Typography>
                  {t.message && <Typography sx={{ color: INK_SECONDARY, fontSize: '0.85rem', mt: 0.5 }}>“{t.message}”</Typography>}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  )
}
