import { LoadingDots } from '@ubuntu-fund/ui'
import { ProfileArtwork } from '@/components/profile/ProfileArtwork'
import { ProfileImageEditor } from '@/components/profile/ProfileImageEditor'
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded'
import { useState, useEffect } from 'react'
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
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import { keyframes } from '@mui/material/styles'
import { SHAPE, EmptyState } from '@ubuntu-fund/ui'
import { CampaignCategory } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
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

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  medical: <LocalHospitalRoundedIcon sx={{ fontSize: 14 }} />,
  education: <SchoolRoundedIcon sx={{ fontSize: 14 }} />,
  emergency: <WarningAmberRoundedIcon sx={{ fontSize: 14 }} />,
  business: <BusinessCenterRoundedIcon sx={{ fontSize: 14 }} />,
  community: <GroupsRoundedIcon sx={{ fontSize: 14 }} />,
  religious: <AccountBalanceRoundedIcon sx={{ fontSize: 14 }} />,
  creative: <PaletteRoundedIcon sx={{ fontSize: 14 }} />,
}

interface ProfileImpact {
  totalDonated: number
  donationCount: number
  campaignsSupported: number
  campaignsCreated: number
  streak: number
  rank: number
  followers: number
  following: number
  bookmarks: number
  topCategories: CampaignCategory[]
  interestedCategories: CampaignCategory[]
  recentDonations: Array<{ campaign: string; amount: number; currency: string; date: string }>
  badges: Array<{ icon: string; label: string; desc: string }>
}

