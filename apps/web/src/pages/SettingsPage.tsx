import { PublicationConsent } from '@/components/safety/PublicationConsent'
import { MfaSettings } from '@ubuntu-fund/ui'
import { PublicationReviews } from '@/components/account/PublicationReviews'
import { PublicationHeldNotice } from '@/components/safety/PublicationHeldNotice'
import { isPublicationHeld } from '@/lib/publicationDrafts'
import { DataRightsRequests } from '@/components/account/DataRightsRequests'
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog'
import { ActivityAlertSettings } from '@/components/account/ActivityAlertSettings'
import { NewsletterSettings } from '@/components/account/NewsletterSettings'
import { BlockedUsers } from '@/components/safety/BlockedUsers'
import { useSeo } from '@/lib/seo'
import Skeleton from '@mui/material/Skeleton'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import { AccountPageSkeleton, AccountHeading } from '@/components/account/AccountPage'
import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import { useLocation, useNavigate, Link as RouterLink } from 'react-router-dom'
import { SHAPE, ThemeStylePicker } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import { useColorMode } from '@/context/ColorModeContext'
import { api, ApiError } from '@/lib/api'
import { SignInPrompt } from '@/components/auth/SignInPrompt'

const FOREST = '#2E3D2F'
const INK = 'text.primary'
const INK_SECONDARY = 'text.secondary'
const CLAY = '#A5432F'
const HAIRLINE = '#E7E3D8'

const SECTIONS = [
  { id: 'notifications', label: 'Notifications', icon: <NotificationsRoundedIcon sx={{ fontSize: 19 }} /> },
  { id: 'preferences', label: 'Preferences', icon: <TuneRoundedIcon sx={{ fontSize: 19 }} /> },
  { id: 'privacy', label: 'Privacy', icon: <ShieldRoundedIcon sx={{ fontSize: 19 }} /> },
  { id: 'danger', label: 'Danger zone', icon: <WarningAmberRoundedIcon sx={{ fontSize: 19 }} /> },
]

