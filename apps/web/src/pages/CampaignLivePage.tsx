// ---------------------------------------------------------------------------
// CampaignLivePage — owner-only LIVE control room for a campaign.
// Route: /campaigns/:id/live  (wrapped in RequireAuth by the routing step).
//
// Start / end a live fundraising session, watch real-time totals over SSE
// (useLiveTotals), hand out the OBS overlay URL (OverlayLinkCard), mint dynamic
// QR codes (QrCodeManager), and toggle donor-privacy while streaming. Reuses
// the existing LiveDonationFeed for the donor stream.
//
// Active controls are recovered from the owner-only server endpoint.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import InputAdornment from '@mui/material/InputAdornment'
import Switch from '@mui/material/Switch'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import { keyframes } from '@emotion/react'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import {
  Button,
  ProgressBar,
  CurrencyDisplay,
  ErrorState,
  ItemNotFound,
  SHAPE,
  LoadingDots,
} from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import {
  startLiveSession,
  endLiveSession,
  updateLiveSessionPrivacy,
  type LiveSession,
} from '@/lib/fundraising'
import type { Campaign } from '@ubuntu-fund/types'
import { useLiveTotals } from '@/hooks/useLiveTotals'
import { LiveDonationFeed } from '@/components/LiveDonationFeed'
import { OverlayLinkCard } from '@/components/live/OverlayLinkCard'
import { LiveVideoPanel } from '@/components/live/LiveVideoPanel'
import { LiveBroadcastPreview } from '@/components/live/LiveBroadcastPreview'
import { QrCodeManager } from '@/components/live/QrCodeManager'

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const PANEL_SX = {
  p: { xs: 2.25, md: 3 },
  border: 'var(--neu-border)',
  boxShadow: 'var(--neu-raised)',
  backdropFilter: 'var(--neu-backdrop)',
  borderRadius: SHAPE.card,
  bgcolor: 'var(--neu-surface)',
} as const

function storageKeyFor(id: string) {
  return `uf_live_session:${id}`
}

function persistSession(id: string | undefined, _session: LiveSession | null) {
  if (!id) return
  try { sessionStorage.removeItem(storageKeyFor(id)) } catch { /* Storage may be unavailable. */ }
}

