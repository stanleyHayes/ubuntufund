import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import { useNavigate } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

const FOREST = '#2E3D2F'
const INK = '#1A2E22'
const INK_SECONDARY = '#4A5A50'
const GOLD_DARK = '#A07E33'
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
  const accent = tone === 'danger' ? CLAY : FOREST
  return (
    <Box
      id={id}
      sx={{
        p: { xs: 2.5, sm: 3.5 },
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        border: `1px solid ${tone === 'danger' ? 'rgba(165, 67, 47, 0.28)' : HAIRLINE}`,
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
            bgcolor: tone === 'danger' ? 'rgba(165, 67, 47, 0.10)' : 'rgba(46, 61, 47, 0.08)',
            borderRadius: '4px 12px 4px 12px',
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
        '&:not(:last-child)': { borderBottom: `1px solid ${HAIRLINE}` },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: INK }}>{label}</Typography>
        {description && (
          <Typography sx={{ fontSize: '0.78rem', color: INK_SECONDARY }}>{description}</Typography>
        )}
      </Box>
      <Switch checked={checked} onChange={(_, v) => onChange(v)} color="primary" />
    </Box>
  )
}

export function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Notification preferences
  const [emailNotif, setEmailNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(false)
  const [pushNotif, setPushNotif] = useState(true)
  const [donationReceipts, setDonationReceipts] = useState(true)
  const [campaignUpdates, setCampaignUpdates] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)

  // Account settings — Ghana launch: currency is fixed to GHS
  const currency = 'GHS'
  const [language, setLanguage] = useState('English')
  const [darkMode, setDarkMode] = useState(false)

  // Privacy settings
  const [anonymousDonations, setAnonymousDonations] = useState(false)
  const [showLeaderboards, setShowLeaderboards] = useState(true)
  const [publicProfile, setPublicProfile] = useState(true)

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [snack, setSnack] = useState(false)
  const [snackMessage, setSnackMessage] = useState('Settings saved')
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success')
  const [saving, setSaving] = useState(false)
  const [, setLoading] = useState(true)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get<{
      notificationPreferences?: {
        email?: boolean
        sms?: boolean
        push?: boolean
        donationReceipts?: boolean
        campaignUpdates?: boolean
        marketingEmails?: boolean
      }
      preferredCurrency?: string
      language?: string
      darkMode?: boolean
      anonymousDonations?: boolean
      showLeaderboards?: boolean
      publicProfile?: boolean
    }>('/profile')
      .then((data) => {
        if (cancelled) return
        const np = data.notificationPreferences
        if (np) {
          if (np.email !== undefined) setEmailNotif(np.email)
          if (np.sms !== undefined) setSmsNotif(np.sms)
          if (np.push !== undefined) setPushNotif(np.push)
          if (np.donationReceipts !== undefined) setDonationReceipts(np.donationReceipts)
          if (np.campaignUpdates !== undefined) setCampaignUpdates(np.campaignUpdates)
          if (np.marketingEmails !== undefined) setMarketingEmails(np.marketingEmails)
        }
        if (data.language) setLanguage(data.language)
        if (data.darkMode !== undefined) setDarkMode(data.darkMode)
        if (data.anonymousDonations !== undefined) setAnonymousDonations(data.anonymousDonations)
        if (data.showLeaderboards !== undefined) setShowLeaderboards(data.showLeaderboards)
        if (data.publicProfile !== undefined) setPublicProfile(data.publicProfile)
      })
      .catch(() => {
        // Keep defaults on failure
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const persistSettings = useCallback((overrides: Record<string, unknown> = {}) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      try {
        const payload = {
          notificationPreferences: {
            email: emailNotif,
            sms: smsNotif,
            push: pushNotif,
            donationReceipts,
            campaignUpdates,
            marketingEmails,
          },
          preferredCurrency: currency,
          language,
          darkMode,
          anonymousDonations,
          showLeaderboards,
          publicProfile,
          ...overrides,
        }
        await api.put('/profile', payload)
        setSnackMessage('Settings saved')
        setSnackSeverity('success')
        setSnack(true)
      } catch (err) {
        setSnackMessage(err instanceof Error ? err.message : 'Failed to save settings')
        setSnackSeverity('error')
        setSnack(true)
      } finally {
        setSaving(false)
      }
    }, 400)
  }, [emailNotif, smsNotif, pushNotif, donationReceipts, campaignUpdates, marketingEmails, currency, language, darkMode, anonymousDonations, showLeaderboards, publicProfile])

  function handleDeleteAccount() {
    setDeleteOpen(false)
    logout()
    navigate('/')
  }

  const initials = (user?.name ?? 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <Box sx={{ bgcolor: '#F2EFEA', minHeight: '100vh', py: { xs: 4, md: 6 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD_DARK, mb: 0.75 }}>
            Account
          </Typography>
          <Typography sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 900, fontSize: { xs: '1.6rem', md: '2rem' }, color: INK }}>
            Settings
          </Typography>
          <Typography sx={{ color: INK_SECONDARY, mt: 0.5 }}>
            Manage how UbuntuFund notifies you and what others can see.
          </Typography>
        </Box>

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
                  border: `1px solid ${HAIRLINE}`,
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
                  border: `1px solid ${HAIRLINE}`,
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
              <ToggleRow label="Email notifications" description="Receive updates via email" checked={emailNotif} onChange={(v) => { setEmailNotif(v); persistSettings({ notificationPreferences: { email: v, sms: smsNotif, push: pushNotif, donationReceipts, campaignUpdates, marketingEmails } }) }} />
              <ToggleRow label="SMS notifications" description="Receive updates via text message" checked={smsNotif} onChange={(v) => { setSmsNotif(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: v, push: pushNotif, donationReceipts, campaignUpdates, marketingEmails } }) }} />
              <ToggleRow label="Push notifications" description="Browser push notifications" checked={pushNotif} onChange={(v) => { setPushNotif(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: smsNotif, push: v, donationReceipts, campaignUpdates, marketingEmails } }) }} />
              <ToggleRow label="Donation receipts" description="Receive receipts for your donations" checked={donationReceipts} onChange={(v) => { setDonationReceipts(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: smsNotif, push: pushNotif, donationReceipts: v, campaignUpdates, marketingEmails } }) }} />
              <ToggleRow label="Campaign updates" description="Updates from campaigns you support" checked={campaignUpdates} onChange={(v) => { setCampaignUpdates(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: smsNotif, push: pushNotif, donationReceipts, campaignUpdates: v, marketingEmails } }) }} />
              <ToggleRow label="Marketing emails" description="Promotional content and newsletters" checked={marketingEmails} onChange={(v) => { setMarketingEmails(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: smsNotif, push: pushNotif, donationReceipts, campaignUpdates, marketingEmails: v } }) }} />
            </SettingsSection>

            <SettingsSection
              id="preferences"
              icon={<TuneRoundedIcon sx={{ fontSize: 19 }} />}
              title="Preferences"
              description="Language, currency, and appearance."
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
                <TextField
                  select
                  label="Language"
                  value={language}
                  onChange={(e) => { setLanguage(e.target.value); persistSettings({ language: e.target.value }) }}
                  sx={{ maxWidth: 320 }}
                >
                  {['English', 'Twi', 'Ga', 'Ewe', 'Hausa', 'Dagbani'].map((l) => (
                    <MenuItem key={l} value={l}>{l}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box sx={{ mt: 1 }}>
                <ToggleRow label="Dark mode" description="Switch to dark theme (coming soon)" checked={darkMode} onChange={(v) => { setDarkMode(v); persistSettings({ darkMode: v }) }} />
              </Box>
            </SettingsSection>

            <SettingsSection
              id="privacy"
              icon={<ShieldRoundedIcon sx={{ fontSize: 19 }} />}
              title="Privacy"
              description="Control what others can see about you."
            >
              <ToggleRow label="Make my donations anonymous by default" checked={anonymousDonations} onChange={(v) => { setAnonymousDonations(v); persistSettings({ anonymousDonations: v }) }} />
              <ToggleRow label="Show me on leaderboards" checked={showLeaderboards} onChange={(v) => { setShowLeaderboards(v); persistSettings({ showLeaderboards: v }) }} />
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
        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete account</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to permanently delete your account? This action cannot be undone.
              All your campaigns, donations, and data will be permanently removed.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteAccount} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Delete my account
            </Button>
          </DialogActions>
        </Dialog>

        {saving && (
          <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200, display: 'flex', alignItems: 'center', gap: 1, bgcolor: FOREST, color: '#F5F2EA', px: 2, py: 1, borderRadius: '999px' }}>
            <CircularProgress size={15} sx={{ color: '#F5F2EA' }} />
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
