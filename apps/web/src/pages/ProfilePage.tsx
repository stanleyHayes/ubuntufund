import { PublicationConsent } from '@/components/safety/PublicationConsent'
import { PublicationReviews } from '@/components/account/PublicationReviews'
import { useSeo } from '@/lib/seo'
import { LoadingDots } from '@ubuntu-fund/ui'
import { ProfileArtwork } from '@/components/profile/ProfileArtwork'
import { ProfileImageEditor } from '@/components/profile/ProfileImageEditor'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
import { useState, useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { AccountPageSkeleton } from '@/components/account/AccountPage'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import KYCStatus from '@/components/KYCStatus'
import { PasswordStrength } from '@/components/auth/PasswordStrength'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import { keyframes } from '@mui/material/styles'
import { SHAPE, EmptyState } from '@ubuntu-fund/ui'
import { CampaignCategory } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { api, type AuthTokens } from '@/lib/api'
import { Link as RouterLink } from 'react-router-dom'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const countUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Constants ───────────────────────────────────────────────────────────────


interface ProfileImpact {
  /** Net of completed refunds, one entry per currency (never summed across currencies). */
  donatedByCurrency: Array<{ currency: string; net: number }>
  donationCount: number
  campaignsSupported: number
  campaignsCreated: number
  topCategories: CampaignCategory[]
  recentDonations: Array<{ campaign: string; amount: number; currency: string; date: string }>
}

const DEFAULT_IMPACT: ProfileImpact = {
  donatedByCurrency: [],
  donationCount: 0,
  campaignsSupported: 0,
  campaignsCreated: 0,
  topCategories: [],
  recentDonations: [],
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

/** Every currency the member gave in, e.g. "GH₵100.00 · US$30.00"; zero in cedis when none. */
function formatDonated(entries: ProfileImpact['donatedByCurrency']): string {
  const given = entries.filter(entry => entry.net > 0)
  return given.length ? given.map(entry => formatMoney(entry.net, entry.currency)).join(' · ') : formatMoney(0, 'GHS')
}

// ─── Tab Panel ───────────────────────────────────────────────────────────────

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color, delay }: { icon: React.ReactNode; value: string; label: string; color: string; delay: number }) {
  return (
    <Card
      elevation={0}
      sx={{
        boxShadow: 'var(--neu-raised)',
        borderRadius: SHAPE.card,
        animation: `${fadeIn} 0.5s ease ${delay}s both`,
        transition: 'border-color 0.25s ease',
        '&:hover': {
          borderColor: color,
        },
      }}
    >
      <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
        <Box sx={{ color, mb: 1, display: 'flex', justifyContent: 'center' }}>{icon}</Box>
        <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: 'text.primary', animation: `${countUp} 0.5s ease ${delay + 0.2}s both` }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  )
}

