import { ProfileArtwork } from '@/components/profile/ProfileArtwork'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import { AccountPageSkeleton } from '@/components/account/AccountPage'
import { useState, useEffect, useCallback, useRef } from 'react'
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
import { SHAPE, LoadingDots, breadcrumbList } from '@ubuntu-fund/ui'
import { api, ApiError } from '@/lib/api'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'

const FOREST = '#2E3D2F'
const INK = 'text.primary'
const INK_SECONDARY = 'text.secondary'

interface CreatorPage {
  handle: string
  displayName: string
  tagline?: string
  bio?: string
  coverUrl?: string
  avatarUrl?: string
  tipsEnabled: boolean
  presetAmounts: number[]
  currency: string
  supporterCount: number
  totalReceived: number
  recentTips: Array<{ supporterName: string; amount: number; message?: string }>
}

/** Collapse whitespace and trim to `max` characters at a word boundary. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:\u2014-]+$/, '')}\u2026`
}

/** Meta description built from the creator's own tagline or bio, topped up when it is very short. */
function creatorDescription(creator: CreatorPage): string {
  const blurb = clip(creator.tagline || creator.bio || '', 155)
  if (blurb.length >= 95) return blurb
  const firstName = clip(creator.displayName.split(' ')[0] || creator.displayName, 18)
  return `${blurb ? `${blurb} ` : ''}Send ${firstName} a tip on Ujimora \u2014 no account needed.`
}