const DEFAULT_IMPACT: ProfileImpact = {
  totalDonated: 0,
  donationCount: 0,
  campaignsSupported: 0,
  campaignsCreated: 0,
  streak: 0,
  rank: 0,
  followers: 0,
  following: 0,
  bookmarks: 0,
  topCategories: [],
  interestedCategories: [],
  recentDonations: [],
  badges: [],
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
  const { user, updateName } = useAuth()
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

  // Interests state
  const [interests, setInterests] = useState<CampaignCategory[]>([])

  // Fetch profile impact data
  useEffect(() => {
    let cancelled = false
    async function fetchImpact() {
      setImpactLoading(true)
      try {
        const [profileResult, analyticsResult] = await Promise.allSettled([
          api.get<Partial<ProfileImpact> & { name?: string; organizationName?: string; phone?: string; bio?: string; country?: string; avatarUrl?: string; coverUrl?: string }>('/profile'),
          api.get<Partial<ProfileImpact>>('/analytics/overview'),
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
          const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : {}
          const merged: ProfileImpact = { ...DEFAULT_IMPACT, ...profile, ...analytics }
          setImpact(merged)
          setInterests(merged.interestedCategories ?? [])
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
      const saved = await api.put<{ name: string; phone?: string; bio?: string }>('/profile', { name: name.trim(), phone: phone.trim(), bio: bio.trim() })
      setName(saved.name)
      setSavedName(saved.name)
      setPhone(saved.phone ?? '')
      setBio(saved.bio ?? '')
      updateName(saved.name)
      setProfileSnack(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleChangePassword() {
    setPasswordError('')
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    if (!currentPassword) { setPasswordError('Current password is required.'); return }
    setPasswordSaving(true)
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setPasswordSnack(true)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Current password is incorrect')
    } finally {
      setPasswordSaving(false)
    }
  }

  function toggleInterest(cat: CampaignCategory) {
    setInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    setShareSnack(true)
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
            <Tooltip title="Copy profile link">
              <IconButton aria-label="Copy profile link" onClick={handleShare} sx={{ width: 40, height: 40, borderRadius: SHAPE.sm,
                color: 'text.primary', bgcolor: 'var(--neu-surface)', border: 'var(--neu-border)', boxShadow: 'var(--neu-subtle) !important', backdropFilter: 'var(--neu-backdrop)',
                '&:hover': { bgcolor: 'action.hover', boxShadow: 'var(--neu-raised-hover) !important' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}>
                <ShareRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
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
                {!impactLoading && impact.streak > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.primary' }}>
                    <LocalFireDepartmentRoundedIcon sx={{ fontSize: 19 }} />
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 500 }}>{impact.streak}-month giving streak</Typography>
                  </Box>
                )}
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
            <StatCard icon={<VolunteerActivismRoundedIcon />} value={`$${impact.totalDonated.toLocaleString()}`} label="Total Donated" color="#2E3D2F" delay={0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={<FavoriteRoundedIcon />} value={String(impact.donationCount)} label="Donations" color="#C75B39" delay={0.08} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={<CampaignRoundedIcon />} value={String(impact.campaignsSupported)} label="Campaigns" color="#C7A24A" delay={0.16} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={<EmojiEventsRoundedIcon />} value={`#${impact.rank}`} label="Leaderboard" color="#6A1B9A" delay={0.24} />
          </Grid>
        </Grid>

        {/* ═══ Social Stats Row ═══ */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
            mb: 4,
            animation: `${fadeIn} 0.5s ease 0.3s both`,
          }}
        >
          {[
            { icon: <PeopleRoundedIcon sx={{ fontSize: 18 }} />, count: impact.followers, label: 'Followers' },
            { icon: <PeopleRoundedIcon sx={{ fontSize: 18 }} />, count: impact.following, label: 'Following' },
            { icon: <BookmarkRoundedIcon sx={{ fontSize: 18 }} />, count: impact.bookmarks, label: 'Bookmarks' },
          ].map((s) => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center', color: 'text.secondary' }}>
                {s.icon}
                <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: 'text.primary' }}>{s.count}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* ═══ Badges Section ═══ */}
        <Card
          elevation={0}
          sx={{
            boxShadow: 'var(--neu-raised)',
            borderRadius: SHAPE.card,
            mb: 3,
            animation: `${fadeIn} 0.5s ease 0.35s both`,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <StarRoundedIcon sx={{ color: '#C7A24A' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Achievement Badges</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {impact.badges.map((badge, i) => (
                <Tooltip key={badge.label} title={badge.desc} arrow>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.8,
                      px: 2,
                      py: 1,
                      borderRadius: SHAPE.sm,
                      bgcolor: 'rgba(199, 162, 74,0.06)',
                      border: '1px solid rgba(199, 162, 74,0.15)',
                      animation: `${fadeIn} 0.3s ease ${0.4 + i * 0.06}s both`,
                      transition: 'all 0.2s ease',
                      cursor: 'default',
                      '&:hover': {
                        bgcolor: 'rgba(199, 162, 74,0.12)',
                        borderColor: 'rgba(199, 162, 74,0.3)',
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: '1.2rem' }}>{badge.icon}</Typography>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{badge.label}</Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* ═══ Interested Categories ═══ */}
        <Card
          elevation={0}
          sx={{
            boxShadow: 'var(--neu-raised)',
            borderRadius: SHAPE.card,
            mb: 3,
            animation: `${fadeIn} 0.5s ease 0.4s both`,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <TrendingUpRoundedIcon sx={{ color: 'var(--text-brand)' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Interested Categories</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2 }}>
              Select categories to personalize your campaign feed
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {Object.values(CampaignCategory).map((cat) => {
                const active = interests.includes(cat)
                return (
                  <Chip
                    key={cat}
                    label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{CATEGORY_ICONS[cat] ?? null} {cat.charAt(0).toUpperCase() + cat.slice(1)}</Box>}
                    onClick={() => toggleInterest(cat)}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      borderRadius: SHAPE.sm,
                      bgcolor: active ? 'primary.main' : 'rgba(0,0,0,0.04)',
                      color: active ? '#fff' : 'text.primary',
                      border: '1px solid',
                      borderColor: active ? 'primary.main' : 'rgba(0,0,0,0.08)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: active ? 'primary.dark' : 'rgba(0,0,0,0.08)',
                      },
                    }}
                  />
                )
              })}
            </Box>
          </CardContent>
        </Card>

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
                {profileError && <Alert severity="error">{profileError}</Alert>}
                <TextField id="profile-full-name" label={organizationName ? 'Contact person' : 'Full Name'} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                <TextField label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
                <Box>
                  <TextField label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} multiline rows={3} fullWidth placeholder="Tell us about yourself..." />
                </Box>
                <TextField label="Country" value={country} placeholder="Not provided" fullWidth disabled />
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
              <KYCStatus />
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