// ─── Profile Page ────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user } = useAuth()
  return <ProfileForViewer key={user?.id ?? 'guest'} />
}
function ProfileForViewer() {
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  useSeo({
    title: 'Your profile | Ujimora',
    description:
      'Update the photo, name and bio on your Ujimora profile, change your password, check your verification badge and see the impact you have made.',
    path: '/profile',
    robots: 'noindex, nofollow',
  })
  const { user, updateName, replaceTokens } = useAuth()
  const [tab, setTab] = useState(0)
  const [images, setImages] = useState({ avatarUrl: '', coverUrl: '' })
  const [imageEditor, setImageEditor] = useState<'avatarUrl' | 'coverUrl' | null>(null)
  const [failedCover, setFailedCover] = useState('')
  const [impact, setImpact] = useState<ProfileImpact>(DEFAULT_IMPACT)
  const [impactLoading, setImpactLoading] = useState(true)

  // Edit Profile state
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [country, setCountry] = useState('')
  const [profileLoadError, setProfileLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [organizationName, setOrganizationName] = useState(user?.organizationName ?? '')
  const [savedName, setSavedName] = useState(user?.name ?? '')
  const [profileSnack, setProfileSnack] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [shareSnack, setShareSnack] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSnack, setPasswordSnack] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)


  // Fetch profile impact data
  useEffect(() => {
    let cancelled = false
    async function fetchImpact() {
      setImpactLoading(true)
      try {
        // Only the member's own profile: /analytics/overview holds platform-wide totals.
        const [profileResult] = await Promise.allSettled([
          api.get<Partial<ProfileImpact> & { name?: string; organizationName?: string; phone?: string; bio?: string; country?: string; avatarUrl?: string; coverUrl?: string }>('/profile'),
        ])
        if (!cancelled) {
          if (profileResult.status === 'rejected') { setProfileLoadError(true); return }
          const profile = profileResult.value
          setProfileLoadError(false)
          setOrganizationName(profile.organizationName ?? '')
          setName(profile.name ?? '')
          setSavedName(profile.name ?? '')
          setPhone(profile.phone ?? '')
          setBio(profile.bio ?? '')
          setCountry(profile.country ?? '')
          setImages({ avatarUrl: profile.avatarUrl ?? '', coverUrl: profile.coverUrl ?? '' })
          const merged: ProfileImpact = { ...DEFAULT_IMPACT, ...profile }
          setImpact({ ...merged, donatedByCurrency: Array.isArray(merged.donatedByCurrency) ? merged.donatedByCurrency : [] })
        }
      } catch {
        // On failure, keep defaults (zeros / empty arrays)
        if (!cancelled) {
          setImpact(DEFAULT_IMPACT)
          setProfileLoadError(true)
        }
      } finally {
        if (!cancelled) setImpactLoading(false)
      }
    }
    fetchImpact()
    return () => { cancelled = true }
  }, [loadAttempt])


  async function handleSaveProfile() {
    if (profileSaving || profileLoadError || impactLoading) return
    setProfileSaving(true)
    setProfileError(null)
    try {
      const saved = await api.put<{ name: string; phone?: string; bio?: string }>('/profile', { ...(name.trim() !== savedName ? { name: name.trim() } : {}), phone: phone.trim(), bio: bio.trim(), automatedReviewConsent })
      if (!live.current) return
      setName(saved.name)
      setSavedName(saved.name)
      setPhone(saved.phone ?? '')
      setBio(saved.bio ?? '')
      updateName(saved.name)
      setProfileSnack(true)
    } catch (err) {
      if (live.current) setProfileError(err instanceof Error ? err.message : 'Failed to save profile.')
    } finally {
      if (live.current) setProfileSaving(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError('')
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    if (!currentPassword) { setPasswordError('Current password is required.'); return }
    setPasswordSaving(true)
    try {
      // The API rotates authVersion, so the old tokens stop working at once.
      // Keep this device signed in with the fresh pair it returns.
      const result = await api.put<{ tokens?: AuthTokens }>('/auth/change-password', { currentPassword, newPassword })
      if (result?.tokens && user) replaceTokens(result.tokens, user.id)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setPasswordSnack(true)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Current password is incorrect')
    } finally {
      setPasswordSaving(false)
    }
  }

  // /profile is sign-in only; only organizations have a public page to share.
  const publicProfilePath = user?.role === 'organization' && user.id ? `/organizations/${user.id}` : null
  async function handleShare() {
    if (!publicProfilePath) return
    try {
      await navigator.clipboard.writeText(new URL(publicProfilePath, window.location.origin).href)
      setShareSnack(true)
    } catch { /* Clipboard unavailable: nothing was copied, so no confirmation. */ }
  }

  if (impactLoading) return <AccountPageSkeleton layout="cards" />
  if (profileLoadError) return <Box sx={{ p: 4 }}><EmptyState variant="error" title="Your profile couldn’t load" description="Please retry to view or edit your saved details." action={<Button onClick={() => { setImpactLoading(true); setLoadAttempt(value => value + 1) }}>Retry</Button>} /></Box>

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 6 }}>
      <Container maxWidth="md" sx={{ pt: 3 }}>
        <Box sx={{ height: { xs: 160, sm: 240 }, position: 'relative', overflow: 'hidden', borderRadius: SHAPE.card, bgcolor: 'background.paper', backgroundImage: 'radial-gradient(ellipse at 80% 20%, rgba(199,162,74,0.22), transparent 65%)', boxShadow: 'var(--neu-inset)', border: 'var(--neu-border)' }}>
          <ProfileArtwork variant="cover" />
          {images.coverUrl && failedCover !== images.coverUrl && <Box component="img" src={images.coverUrl} alt="Your profile cover" onError={() => setFailedCover(images.coverUrl)} sx={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover' }} />}
          <Button startIcon={<PhotoCameraRoundedIcon />} onClick={() => setImageEditor('coverUrl')} sx={{ position: 'absolute', bottom: 16, right: 16, bgcolor: 'background.paper', color: 'text.primary', boxShadow: 'var(--neu-subtle)', '&:hover': { bgcolor: 'background.paper' } }}>Change cover</Button>
        </Box>
      </Container>
      {imageEditor && <ProfileImageEditor kind={imageEditor} currentUrl={images[imageEditor]} onClose={() => setImageEditor(null)} onSaved={url => { setImages(current => ({ ...current, [imageEditor]: url })); setFailedCover(''); setImageEditor(null); setProfileSnack(true) }} />}
      {/* Profile identity */}
      <Box data-profile-header sx={{ bgcolor: 'background.default', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider',
        '[data-skin="glassmorphism"] &': { backgroundImage: 'radial-gradient(ellipse at 85% 50%, rgba(199,162,74,0.20), transparent 55%), radial-gradient(ellipse at 5% 10%, rgba(87,126,98,0.15), transparent 55%)' }, pt: { xs: 3, md: 5 }, pb: { xs: 4, md: 5 } }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: { xs: 3, md: 4 } }}>
            <Typography sx={{ fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'text.primary' }}>
              Your community profile
            </Typography>
            {publicProfilePath && <Tooltip title="Copy public profile link">
              <IconButton aria-label="Copy public profile link" onClick={() => void handleShare()} sx={{ width: 40, height: 40, borderRadius: SHAPE.sm,
                color: 'text.primary', bgcolor: 'var(--neu-surface)', border: 'var(--neu-border)', boxShadow: 'var(--neu-subtle) !important', backdropFilter: 'var(--neu-backdrop)',
                '&:hover': { bgcolor: 'action.hover', boxShadow: 'var(--neu-raised-hover) !important' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}>
                <ShareRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 240px' }, gap: { xs: 3, md: 4 }, alignItems: 'stretch' }}>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 2.5 }}>
                <Avatar src={images.avatarUrl} alt={user?.name ?? 'Profile'} sx={{ width: { xs: 72, sm: 88 }, height: { xs: 72, sm: 88 }, borderRadius: SHAPE.card,
                  bgcolor: 'secondary.main', color: 'secondary.contrastText', fontSize: { xs: '1.6rem', sm: '2rem' }, fontWeight: 800,
                  border: 'var(--neu-border)', boxShadow: 'var(--neu-subtle)', flexShrink: 0 }}>
                  <ProfileArtwork />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h1" sx={{ fontWeight: 700, fontSize: { xs: '1.7rem', sm: '2.2rem' }, lineHeight: 1.12,
                    letterSpacing: '-0.035em', overflowWrap: 'anywhere', color: 'text.primary' }}>
                    {organizationName || savedName || 'Your profile'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.25, color: 'text.secondary' }}>
                    <LocationOnRoundedIcon sx={{ fontSize: 16 }} />
                    <Typography sx={{ fontSize: '0.82rem' }}>{country}</Typography>
                  </Box>
                </Box>
              </Box>
              {organizationName && <Typography color="text.secondary">Managed by {savedName}</Typography>}
              <Typography sx={{ maxWidth: 500, color: 'text.secondary', fontSize: '0.92rem', lineHeight: 1.75, overflowWrap: 'anywhere' }}>{bio}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mt: 3 }}>
                <Button startIcon={<PhotoCameraRoundedIcon />} onClick={() => setImageEditor('avatarUrl')}>Change profile image</Button>
                <Button startIcon={<EditRoundedIcon sx={{ fontSize: 18 }} />} onClick={() => {
                  setTab(0)
                  document.getElementById('profile-settings')?.scrollIntoView({ block: 'start', behavior: 'instant' })
                  window.requestAnimationFrame(() => document.getElementById('profile-full-name')?.focus({ preventScroll: true }))
                }} sx={{ px: 2.25, py: 1, borderRadius: SHAPE.sm, bgcolor: 'secondary.main', color: 'secondary.contrastText', boxShadow: 'var(--neu-subtle) !important',
                  border: 'var(--neu-border)', fontWeight: 700, textTransform: 'none',
                  '&:hover': { bgcolor: 'secondary.light', boxShadow: 'var(--neu-raised-hover) !important' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}>
                  Edit profile
                </Button>
              </Box>
            </Box>
            <Box sx={{ p: 2.5, bgcolor: 'var(--neu-surface)', border: 'var(--neu-border)', boxShadow: 'var(--neu-raised)', backdropFilter: 'var(--neu-backdrop)', WebkitBackdropFilter: 'var(--neu-backdrop)', borderRadius: SHAPE.card, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: SHAPE.sm, bgcolor: 'var(--neu-surface)', color: 'primary.main', boxShadow: 'var(--neu-inset)', mb: 2 }}>
                <ShieldOutlinedIcon sx={{ fontSize: 23 }} />
              </Box>
              <Typography component="h2" sx={{ fontWeight: 600, fontSize: '1rem', color: 'text.primary', mb: 0.75 }}>Build trust with your community</Typography>
              <Typography sx={{ fontSize: '0.8rem', lineHeight: 1.65, color: 'text.secondary', mb: 2.5 }}>Manage your identity verification and review your account status.</Typography>
              <Button component={RouterLink} to="/kyc" endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{ mt: 'auto', p: 0, minHeight: 32, minWidth: 0, fontSize: '0.8rem', fontWeight: 700, textTransform: 'none',
                  bgcolor: 'transparent', color: 'text.primary', border: 0, borderRadius: SHAPE.sm, boxShadow: 'none !important',
                  '&:hover': { bgcolor: 'transparent', color: 'text.primary', boxShadow: 'none !important', textDecoration: 'underline' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 4 } }}>
                View verification
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ mt: 3, position: 'relative' }}>
        {/* ═══ Stats Grid ═══ */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={<VolunteerActivismRoundedIcon />} value={formatDonated(impact.donatedByCurrency)} label="Total Donated" color="#2E3D2F" delay={0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={<FavoriteRoundedIcon />} value={String(impact.donationCount)} label="Donations" color="#C75B39" delay={0.08} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={<CampaignRoundedIcon />} value={String(impact.campaignsSupported)} label="Campaigns Supported" color="#C7A24A" delay={0.16} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={<EmojiEventsRoundedIcon />} value={String(impact.campaignsCreated)} label="Campaigns Created" color="#6A1B9A" delay={0.24} />
          </Grid>
        </Grid>

        {/* ═══ Recent Donations ═══ */}
        <Card
          elevation={0}
          sx={{
            boxShadow: 'var(--neu-raised)',
            borderRadius: SHAPE.card,
            mb: 3,
            animation: `${fadeIn} 0.5s ease 0.45s both`,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VolunteerActivismRoundedIcon sx={{ color: '#C75B39' }} />
                <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Recent Donations</Typography>
              </Box>
              <Button
                component={RouterLink}
                to="/donations"
                size="small"
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.82rem' }}
              >
                View All
              </Button>
            </Box>
            {impact.recentDonations.map((d, i) => (
              <Box key={i}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1.5,
                    animation: `${fadeIn} 0.3s ease ${0.5 + i * 0.05}s both`,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{d.campaign}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{d.date}</Typography>
                  </Box>
                  <Chip
                    label={`${d.currency} ${d.amount}`}
                    size="small"
                    sx={{ fontWeight: 700, bgcolor: 'rgba(46, 61, 47,0.08)', color: 'primary.dark' }}
                  />
                </Box>
                {i < impact.recentDonations.length - 1 && <Divider />}
              </Box>
            ))}
          </CardContent>
        </Card>

        <Button component={RouterLink} to="/organization-team" startIcon={<PeopleRoundedIcon />} sx={{ mb: 3 }}>Organization workspace & team</Button>
        {/* ═══ Settings Tabs ═══ */}
        <Card
          elevation={0}
          sx={{
            boxShadow: 'var(--neu-raised)',
            borderRadius: SHAPE.card,
            animation: `${fadeIn} 0.5s ease 0.5s both`,
          }}
        >
          <Tabs
            id="profile-settings"
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              px: 2,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.9rem' },
              '& .Mui-selected': { color: 'primary.main' },
            }}
          >
            <Tab label="Edit Profile" />
            <Tab label="Change Password" />
            <Tab label="Verification" />
          </Tabs>

          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            {/* Edit Profile */}
            <TabPanel value={tab} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: '100%' }}>
                {profileError && <><Alert severity="error">{profileError}</Alert><PublicationReviews /></>}
                <TextField id="profile-full-name" label={organizationName ? 'Contact person' : 'Full Name'} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                <TextField label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
                <Box>
                  <TextField label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} multiline rows={3} fullWidth placeholder="Tell us about yourself..." />
                </Box>
                <TextField label="Country" value={country} placeholder="Not provided" fullWidth disabled />
                <Typography variant="body2">Account names and images can appear with public contributions even if the profile page is private. Phone numbers and this biography are excluded from safety screening.</Typography>
                <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  sx={{ alignSelf: 'flex-start', borderRadius: SHAPE.sm, px: 4, fontWeight: 700, textTransform: 'none' }}
                >
                  {profileSaving ? <><LoadingDots size={6} /> <span>Saving...</span></> : 'Save Changes'}
                </Button>
              </Box>
            </TabPanel>

            {/* Change Password */}
            <TabPanel value={tab} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: '100%' }}>
                {passwordError && <Alert severity="error">{passwordError}</Alert>}
                <TextField label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} fullWidth />
                <Box>
                  <TextField label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} fullWidth helperText="Minimum 8 characters" />
                  <PasswordStrength value={newPassword} />
                </Box>
                <TextField
                  label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} fullWidth
                  error={confirmPassword.length > 0 && confirmPassword !== newPassword}
                  helperText={confirmPassword.length > 0 && confirmPassword !== newPassword ? 'Passwords do not match' : ''}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleChangePassword}
                  disabled={passwordSaving}
                  sx={{ alignSelf: 'flex-start', borderRadius: SHAPE.sm, px: 4, fontWeight: 700, textTransform: 'none' }}
                >
                  {passwordSaving ? <><LoadingDots size={6} /> <span>Updating...</span></> : 'Update Password'}
                </Button>
              </Box>
            </TabPanel>

            {/* KYC Status */}
            <TabPanel value={tab} index={2}>
              <KYCStatus role={user?.role} />
            </TabPanel>
          </Box>
        </Card>
      </Container>

      <Snackbar open={profileSnack} autoHideDuration={3000} onClose={() => setProfileSnack(false)}>
        <Alert onClose={() => setProfileSnack(false)} severity="success" variant="filled">Profile updated!</Alert>
      </Snackbar>
      <Snackbar open={passwordSnack} autoHideDuration={3000} onClose={() => setPasswordSnack(false)}>
        <Alert onClose={() => setPasswordSnack(false)} severity="success" variant="filled">Password changed!</Alert>
      </Snackbar>
      <Snackbar open={shareSnack} autoHideDuration={2000} onClose={() => setShareSnack(false)}>
        <Alert onClose={() => setShareSnack(false)} severity="info" variant="filled">Profile link copied!</Alert>
      </Snackbar>
    </Box>
  )
}