export function CreatorTipPage() {
  const { handle = '' } = useParams()
  const [page, setPage] = useState<CreatorPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const amountInput = useRef<HTMLInputElement>(null)
  const [custom, setCustom] = useState(false)
  const [failedCover, setFailedCover] = useState('')
  const [amount, setAmount] = useState(25)
  const [anonymous, setAnonymous] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    setLoadError(false)
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

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const creatorImage = page?.coverUrl || page?.avatarUrl
  useSeo({
    title: page ? `Support ${clip(page.displayName, 34)} | Ujimora` : 'Support a creator | Ujimora',
    description: page
      ? creatorDescription(page)
      : 'Back a creator on Ujimora: pick an amount in cedis, add a message of support, and pay by mobile money or card. No account needed to send a tip.',
    path: `/creators/${encodeURIComponent(page?.handle || handle)}`,
    image: creatorImage && /^https?:\/\//i.test(creatorImage) ? creatorImage : undefined,
    jsonLd: page
      ? breadcrumbList(SITE_ORIGIN, [{ name: 'Home', path: '/' }, { name: page.displayName }])
      : undefined,
  })

  async function handleSupport() {
    setError(null)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Choose an amount.')
      return
    }
    if (!email) {
      setError('Enter your email so we can send a receipt.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post<{ checkoutUrl: string }>(`/creators/${handle}/tips`, {
        amount,
        supporterEmail: email.trim(),
        supporterName: name.trim() || undefined,
        message: message.trim() || undefined,
        isAnonymous: anonymous,
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
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          Page not found
        </Typography>
        <Typography sx={{ color: INK_SECONDARY }}>
          We couldn’t find a creator at @{handle}.
        </Typography>
      </Container>
    )
  }
  if (loadError || !page) {
    return (
      <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          Something went wrong
        </Typography>
        <Typography sx={{ color: INK_SECONDARY, mb: 3 }}>
          We couldn’t load @{handle} just now. Please try again.
        </Typography>
        <Button
          variant="contained"
          onClick={() => setReloadKey((k) => k + 1)}
          sx={{ borderRadius: '999px', fontWeight: 800, textTransform: 'none', px: 4 }}
        >
          Try again
        </Button>
      </Container>
    )
  }

  const initials = page.displayName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const fmt = (n: number) => `${page.currency === 'GHS' ? 'GH₵' : ''}${n.toLocaleString()}`

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 7 } }}>
      <Container
        maxWidth="lg"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 420px' },
          gap: { xs: 3, md: 4 },
          alignItems: 'start',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            gridColumn: { xs: '1 / -1', md: '1' },
            overflow: 'hidden',
            borderRadius: SHAPE.card,
            bgcolor: 'var(--neu-surface)',
            border: 'var(--neu-border)',
            boxShadow: 'var(--neu-raised)',
            pb: 4,
          }}
        >
          <Box sx={{ position: 'relative', height: { xs: 180, md: 280 }, overflow: 'hidden' }}>
            <ProfileArtwork variant="cover" />
            {page.coverUrl && failedCover !== page.coverUrl && (
              <Box
                component="img"
                src={page.coverUrl}
                alt={`${page.displayName}'s cover`}
                onError={() => setFailedCover(page.coverUrl!)}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
          </Box>
          <Box sx={{ px: { xs: 3, md: 5 }, position: 'relative' }}>
            <Avatar
              src={page.avatarUrl}
              sx={{
                width: { xs: 88, md: 112 },
                height: { xs: 88, md: 112 },
                mt: -6,
                mb: 2,
                border: '5px solid',
                borderColor: 'background.paper',
                bgcolor: FOREST,
                color: '#F5F2EA',
                fontSize: '2rem',
                fontWeight: 800,
              }}
            >
              {initials}
            </Avatar>
            {/* The creator's name is this page's subject, so it is the h1.
                It rendered as a <p>, leaving the page with no heading at all.
                Semantics only — the sx below is unchanged, so it looks the same. */}
            <Typography
              component="h1"
              sx={{ fontWeight: 900, fontSize: { xs: '1.8rem', md: '2.5rem' }, color: INK }}
            >
              {page.displayName}
            </Typography>
            {page.tagline && (
              <Typography sx={{ color: INK_SECONDARY, mt: 0.5 }}>{page.tagline}</Typography>
            )}
            <Box sx={{ display: 'flex', gap: 3, justifyContent: 'flex-start', mt: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 800, color: INK }}>{page.supporterCount}</Typography>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: INK_SECONDARY,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Supporters
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, color: INK }}>
                  {fmt(page.totalReceived)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: INK_SECONDARY,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Received
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Tip form */}
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSupport()
          }}
          sx={{
            gridColumn: { md: '2' },
            gridRow: { md: '1 / span 3' },
            position: { md: 'sticky' },
            top: { md: 96 },
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: SHAPE.card,
            bgcolor: 'var(--neu-surface)',
            border: 'var(--neu-border)',
            backdropFilter: 'var(--neu-backdrop)',
            boxShadow: 'var(--neu-raised)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <VolunteerActivismRoundedIcon sx={{ color: 'text.primary' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: INK }}>
              Support {page.displayName.split(' ')[0]}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A little support goes a long way. Choose any amount—no account needed.
          </Typography>
          {!page.tipsEnabled ? (
            <Alert severity="info">This creator isn’t accepting tips right now.</Alert>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {page.presetAmounts.map((a) => (
                  <Button
                    key={a}
                    onClick={() => {
                      setCustom(false)
                      setAmount(a)
                    }}
                    variant={!custom && amount === a ? 'contained' : 'outlined'}
                    sx={{
                      borderRadius: '999px',
                      fontWeight: 700,
                      minWidth: 72,
                      textTransform: 'none',
                    }}
                  >
                    {fmt(a)}
                  </Button>
                ))}
                <Button
                  variant={custom ? 'contained' : 'outlined'}
                  onClick={() => {
                    setCustom(true)
                    amountInput.current?.focus()
                    amountInput.current?.select()
                  }}
                  sx={{ borderRadius: '999px' }}
                >
                  Custom
                </Button>
              </Box>
              <TextField
                label="Your amount (GHS)"
                inputRef={amountInput}
                type="number"
                value={amount}
                onChange={(e) => {
                  setCustom(true)
                  setAmount(Number(e.target.value))
                }}
                fullWidth
                sx={{ mb: 2 }}
                inputProps={{ min: 1, step: 0.01 }}
              />
              <TextField
                label="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Email (for your receipt)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                sx={{ mb: 2 }}
              />
              <TextField
                label="Say something nice (optional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Checkbox checked={anonymous} onChange={(_, value) => setAnonymous(value)} />
                }
                label="Show my support anonymously"
              />
              <Typography variant="body2" sx={{ color: INK_SECONDARY, mb: 2 }}>
                Your name and message may appear in recent supporters. Anonymous support hides your
                name. Your email is private. Available payment methods are shown by Paystack.
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Button
                type="submit"
                disabled={submitting}
                variant="contained"
                fullWidth
                startIcon={submitting ? <LoadingDots size={6} /> : <FavoriteRoundedIcon />}
                sx={{
                  borderRadius: '999px',
                  py: 1.3,
                  fontWeight: 800,
                  textTransform: 'none',
                  fontSize: '1rem',
                }}
              >
                {submitting ? 'Starting checkout…' : `Support ${fmt(amount)}`}
              </Button>
            </>
          )}
        </Box>

        {page.bio && (
          <Box
            sx={{
              p: 3,
              mb: 3,
              borderRadius: SHAPE.card,
              bgcolor: 'background.paper',
              boxShadow: 'var(--neu-raised)',
            }}
          >
            <Typography sx={{ fontWeight: 800, color: INK, mb: 1 }}>
              About {page.displayName.split(' ')[0]}
            </Typography>
            <Typography sx={{ color: INK_SECONDARY, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {page.bio}
            </Typography>
          </Box>
        )}

        {/* Recent supporters */}
        {page.recentTips.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontWeight: 800, color: INK, mb: 1.5 }}>Recent supporters</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {page.recentTips.map((t, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 2,
                    borderRadius: SHAPE.sm,
                    bgcolor: 'background.paper',
                    boxShadow: 'var(--neu-subtle)',
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: INK, fontSize: '0.9rem' }}>
                    {t.supporterName} · {fmt(t.amount)}
                  </Typography>
                  {t.message && (
                    <Typography sx={{ color: INK_SECONDARY, fontSize: '0.85rem', mt: 0.5 }}>
                      “{t.message}”
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  )
}
