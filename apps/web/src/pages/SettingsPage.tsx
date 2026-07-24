import { useState, useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { useNavigate } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

// ---------------------------------------------------------------------------
// Section Component
// ---------------------------------------------------------------------------

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        p: { xs: 2.5, sm: 4 },
        borderRadius: SHAPE.card,
        bgcolor: 'background.paper',
        border: '1px solid rgba(0,0,0,0.06)',
        mb: 3,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 3 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 1.5,
        '&:not(:last-child)': { borderBottom: '1px solid rgba(0,0,0,0.04)' },
      }}
    >
      <Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</Typography>
        {description && (
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{description}</Typography>
        )}
      </Box>
      <Switch
        checked={checked}
        onChange={(_, v) => onChange(v)}
        color="primary"
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export function SettingsPage() {
  const { logout } = useAuth()
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
  const [loading, setLoading] = useState(true)

  // Debounce timer ref for persisting settings
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch settings on mount
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

  // Persist settings to the API (debounced)
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

  return (
    <Box sx={{ bgcolor: '#F2EFEA', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="md">
        <Typography
          sx={{
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 900,
            fontSize: { xs: '1.5rem', md: '1.8rem' },
            mb: 4,
          }}
        >
          Settings
        </Typography>

        {/* Notification Preferences */}
        <SettingsSection title="Notification Preferences">
          <ToggleRow label="Email notifications" description="Receive updates via email" checked={emailNotif} onChange={(v) => { setEmailNotif(v); persistSettings({ notificationPreferences: { email: v, sms: smsNotif, push: pushNotif, donationReceipts, campaignUpdates, marketingEmails } }) }} />
          <ToggleRow label="SMS notifications" description="Receive updates via text message" checked={smsNotif} onChange={(v) => { setSmsNotif(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: v, push: pushNotif, donationReceipts, campaignUpdates, marketingEmails } }) }} />
          <ToggleRow label="Push notifications" description="Browser push notifications" checked={pushNotif} onChange={(v) => { setPushNotif(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: smsNotif, push: v, donationReceipts, campaignUpdates, marketingEmails } }) }} />
          <ToggleRow label="Donation receipts" description="Receive receipts for your donations" checked={donationReceipts} onChange={(v) => { setDonationReceipts(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: smsNotif, push: pushNotif, donationReceipts: v, campaignUpdates, marketingEmails } }) }} />
          <ToggleRow label="Campaign updates" description="Updates from campaigns you support" checked={campaignUpdates} onChange={(v) => { setCampaignUpdates(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: smsNotif, push: pushNotif, donationReceipts, campaignUpdates: v, marketingEmails } }) }} />
          <ToggleRow label="Marketing emails" description="Promotional content and newsletters" checked={marketingEmails} onChange={(v) => { setMarketingEmails(v); persistSettings({ notificationPreferences: { email: emailNotif, sms: smsNotif, push: pushNotif, donationReceipts, campaignUpdates, marketingEmails: v } }) }} />
        </SettingsSection>

        {/* Account Settings */}
        <SettingsSection title="Account Settings">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 600 }}>
            <TextField
              label="Currency"
              value="GHS (Ghanaian cedi)"
              helperText="All donations and campaigns use Ghanaian cedi"
              fullWidth
              disabled
            />
            <TextField
              select
              label="Language"
              value={language}
              onChange={(e) => { setLanguage(e.target.value); persistSettings({ language: e.target.value }) }}
              fullWidth
            >
              {['English', 'French', 'Swahili', 'Arabic', 'Portuguese'].map((l) => (
                <MenuItem key={l} value={l}>{l}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ mt: 2 }}>
            <ToggleRow label="Dark mode" description="Switch to dark theme (coming soon)" checked={darkMode} onChange={(v) => { setDarkMode(v); persistSettings({ darkMode: v }) }} />
          </Box>
        </SettingsSection>

        {/* Privacy Settings */}
        <SettingsSection title="Privacy Settings">
          <ToggleRow label="Make my donations anonymous by default" checked={anonymousDonations} onChange={(v) => { setAnonymousDonations(v); persistSettings({ anonymousDonations: v }) }} />
          <ToggleRow label="Show me on leaderboards" checked={showLeaderboards} onChange={(v) => { setShowLeaderboards(v); persistSettings({ showLeaderboards: v }) }} />
          <ToggleRow label="Allow profile to be public" checked={publicProfile} onChange={(v) => { setPublicProfile(v); persistSettings({ publicProfile: v }) }} />
        </SettingsSection>

        {/* Danger Zone */}
        <Box
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderRadius: SHAPE.card,
            bgcolor: 'background.paper',
            border: '1px solid rgba(239,83,80,0.2)',
            mb: 3,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 1, color: 'error.main' }}>
            Danger Zone
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>
            Once you delete your account, there is no going back. Please be certain.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteOpen(true)}
            sx={{ borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 700 }}
          >
            Delete Account
          </Button>
        </Box>

        {/* Delete Confirmation */}
        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete Account</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to permanently delete your account? This action cannot be undone.
              All your campaigns, donations, and data will be permanently removed.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteAccount} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Delete My Account
            </Button>
          </DialogActions>
        </Dialog>

        {saving && (
          <Box sx={{ position: 'fixed', top: 80, right: 24, zIndex: 1200, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper', px: 2, py: 1, borderRadius: SHAPE.sm, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
            <CircularProgress size={16} />
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Saving...</Typography>
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