export function CampaignLivePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [session, setSession] = useState<LiveSession | null>(null)

  // Start-panel form state.
  const [title, setTitle] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [startShowNames, setStartShowNames] = useState(true)
  const [startShowMessages, setStartShowMessages] = useState(true)
  const [startShowAmounts, setStartShowAmounts] = useState(true)
  const [startPrivacyMode, setStartPrivacyMode] = useState(false)

  const [videoEnabled, setVideoEnabled] = useState<boolean | null>(null)
  useEffect(() => { api.get<{ enabled: boolean }>('/live-sessions/video/config').then(value => setVideoEnabled(value.enabled)).catch(() => setVideoEnabled(false)) }, [])
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isOwner = !!currentUser && !!campaign && currentUser.id === campaign.creatorId

  // --- Load the campaign -------------------------------------------------
  const loadCampaign = useCallback(() => {
    if (!id) return
    setIsLoading(true)
    setLoadError(null)
    api
      .get<Campaign>(`/campaigns/${id}`)
      .then(setCampaign)
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => {
    loadCampaign()
  }, [loadCampaign])

  // The server owns session lifecycle; browser storage can be stale after end/rotation.
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  useEffect(() => {
    if (!id || !isOwner) return
    let cancelled = false
    setSessionLoading(true)
    const recover = () => api.get<LiveSession | null>(`/campaigns/${id}/live-sessions/active`).then(active => {
      if (!cancelled) { setSession(active); persistSession(id, null); setSessionError(null) }
    }).catch((error: Error) => { if (!cancelled) setSessionError(error.message) })
      .finally(() => { if (!cancelled) setSessionLoading(false) })
    void recover()
    const timer = setInterval(recover, 10000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [id, isOwner])

  // --- Live totals (only while a session is active) ----------------------
  const live = useLiveTotals(id, {
    initialRaisedAmount: campaign?.raisedAmount ?? 0,
    initialGoalAmount: campaign?.goalAmount ?? 0,
    enabled: !!session && session.status === 'active',
  })

  const currency = campaign?.currency ?? 'GHS'

  // --- Actions -----------------------------------------------------------
  const handleStart = useCallback(async () => {
    if (!id) return
    setActionError(null)
    setStarting(true)
    try {
      const amount = Number(targetAmount)
      const created = await startLiveSession(id, {
        title: title.trim() || campaign?.title,
        targetAmount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
        showDonorNames: startShowNames,
        showDonorMessages: startShowMessages,
        showAmounts: startShowAmounts,
        privacyMode: startPrivacyMode,
      })
      setSession(created)
      persistSession(id, created)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start the live session.')
    } finally {
      setStarting(false)
    }
  }, [id, campaign?.title, title, targetAmount, startShowNames, startShowMessages, startShowAmounts, startPrivacyMode])

  const handleEnd = useCallback(async () => {
    if (!session) return
    setActionError(null)
    setEnding(true)
    try {
      await endLiveSession(session.id)
      setSession(null)
      persistSession(id, null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not end the live session.')
    } finally {
      setEnding(false)
    }
  }, [session, id])

  const handlePrivacyChange = useCallback(
    async (field: 'showDonorNames' | 'showDonorMessages' | 'showAmounts' | 'privacyMode', value: boolean) => {
      if (!session) return
      const previous = session
      const optimistic: LiveSession = { ...session, [field]: value }
      setSession(optimistic)
      persistSession(id, optimistic)
      setActionError(null)
      try {
        const updated = await updateLiveSessionPrivacy(session.id, {
          showDonorNames: optimistic.showDonorNames,
          showDonorMessages: optimistic.showDonorMessages,
          showAmounts: optimistic.showAmounts,
          privacyMode: optimistic.privacyMode,
        })
        setSession(updated)
        persistSession(id, updated)
      } catch (err) {
        setSession(previous)
        persistSession(id, previous)
        setActionError(err instanceof Error ? err.message : 'Could not update privacy settings.')
      }
    },
    [session, id],
  )

  const handleRotated = useCallback(
    (updated: LiveSession) => {
      setSession(updated)
      persistSession(id, updated)
    },
    [id],
  )

  // --- Render states -----------------------------------------------------
  if (isLoading) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 5 }}>
        <Container maxWidth="lg">
          <Skeleton width="40%" height={40} sx={{ mb: 1 }} />
          <Skeleton width="55%" height={22} sx={{ mb: 4 }} />
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: SHAPE.card, mb: 3 }} />
          <Skeleton variant="rounded" height={180} sx={{ borderRadius: SHAPE.card }} />
        </Container>
      </Box>
    )
  }

  if (loadError) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 8 }}>
        <Container maxWidth="sm">
          <ErrorState message={loadError} onRetry={loadCampaign} />
        </Container>
      </Box>
    )
  }

  if (!campaign) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 8 }}>
        <Container maxWidth="sm">
          <ItemNotFound
            itemType="Campaign"
            message="We couldn't find that campaign."
            onBack={() => navigate('/my-campaigns')}
            backLabel="My campaigns"
          />
        </Container>
      </Box>
    )
  }

  if (!isOwner) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 8 }}>
        <Container maxWidth="sm">
          <ItemNotFound
            itemType="LIVE dashboard"
            message="The LIVE control room is only available to the campaign owner."
            onBack={() => navigate(`/campaigns/${campaign.id}`)}
            backLabel="View campaign"
          />
        </Container>
      </Box>
    )
  }

  const sessionActive = !!session && session.status === 'active'

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 5, '@media (prefers-reduced-motion: reduce)': { '& *': { animation: 'none !important' } } }}>
      <Container maxWidth="xl">
        {/* ===== Header ===== */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ mb: 1, animation: `${fadeInUp} 0.4s ease`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}
        >
          <Typography
            component="h1"
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 900,
              fontSize: { xs: '2rem', md: '2.75rem' },
              lineHeight: 1.15,
            }}
          >
            Go live
          </Typography>
          {sessionActive && (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{
                px: 1.25,
                py: 0.4,
                borderRadius: SHAPE.sm,
                bgcolor: 'rgba(165,67,47,0.1)',
                color: 'var(--text-error)',
              }}
            >
              <FiberManualRecordRoundedIcon sx={{ fontSize: 12 }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                LIVE
              </Typography>
            </Stack>
          )}
        </Stack>
        <Typography
          sx={{
            color: 'text.secondary',
            mb: 4,
            animation: `${fadeInUp} 0.4s 0.05s ease both`,
          }}
        >
          {campaign.title}
        </Typography>

        {videoEnabled === false && <Alert severity="info" sx={{ mb: 3 }}>In-app broadcasting is awaiting video-service setup. You can prepare your session here; broadcasting will be available once it is connected.</Alert>}
        {sessionError && <Alert severity="error" sx={{ mb: 3 }}>Could not recover your live session: {sessionError}. Refresh to retry.</Alert>}
        {actionError && (
          <Alert severity="error" sx={{ borderRadius: SHAPE.card, mb: 3 }} onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.65fr) minmax(340px, 1fr)' }, gap: { xs: 3, md: 4 }, alignItems: 'start' }}>
        <Box sx={{ ...PANEL_SX, minWidth: 0, gridColumn: sessionActive ? '1 / -1' : undefined }}>
          {sessionActive && session && <Box sx={{ mb: 3 }}><LiveVideoPanel sessionId={session.id} host /><Typography sx={{ mt: 2, mb: 1, fontWeight: 700 }}>Share your broadcast</Typography><TextField label="Viewer link" fullWidth value={`${window.location.origin}/live/${session.id}`} InputProps={{ readOnly: true }} onFocus={e => e.target.select()} /></Box>}
          <LiveBroadcastPreview session={sessionActive ? session : null} title={title.trim() || campaign.title} raised={campaign.raisedAmount} goal={campaign.goalAmount} />
        </Box>
        {!sessionActive ? (
          /* ================= Start panel ================= */
          <Box sx={{ ...PANEL_SX, minWidth: 0 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.5 }}>
              <PlayArrowRoundedIcon sx={{ color: 'primary.main' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>Session setup</Typography>
            </Stack>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.88rem', mb: 3 }}>
              Name your event, set a target, and choose what your audience sees. Start when you’re ready.
            </Typography>

            <TextField
              label="Session title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday night charity stream"
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            <TextField
              label="Session goal (optional)"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="e.g. 2000"
              fullWidth
              size="small"
              inputMode="decimal"
              InputProps={{ startAdornment: <InputAdornment position="start">GHS</InputAdornment> }}
              helperText="A stretch goal for this session, distinct from the campaign goal."
              sx={{ mb: 2 }}
            />

            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>Donor privacy</Typography>
            <FormGroup>
              <FormControlLabel
                control={<Switch checked={startShowNames} onChange={(e) => setStartShowNames(e.target.checked)} />}
                label="Show donor names"
                disabled={startPrivacyMode}
              />
              <FormControlLabel
                control={<Switch checked={startShowMessages} onChange={(e) => setStartShowMessages(e.target.checked)} />}
                label="Show donor messages"
                disabled={startPrivacyMode}
              />
              <FormControlLabel
                control={<Switch checked={startShowAmounts} onChange={(e) => setStartShowAmounts(e.target.checked)} />}
                label="Show donation amounts"
              />
              <FormControlLabel
                control={<Switch checked={startPrivacyMode} onChange={(e) => setStartPrivacyMode(e.target.checked)} />}
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <ShieldRoundedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                    <span>Privacy mode (force-hide names &amp; messages)</span>
                  </Stack>
                }
              />
            </FormGroup>

            <Button
              brandVariant="primary"
              onClick={handleStart}
              disabled={starting || sessionLoading || !!sessionError || !videoEnabled}
              startIcon={sessionLoading || starting ? <LoadingDots size={6} /> : <PlayArrowRoundedIcon />}
              sx={{ mt: 2.5, width: '100%', py: 1.5, textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm, px: 3 }}
            >
              {sessionLoading ? 'Checking session…' : starting ? 'Starting…' : 'Go LIVE'}
            </Button>
          </Box>
        ) : (
          /* ================= Active session ================= */
          <Box
            sx={{
              display: 'grid',
              gridColumn: '1 / -1',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.2fr) minmax(0, 1fr)' },
              gap: 3,
              animation: `${fadeInUp} 0.4s 0.1s ease both`,
            }}
          >
            {/* Live totals */}
            <Box sx={{ ...PANEL_SX, gridColumn: { xs: '1', md: '1 / -1' } }}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <VolunteerActivismRoundedIcon sx={{ color: 'primary.main' }} />
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Live totals</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <FiberManualRecordRoundedIcon
                    sx={{ fontSize: 11, color: live.connected ? 'success.main' : 'text.disabled' }}
                  />
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>
                    {live.connected ? 'Streaming live' : 'Reconnecting…'}
                  </Typography>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={4} sx={{ mb: 2, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Raised
                  </Typography>
                  <CurrencyDisplay
                    amount={live.raisedAmount}
                    currency={currency}
                    sx={{ fontWeight: 900, fontSize: '1.6rem', color: 'primary.main' }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Recent donations
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.6rem' }}>{live.donations.length}</Typography>
                </Box>
              </Stack>

              <ProgressBar
                current={live.raisedAmount}
                goal={live.goalAmount}
                currency={currency}
                showAmounts
                showPercentage
              />

              {live.lastDonation && (
                <Typography sx={{ mt: 1.5, fontSize: '0.82rem', color: 'text.secondary' }}>
                  Latest:{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {live.lastDonation.name}
                  </Box>
                  {typeof live.lastDonation.amount === 'number' && (
                    <>
                      {' — '}
                      <Box component="span" sx={{ fontWeight: 700, color: 'success.main' }}>
                        <CurrencyDisplay amount={live.lastDonation.amount} currency={currency} component="span" />
                      </Box>
                    </>
                  )}
                </Typography>
              )}

              <Divider sx={{ my: 2.5 }} />
              <Button
                brandVariant="outline"
                color="error"
                onClick={handleEnd}
                disabled={ending}
                startIcon={ending ? <LoadingDots size={6} /> : <StopCircleRoundedIcon />}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm, color: 'var(--text-error)', borderColor: '#A5432F' }}
              >
                {ending ? 'Ending…' : 'End session'}
              </Button>
            </Box>

            {/* Overlay link (optional external broadcasting) */}
            <Box sx={PANEL_SX}>
              <OverlayLinkCard session={session} onRotated={handleRotated} />
            </Box>

            {/* Privacy controls */}
            <Box sx={PANEL_SX}>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.5 }}>
                <ShieldRoundedIcon sx={{ color: 'primary.main' }} />
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Donor privacy</Typography>
              </Stack>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 1.5 }}>
                Changes apply live to the overlay and donor feed.
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={session.showDonorNames}
                      onChange={(e) => handlePrivacyChange('showDonorNames', e.target.checked)}
                    />
                  }
                  label="Show donor names"
                  disabled={session.privacyMode}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={session.showDonorMessages}
                      onChange={(e) => handlePrivacyChange('showDonorMessages', e.target.checked)}
                    />
                  }
                  label="Show donor messages"
                  disabled={session.privacyMode}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={session.showAmounts}
                      onChange={(e) => handlePrivacyChange('showAmounts', e.target.checked)}
                    />
                  }
                  label="Show donation amounts"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={session.privacyMode}
                      onChange={(e) => handlePrivacyChange('privacyMode', e.target.checked)}
                    />
                  }
                  label="Privacy mode (force-hide names & messages)"
                />
              </FormGroup>
            </Box>

            {/* QR manager */}
            <Box sx={{ ...PANEL_SX, gridColumn: { xs: '1', md: '1 / -1' } }}>
              <QrCodeManager campaignId={campaign.id} liveSessionId={session.id} />
            </Box>

            {/* Donor feed */}
            <Box sx={{ ...PANEL_SX, gridColumn: { xs: '1', md: '1 / -1' } }}>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
                <VolunteerActivismRoundedIcon sx={{ color: 'primary.main' }} />
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Donor feed</Typography>
              </Stack>
              <LiveDonationFeed campaignId={campaign.id} maxItems={10} />
            </Box>
          </Box>
        )}
        </Box>
      </Container>
    </Box>
  )
}
