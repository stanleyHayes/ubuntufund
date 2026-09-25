import TextField from '@/components/AdminTextField'
import { Tabs, Tab } from '@mui/material'
import { raisedSurface } from '@/lib/surfaces'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import ExportMenu from '@/components/ExportMenu'
import { exportTable } from '@/lib/exports/report'
import { MfaSettings } from '@ubuntu-fund/ui'
import { useState, useEffect, useRef } from 'react'
import Skeleton from '@mui/material/Skeleton'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Grid from '@mui/material/Grid'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
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
import { alpha } from '@mui/material/styles'
import { SHAPE } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import PageHeader from '@/components/PageHeader'
import { api } from '@/lib/api'

// ─── Animations ──────────────────────────────────────────────────────────────

// ─── Section Card ────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <Card
      sx={{
        bgcolor: 'background.paper',
        borderRadius: SHAPE.card,
        boxShadow: 'var(--neu-raised)',
        overflow: 'hidden',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none', transition: 'none' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 3,
          py: 2,
          boxShadow: '0 10px 16px -18px rgba(0,0,0,0.8)',
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
        <Box aria-hidden="true" sx={{ position: 'absolute', right: 20, top: -18, opacity: .035, pointerEvents: 'none', '& svg': { fontSize: 115 } }}>{icon}</Box>
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
  return <AdminProfileForViewer key={user?.id ?? 'guest'} />
}
function AdminProfileForViewer() {
  const [tab, setTab] = useState('details')
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [identityError, setIdentityError] = useState('')
  const savedIdentity = useRef({ name: '', country: '' })
  const { user, updateName, replaceTokens } = useAuth()

  // Profile fields
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [bio, setBio] = useState('')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  // UI state
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const [passwordError, setPasswordError] = useState('')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    api.get<{ name: string; email: string; phone?: string; country?: string; bio?: string }>('/profile')
      .then(profile => {
        if (!active) return
        savedIdentity.current = { name: profile.name, country: profile.country ?? '' }
        setName(profile.name); setEmail(profile.email); setPhone(profile.phone ?? '')
        setCountry(profile.country ?? ''); setBio(profile.bio ?? '')
      })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load profile') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])

  async function handleSaveProfile() {
    setSaving(true); setIdentityError('')
    try {
      const result = await api.put<{ name: string }>('/profile', { ...(name.trim() !== savedIdentity.current.name ? { name: name.trim() } : {}), phone: phone.trim(), ...(country.trim() && country.trim() !== savedIdentity.current.country ? { country: country.trim() } : {}), bio: bio.trim(), automatedReviewConsent })
      if (!live.current) return
      savedIdentity.current = { name: result.name, country: country.trim() || savedIdentity.current.country }
      setName(result.name)
      updateName(result.name)
      setSnack({ open: true, message: 'Profile updated successfully', severity: 'success' })
    } catch (error) {
      if (!live.current) return
      setIdentityError(error instanceof Error ? error.message : 'Failed to update profile')
      setSnack({ open: true, message: error instanceof Error ? error.message : 'Failed to update profile', severity: 'error' })
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
    if (!currentPassword) {
      setPasswordError('Current password is required')
      return
    }
    setSaving(true)
    try {
      // The API rotates authVersion, so the old tokens stop working at once.
      // Keep this console signed in with the fresh pair it returns.
      const result = await api.put<{ tokens?: { accessToken: string; refreshToken: string } }>('/auth/change-password', { currentPassword, newPassword })
      if (result?.tokens && user) replaceTokens(result.tokens, user.id)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSnack({ open: true, message: 'Password changed successfully', severity: 'success' })
    } catch (error) {
      setSnack({ open: true, message: error instanceof Error ? error.message : 'Failed to change password', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Box aria-label="Loading profile" role="status" sx={{ display: 'grid', gap: 3 }}><Skeleton height={100} /><Skeleton variant="rounded" height={300} /><Skeleton variant="rounded" height={180} /></Box>
  if (loadError) return <Alert severity="error" action={<Button onClick={() => setRevision(r => r + 1)}>Retry</Button>}>{loadError}</Alert>

  return (
    <Box>
      {/* ─── Profile Header ─── */}
      <PageHeader
        tone="green"
        eyebrow="Account"
        title={name || 'Admin User'}
        lede="Manage your personal details and password."
        icon={<PersonRoundedIcon />}
        actions={<>{<Chip
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
          />}<ExportMenu title="My profile" getReport={() => ({ title: 'Administrator profile', tables: [exportTable('Account', user ? [user] : [], { ID: r => r.id, Name: r => r.name, Email: r => r.email, Role: r => r.role })] })} /></>}
      />


      <Box sx={{ ...raisedSurface, mb: 3, p: 1, minWidth: 0 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Profile sections">
          <Tab id="profile-tab-details" aria-controls="profile-panel-details" value="details" icon={<PersonRoundedIcon />} iconPosition="start" label="Personal details" />
          <Tab id="profile-tab-security" aria-controls="profile-panel-security" value="security" icon={<LockRoundedIcon />} iconPosition="start" label="Security" />
          <Tab id="profile-tab-preferences" aria-controls="profile-panel-preferences" value="preferences" icon={<TuneRoundedIcon />} iconPosition="start" label="Preferences" />
        </Tabs>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{tab === 'details' ? 'Keep your contact information and public introduction up to date.' : tab === 'security' ? 'Manage your password and optional multi-factor authentication. Keep recovery codes somewhere safe.' : 'How staff alerts reach you in the console.'}</Typography>
      <Grid container spacing={3}>
        {/* ─── Personal Information ─── */}
        <Grid size={{ xs: 12 }} role="tabpanel" id="profile-panel-details" aria-labelledby="profile-tab-details" hidden={tab !== 'details'}>
          <SectionCard icon={<PersonRoundedIcon />} title="Personal Information" color="#5E8F72">
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField optionContext="language"
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
              <TextField optionContext="language"
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
              <TextField optionContext="language"
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
              <TextField optionContext="language"
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
              <TextField optionContext="language"
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
              <FormControlLabel control={<Checkbox checked={automatedReviewConsent} onChange={event => setAutomatedReviewConsent(event.target.checked)} />} label="Use OpenAI to check this public identity (optional)" />
              <Typography variant="body2">Only the proposed public name, country and images are reviewed. Phone numbers and biography are excluded. Without permission, staff review the identity.</Typography>
              {identityError && <Alert severity="error">{identityError} After approval, save the same version here. <Button href="/publication-reviews" target="_blank" rel="noopener noreferrer">Open review queue in a new tab</Button></Alert>}
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

        <Grid size={{ xs: 12 }} role="tabpanel" id="profile-panel-security" aria-labelledby="profile-tab-security" hidden={tab !== 'security'}><SectionCard icon={<LockRoundedIcon />} title="Account Protection" color="#5E8F72"><Box sx={{ p: 3 }}><MfaSettings key={user?.id} client={api} onTokens={tokens => replaceTokens(tokens, user?.id ?? '')} /></Box></SectionCard></Grid>
        {/* ─── Change Password ─── */}
        <Grid size={{ xs: 12 }} hidden={tab !== 'security'}>
          <SectionCard icon={<LockRoundedIcon />} title="Change Password" color="#C06B58">
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {passwordError && (
                <Alert severity="error" sx={{ borderRadius: SHAPE.sm, py: 0 }}>
                  {passwordError}
                </Alert>
              )}
              <TextField optionContext="language"
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
                        <IconButton aria-label="Toggle current password visibility" size="small" onClick={() => setShowCurrent(!showCurrent)}>
                          {showCurrent ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
              <TextField optionContext="language"
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
                        <IconButton aria-label="Toggle new password visibility" size="small" onClick={() => setShowNew(!showNew)}>
                          {showNew ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={inputSx}
              />
              <TextField optionContext="language"
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
        {/* The former email/push switches and language select saved settings that nothing
            read (push delivery is disabled), so they are replaced with what actually happens. */}
        <Grid size={{ xs: 12 }} role="tabpanel" id="profile-panel-preferences" aria-labelledby="profile-tab-preferences" hidden={tab !== 'preferences'}>
          <SectionCard icon={<TuneRoundedIcon />} title="Notification Preferences" color="#74909A">
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography sx={{ fontSize: '0.88rem', color: 'text.primary' }}>Staff alerts appear in the notification bell at the top of the console.</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Email and browser push alerts for staff are not available yet, and the console is in English only. Account security emails, such as password-change notices, are not affected.</Typography>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={snack.severity === 'error' ? null : 4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
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