// ── Section card with an icon-led header ─────────────────────────────────────
function SettingsSection({
  id,
  icon,
  title,
  description,
  tone = 'default',
  children,
}: {
  id: string
  icon: React.ReactNode
  title: string
  description?: string
  tone?: 'default' | 'danger'
  children: React.ReactNode
}) {
  // Theme-aware, not the raw brand hex. FOREST is a dark green and this icon
  // sits on --neu-surface, which is itself dark in dark mode — so the icon was
  // rendering dark-on-dark and effectively disappearing. The --text-* tokens
  // are derived per mode precisely so a foreground stays legible on both.
  const accent = tone === 'danger' ? 'var(--text-error)' : 'var(--text-brand)'
  return (
    <Box
      id={id}
      sx={{
        p: { xs: 2.5, sm: 3.5 },
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        boxShadow: 'var(--neu-raised)',
        mb: 3,
        scrollMarginTop: 96,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: description ? 0.5 : 2.5 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: accent,
            bgcolor: 'var(--neu-surface)',
            boxShadow: 'var(--neu-subtle)',
            borderRadius: 'var(--shape-card)',
          }}
        >
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: tone === 'danger' ? CLAY : INK }}>
          {title}
        </Typography>
      </Box>
      {description && (
        <Typography sx={{ fontSize: '0.82rem', color: INK_SECONDARY, mb: 2.5, ml: { sm: '53px' } }}>
          {description}
        </Typography>
      )}
      {children}
    </Box>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        py: 1.5,
        '&:not(:last-child)': { boxShadow: '0 9px 14px -16px rgba(38,55,44,0.4)' },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: INK }}>{label}</Typography>
        {description && (
          <Typography sx={{ fontSize: '0.78rem', color: INK_SECONDARY }}>{description}</Typography>
        )}
      </Box>
      <Switch checked={checked} onChange={(_, v) => onChange(v)} color="primary" slotProps={{ input: { role: 'switch', 'aria-label': label } }} />
    </Box>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  return <SettingsForViewer key={user?.id ?? 'guest'} />
}
function SettingsForViewer() {
  useSeo({
    title: 'Account settings | Ujimora',
    description:
      'Choose how Ujimora contacts you, set your appearance, control what other people can see about you, and close your account if you wish.',
    path: '/settings',
    robots: 'noindex, nofollow',
  })
  const { user, logout, replaceTokens, isLoading: authLoading } = useAuth()
  const { darkMode, setDarkMode, skin, setSkin } = useColorMode()
  const navigate = useNavigate()
  const { hash } = useLocation()

  // Privacy settings
  const [anonymousDonations, setAnonymousDonations] = useState(false)
  const [showLeaderboards, setShowLeaderboards] = useState(true)
  const [publicProfile, setPublicProfile] = useState(true)
  const [identityConsent, setIdentityConsent] = useState(false)
  const [publicationError, setPublicationError] = useState('')
  // Going public was held for safety review: a notice, not an error.
  const [publicationHeld, setPublicationHeld] = useState(false)

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [snack, setSnack] = useState(false)
  const [snackMessage, setSnackMessage] = useState('Settings saved')
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'info' | 'error'>('success')
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadStatus, setLoadStatus] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const live = useRef(true)
  const writes = useRef(Promise.resolve())
  const confirmed = useRef<Record<string, unknown>>({ darkMode, anonymousDonations: false, showLeaderboards: true, publicProfile: true })
  const revision = useRef(0)
  const fieldRevision = useRef<Record<string, number>>({})
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  useEffect(() => {
    // Wait for auth to settle (token refresh on load) before fetching, so the
    // request never races the refresh and 401s on a stale token.
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setLoadStatus(null)
    api.get<{
      darkMode?: boolean
      anonymousDonations?: boolean
      showLeaderboards?: boolean
      publicProfile?: boolean
    }>('/profile')
      .then((data) => {
        if (cancelled) return
        confirmed.current = { ...confirmed.current, ...data }
        if (data.darkMode !== undefined) setDarkMode(data.darkMode)
        if (data.anonymousDonations !== undefined) setAnonymousDonations(data.anonymousDonations)
        if (data.showLeaderboards !== undefined) setShowLeaderboards(data.showLeaderboards)
        if (data.publicProfile !== undefined) setPublicProfile(data.publicProfile)
      })
      .catch((error: Error) => {
        if (cancelled) return
        setLoadError(error.message)
        setLoadStatus(error instanceof ApiError ? error.status : null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [authLoading, setDarkMode])

  // Links such as /settings#privacy (from "Check Publication reviews") land on
  // their section once the page has rendered past its loading skeleton.
  const ready = !authLoading && !loading
  useEffect(() => {
    if (!ready || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [ready, hash])

  const persistSettings = useCallback((patch: Record<string, unknown>) => {
    const version = ++revision.current
    for (const key of Object.keys(patch)) fieldRevision.current[key] = version
    setSaving(true)
    writes.current = writes.current.then(async () => {
      if (!live.current) return
      try {
        await api.put('/profile', { ...patch, ...(patch.publicProfile === true ? { automatedReviewConsent: identityConsent } : {}) })
        if (!live.current) return
        if (patch.publicProfile === true) { setPublicationError(''); setPublicationHeld(false) }
        Object.assign(confirmed.current, patch)
        if (version === revision.current) { setSnackMessage('Settings saved'); setSnackSeverity('success'); setSnack(true) }
      } catch (err) {
        if (!live.current) return
        const held = patch.publicProfile === true && isPublicationHeld(err)
        if (patch.publicProfile === true) {
          setPublicationHeld(held)
          setPublicationError(held ? '' : err instanceof Error ? err.message : 'Could not publish your profile.')
        }
        for (const key of Object.keys(patch)) {
          if (fieldRevision.current[key] !== version) continue
          if (key === 'darkMode') setDarkMode(confirmed.current[key] as boolean)
          if (key === 'anonymousDonations') setAnonymousDonations(confirmed.current[key] as boolean)
          if (key === 'showLeaderboards') setShowLeaderboards(confirmed.current[key] as boolean)
          if (key === 'publicProfile') setPublicProfile(confirmed.current[key] as boolean)
        }
        setSnackMessage(held ? 'Waiting for safety review. Your profile stays private until it is approved.' : err instanceof Error ? err.message : 'Failed to save settings')
        setSnackSeverity(held ? 'info' : 'error'); setSnack(true)
      } finally {
        if (live.current && version === revision.current) setSaving(false)
      }
    })
  }, [setDarkMode, identityConsent])

  function handleAccountDeleted() {
    setDeleteOpen(false)
    logout()
    navigate('/')
  }

  const initials = (user?.name ?? 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  if (authLoading || loading) return <AccountPageSkeleton layout="settings" />
  // A rejected session gets a friendly sign-in path, not a dead-end error.
  if (loadStatus === 401)
    return (
      <SignInPrompt
        title="Please sign in again"
        description="Your session ended. Sign in to manage your settings — we’ll bring you right back here."
      />
    )
  // Any other load failure is recoverable: retry, or head home.
  if (loadError)
    return (
      <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', px: 2 }}>
        <Box sx={{ maxWidth: 460, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>{loadError}</Alert>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" color="primary" onClick={() => window.location.reload()} sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 700, px: 3 }}>
              Try again
            </Button>
            <Button component={RouterLink} to="/dashboard" variant="text" sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 700, px: 3 }}>
              Go to dashboard
            </Button>
          </Box>
        </Box>
      </Box>
    )

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        <AccountHeading title="Settings" description="Make Ujimora work for you. Manage notifications, privacy, and appearance." icon={<SettingsRoundedIcon />} />

            <Button href="/payout-accounts" sx={{ mb: 3 }}>Manage payout accounts</Button>
        <Grid container spacing={4}>
          {/* Left rail */}
          <Grid size={{ xs: 12, md: 4, lg: 3.5 }}>
            <Box sx={{ position: { md: 'sticky' }, top: 88 }}>
              <Box
                sx={{
                  p: 2.25,
                  mb: 2,
                  borderRadius: SHAPE.card,
                  bgcolor: 'background.paper',
                  boxShadow: 'var(--neu-raised)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Avatar sx={{ width: 44, height: 44, bgcolor: FOREST, color: '#F5F2EA', fontWeight: 700 }}>
                  {initials}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 700, color: INK }}>{user?.name ?? 'Your account'}</Typography>
                  <Typography noWrap sx={{ fontSize: '0.8rem', color: INK_SECONDARY }}>{user?.email}</Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  p: 1,
                  borderRadius: SHAPE.card,
                  bgcolor: 'background.paper',
                  boxShadow: 'var(--neu-raised)',
                  display: { xs: 'none', md: 'block' },
                }}
              >
                {SECTIONS.map((s) => (
                  <Box
                    key={s.id}
                    component="a"
                    href={`#${s.id}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 1.5,
                      py: 1.1,
                      borderRadius: SHAPE.sm,
                      textDecoration: 'none',
                      color: s.id === 'danger' ? CLAY : INK_SECONDARY,
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      transition: 'background-color 140ms ease, color 140ms ease',
                      '&:hover': { bgcolor: 'rgba(46, 61, 47, 0.06)', color: s.id === 'danger' ? CLAY : INK },
                    }}
                  >
                    {s.icon}
                    {s.label}
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>

          {/* Content */}
          <Grid size={{ xs: 12, md: 8, lg: 8.5 }}>
            <SettingsSection
              id="notifications"
              icon={<NotificationsRoundedIcon sx={{ fontSize: 19 }} />}
              title="Notifications"
              description="Choose how you hear from us and the campaigns you support."
            >
              <ActivityAlertSettings />
              <NewsletterSettings />
              <Typography variant="body2" color="text.secondary">SMS, browser push and campaign announcement delivery are not available yet. Choose inbox alerts or emails above for supported activity updates.</Typography>
            </SettingsSection>

            <SettingsSection
              id="preferences"
              icon={<TuneRoundedIcon sx={{ fontSize: 19 }} />}
              title="Preferences"
              description="Currency and appearance."
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Currency — fixed for the Ghana launch */}
                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: INK_SECONDARY, mb: 0.75 }}>Currency</Typography>
                  <Chip
                    icon={<PaymentsRoundedIcon sx={{ fontSize: 18 }} />}
                    label="GH₵ · Ghanaian Cedi"
                    sx={{ fontWeight: 700, bgcolor: 'rgba(46, 61, 47, 0.06)', color: INK, border: `1px solid ${HAIRLINE}` }}
                  />
                  <Typography sx={{ fontSize: '0.75rem', color: INK_SECONDARY, mt: 0.75 }}>
                    All donations and campaigns use the Ghanaian cedi.
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ mt: 1 }}>
                <ToggleRow label="Dark mode" description="Use Ujimora's low-light color theme" checked={darkMode} onChange={(v) => { setDarkMode(v); persistSettings({ darkMode: v }) }} />
              </Box>
              <Box sx={{ mt: 2.5 }}>
                <ThemeStylePicker value={skin} onChange={setSkin} />
              </Box>
            </SettingsSection>

            <SettingsSection id="security" icon={<ShieldRoundedIcon sx={{ fontSize: 19 }} />} title="Security" description="Choose extra protection for your account.">
              <MfaSettings key={user?.id} client={api} onTokens={tokens => replaceTokens(tokens, user?.id ?? '')} />
            </SettingsSection>
            <SettingsSection
              id="privacy"
              icon={<ShieldRoundedIcon sx={{ fontSize: 19 }} />}
              title="Privacy"
              description="Control what others can see about you."
            >
              <BlockedUsers />
              <PublicationReviews />
              <DataRightsRequests />
              <ToggleRow label="Make my donations anonymous by default" checked={anonymousDonations} onChange={(v) => { setAnonymousDonations(v); persistSettings({ anonymousDonations: v }) }} />
              <ToggleRow label="Show me on leaderboards" checked={showLeaderboards} onChange={(v) => { setShowLeaderboards(v); persistSettings({ showLeaderboards: v }) }} />
              <Typography variant="body2">Making your profile public requires review of its current identity. Hiding it takes effect without review.</Typography>
              <PublicationConsent value={identityConsent} onChange={setIdentityConsent} />
              {publicationError && <Alert severity="error">{publicationError} Check Publication reviews above, then enable the switch again after approval.</Alert>}
              {publicationHeld && <PublicationHeldNotice retry="turn on “Allow profile to be public” again" reviews="above" />}
              <ToggleRow label="Allow profile to be public" checked={publicProfile} onChange={(v) => { setPublicProfile(v); persistSettings({ publicProfile: v }) }} />
            </SettingsSection>

            <SettingsSection
              id="danger"
              icon={<WarningAmberRoundedIcon sx={{ fontSize: 19 }} />}
              title="Danger zone"
              description="Once you delete your account, there is no going back. Please be certain."
              tone="danger"
            >
              <Button
                variant="outlined"
                color="error"
                onClick={() => setDeleteOpen(true)}
                sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 700, px: 2.5 }}
              >
                Delete account
              </Button>
            </SettingsSection>
          </Grid>
        </Grid>

        {/* Delete Confirmation */}
        <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={handleAccountDeleted} />

        {saving && (
          <Box sx={{ position: 'fixed', bottom: 'calc(var(--mobile-nav-height, 0px) + 24px)', right: 24, zIndex: 1200, display: 'flex', alignItems: 'center', gap: 1, bgcolor: FOREST, color: '#F5F2EA', px: 2, py: 1, borderRadius: '999px' }}>
            <Skeleton variant="rounded" width={40} height={16} sx={{ bgcolor: 'rgba(245,242,234,.2)' }} />
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Saving…</Typography>
          </Box>
        )}

        <Snackbar open={snack} autoHideDuration={2000} onClose={() => setSnack(false)}>
          <Alert onClose={() => setSnack(false)} severity={snackSeverity} variant="filled">
            {snackMessage}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  )
}
