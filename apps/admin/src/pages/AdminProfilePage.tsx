import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import CakeRoundedIcon from '@mui/icons-material/CakeRounded'
import { keyframes, alpha } from '@mui/material/styles'
import { SHAPE, AiWritingBar } from '@ubuntu-fund/ui'
import { AiWritingAction } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/PageHeader'
import { TONES } from '@/lib/tones'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Section Card ────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  color,
  children,
  delay = 0,
}: {
  icon: React.ReactNode
  title: string
  color: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <Card
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: SHAPE.card,
        overflow: 'hidden',
        animation: `${fadeSlide} 0.4s ease ${delay}s both`,
        transition: 'border-color 0.3s ease',
        '&:hover': { borderColor: `${color}40` },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '20%',
            bottom: '20%',
            width: 3,
            borderRadius: SHAPE.bar,
            bgcolor: color,
          },
        }}
      >
        <Box sx={{ color, display: 'flex', '& svg': { fontSize: 22 } }}>{icon}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>{title}</Typography>
      </Box>
      {children}
    </Card>
  )
}

// ─── Styled input ────────────────────────────────────────────────────────────

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: SHAPE.sm,
    bgcolor: 'rgba(255,255,255,0.03)',
    '& fieldset': { borderColor: 'divider' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
  },
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminProfilePage() {
  const { user } = useAuth()

  // Profile fields
  const [name, setName] = useState(user?.name ?? '')
  const [email] = useState(user?.email ?? '')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [bio, setBio] = useState('')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  // Preferences
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [language, setLanguage] = useState('en')

  // UI state
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const [passwordError, setPasswordError] = useState('')

  async function handleSaveProfile() {
    setSaving(true)
    try {
      // In production: await api.put('/profile', { name, phone, country, bio })
      await new Promise((r) => setTimeout(r, 600))
      setSnack({ open: true, message: 'Profile updated successfully', severity: 'success' })
    } catch {
      setSnack({ open: true, message: 'Failed to update profile', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 600))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSnack({ open: true, message: 'Password changed successfully', severity: 'success' })
    } catch {
      setSnack({ open: true, message: 'Failed to change password', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePreferences() {
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 600))
      setSnack({ open: true, message: 'Preferences saved', severity: 'success' })
    } catch {
      setSnack({ open: true, message: 'Failed to save preferences', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      {/* ─── Profile Header ─── */}
      <PageHeader
        tone="green"
        eyebrow="Account"
        title={name || 'Admin User'}
        lede="Manage your personal details, password, and notification preferences."
        icon={<PersonRoundedIcon />}
        actions={
          <Chip
            label={user?.role === 'admin' ? 'Administrator' : user?.role ?? 'Admin'}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.68rem',
              fontWeight: 700,
              bgcolor: alpha('#5E8F72', 0.1),
              color: '#5E8F72',
              borderRadius: SHAPE.sm,
            }}
          />
        }
      />

      <Grid container spacing={3}>
        {/* ─── Personal Information ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<PersonRoundedIcon />} title="Personal Information" color="#5E8F72" delay={0.05}>
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <BadgeRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
              <TextField
                label="Email Address"
                value={email}
                disabled
                fullWidth
                size="small"
                helperText="Contact a super admin to change your email"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
              <TextField
                label="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
                size="small"
                placeholder="+233 24 000 0000"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
              <TextField
                label="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                fullWidth
                size="small"
                placeholder="Ghana"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PublicRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
              <AiWritingBar
                value={bio}
                onChange={setBio}
                inputLabel="Bio"
                allowedActions={[AiWritingAction.FORMALIZE, AiWritingAction.FIX_GRAMMAR, AiWritingAction.IMPROVE_CLARITY]}
              />
              <TextField
                label="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={3}
                placeholder="A short bio about yourself..."
                sx={inputSx}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<SaveRoundedIcon />}
                  onClick={handleSaveProfile}
                  disabled={saving}
                  sx={{
                    borderRadius: SHAPE.sm,
                    px: 3,
                    fontWeight: 700,
                    textTransform: 'none',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </Box>
            </Box>
          </SectionCard>
        </Grid>

        {/* ─── Change Password ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<LockRoundedIcon />} title="Change Password" color="#C06B58" delay={0.1}>
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {passwordError && (
                <Alert severity="error" sx={{ borderRadius: SHAPE.sm, py: 0 }}>
                  {passwordError}
                </Alert>
              )}
              <TextField
                label="Current Password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowCurrent(!showCurrent)}>
                          {showCurrent ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
              <TextField
                label="New Password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                size="small"
                helperText="Minimum 8 characters"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNew(!showNew)}>
                          {showNew ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
              <TextField
                label="Confirm New Password"
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                size="small"
                error={confirmPassword !== '' && confirmPassword !== newPassword}
                helperText={confirmPassword !== '' && confirmPassword !== newPassword ? 'Passwords do not match' : ''}
                sx={inputSx}
              />

              {/* Password strength indicator */}
              {newPassword && (
                <Box>
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                    {[1, 2, 3, 4].map((level) => {
                      const strength = (newPassword.length >= 8 ? 1 : 0) + (/[A-Z]/.test(newPassword) ? 1 : 0) + (/[0-9]/.test(newPassword) ? 1 : 0) + (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0)
                      const colors = ['#C06B58', '#D3A95C', '#C7A24A', '#5E8F72']
                      return (
                        <Box
                          key={level}
                          sx={{
                            flex: 1,
                            height: 3,
                            borderRadius: SHAPE.bar,
                            bgcolor: level <= strength ? colors[strength - 1] : 'rgba(255,255,255,0.06)',
                            transition: 'background-color 0.3s ease',
                          }}
                        />
                      )
                    })}
                  </Box>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                    {(() => {
                      const s = (newPassword.length >= 8 ? 1 : 0) + (/[A-Z]/.test(newPassword) ? 1 : 0) + (/[0-9]/.test(newPassword) ? 1 : 0) + (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0)
                      return ['Very weak', 'Weak', 'Fair', 'Strong'][s - 1] ?? 'Very weak'
                    })()}
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<LockRoundedIcon />}
                  onClick={handleChangePassword}
                  disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                  sx={{
                    borderRadius: SHAPE.sm,
                    px: 3,
                    fontWeight: 700,
                    textTransform: 'none',
                  }}
                >
                  {saving ? 'Updating...' : 'Update Password'}
                </Button>
              </Box>
            </Box>
          </SectionCard>
        </Grid>

        {/* ─── Notification Preferences ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<TuneRoundedIcon />} title="Notification Preferences" color="#74909A" delay={0.15}>
            {[
              { label: 'Email Notifications', desc: 'Receive important updates via email', checked: emailNotifs, onChange: setEmailNotifs },
              { label: 'Push Notifications', desc: 'Browser push notifications for real-time alerts', checked: pushNotifs, onChange: setPushNotifs },
              { label: 'Weekly Digest', desc: 'Summary of platform activity every Monday', checked: weeklyDigest, onChange: setWeeklyDigest },
              { label: 'Login Alerts', desc: 'Get notified when your account is accessed', checked: loginAlerts, onChange: setLoginAlerts },
            ].map((pref, i) => (
              <Box
                key={pref.label}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 3,
                  py: 2,
                  px: 3,
                  borderBottom: i < 3 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  transition: 'background 0.2s ease',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', color: 'text.primary' }}>{pref.label}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>{pref.desc}</Typography>
                </Box>
                <Switch
                  checked={pref.checked}
                  onChange={(_, v) => pref.onChange(v)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#74909A' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#74909A' },
                  }}
                />
              </Box>
            ))}
            <Box sx={{ p: 3, pt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<SaveRoundedIcon />}
                onClick={handleSavePreferences}
                disabled={saving}
                sx={{
                  borderRadius: SHAPE.sm,
                  px: 3,
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: '#4A6B75',
                  '&:hover': { bgcolor: '#74909A' },
                }}
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </Box>
          </SectionCard>
        </Grid>

        {/* ─── Regional & Display Preferences ─── */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard icon={<CakeRoundedIcon />} title="Regional & Display" color={TONES.maroon.text} delay={0.2}>
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                fullWidth
                size="small"
                select
                sx={inputSx}
              >
                {['Africa/Accra', 'UTC', 'Europe/London', 'America/New_York'].map((tz) => (
                  <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                ))}
              </TextField>
              <TextField
                label="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                fullWidth
                size="small"
                select
                sx={inputSx}
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="sw">Kiswahili</option>
                <option value="ha">Hausa</option>
                <option value="yo">Yorùbá</option>
                <option value="zu">isiZulu</option>
              </TextField>

              <Divider sx={{ borderColor: 'divider' }} />

              <Box>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 1 }}>Account created</Typography>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'text.primary', fontFamily: '"Outfit", monospace' }}>
                  {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 1 }}>Last login</Typography>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'text.primary', fontFamily: '"Outfit", monospace' }}>
                  {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          icon={<CheckCircleRoundedIcon />}
          severity={snack.severity}
          variant="filled"
          sx={{ borderRadius: SHAPE.sm, fontWeight: 600 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
