import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import LinearProgress from '@mui/material/LinearProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import KYCStatus from '@/components/KYCStatus'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
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
import { TrustBadge, SHAPE, AiWritingBar } from '@ubuntu-fund/ui'
import { VerificationLevel, CampaignCategory, AiWritingAction } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Link as RouterLink } from 'react-router-dom'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
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
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: SHAPE.card,
        animation: `${fadeIn} 0.5s ease ${delay}s both`,
        transition: 'all 0.25s ease',
        '&:hover': {
          borderColor: color,
          boxShadow: `0 4px 20px ${color}20`,
          transform: 'translateY(-3px)',
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
  const [tab, setTab] = useState(0)
  const [impact, setImpact] = useState<ProfileImpact>(DEFAULT_IMPACT)
  const [impactLoading, setImpactLoading] = useState(true)

  // Edit Profile state
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState('+233 24 123 4567')
  const [bio, setBio] = useState('Passionate about education and community development across Africa. Believer in the power of collective giving.')
  const [country, setCountry] = useState('Ghana')
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
        const [profile, analytics] = await Promise.all([
          api.get<Partial<ProfileImpact>>('/profile'),
          api.get<Partial<ProfileImpact>>('/analytics/overview'),
        ])
        if (!cancelled) {
          const merged: ProfileImpact = { ...DEFAULT_IMPACT, ...profile, ...analytics }
          setImpact(merged)
          setInterests(merged.interestedCategories)
        }
      } catch {
        // On failure, keep defaults (zeros / empty arrays)
        if (!cancelled) {
          setImpact(DEFAULT_IMPACT)
        }
      } finally {
        if (!cancelled) setImpactLoading(false)
      }
    }
    fetchImpact()
    return () => { cancelled = true }
  }, [])

  const verificationLevel = VerificationLevel.EMAIL_PHONE
  const trustScore = 72

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?'

  async function handleSaveProfile() {
    if (profileSaving) return
    setProfileSaving(true)
    setProfileError(null)
    try {
      await api.put('/profile', { name, phone, bio, country })
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

  return (
    <Box sx={{ bgcolor: '#F2EFEA', minHeight: '100vh', pb: 6 }}>
      {/* ═══ Hero Section ═══ */}
      <Box
        sx={{
          position: 'relative',
          bgcolor: '#1C261D',
          pt: 5,
          pb: 12,
          overflow: 'hidden',
        }}
      >
        {/* Kente pattern overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.06,
            backgroundImage: 'none',
            pointerEvents: 'none',
          }}
        />
        {/* Subtle radial glow */}
        <Box
          sx={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 500,
            height: 500,
            borderRadius: '50%',
            bgcolor: 'rgba(199, 162, 74,0.06)',
            pointerEvents: 'none',
          }}
        />
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          {/* Avatar */}
          <Box sx={{ position: 'relative', display: 'inline-block', mb: 2, animation: `${fadeIn} 0.5s ease both` }}>
            <Avatar
              sx={{
                width: 110,
                height: 110,
                bgcolor: '#C7A24A',
                fontSize: '2.5rem',
                fontWeight: 900,
                border: '4px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                mx: 'auto',
              }}
            >
              {initials}
            </Avatar>
            {/* Trust score ring */}
            <Box
              sx={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: '#2E3D2F',
                border: '3px solid #1C261D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <Typography sx={{ color: '#fff', fontSize: '0.65rem', fontWeight: 900 }}>{trustScore}</Typography>
            </Box>
          </Box>

          {/* Name & Meta */}
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: '1.8rem',
              color: '#fff',
              mb: 0.5,
              animation: `${fadeIn} 0.5s ease 0.1s both`,
            }}
          >
            {user?.name ?? 'User'}
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '0.9rem',
              mb: 2,
              animation: `${fadeIn} 0.5s ease 0.15s both`,
            }}
          >
            {bio}
          </Typography>

          {/* Meta chips */}
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mb: 2, animation: `${fadeIn} 0.5s ease 0.2s both` }}>
            <Chip
              icon={<LocationOnRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.7) !important' }} />}
              label={country}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <Chip
              icon={<CalendarTodayRoundedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7) !important' }} />}
              label="Joined Mar 2026"
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <TrustBadge level={verificationLevel} />
            <Chip
              icon={<LocalFireDepartmentRoundedIcon sx={{ fontSize: 16, color: '#FF8F00 !important' }} />}
              label={`${impact.streak}-mo streak`}
              size="small"
              sx={{ bgcolor: 'rgba(199, 162, 74,0.15)', color: '#FFD54F', fontWeight: 700, border: '1px solid rgba(199, 162, 74,0.2)' }}
            />
            <Button
              component={RouterLink}
              to="/kyc"
              variant="outlined"
              size="small"
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)', borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
            >
              KYC Verification
            </Button>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', animation: `${fadeIn} 0.5s ease 0.25s both` }}>
            <Button
              variant="outlined"
              startIcon={<EditRoundedIcon />}
              onClick={() => setTab(0)}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.25)',
                borderRadius: SHAPE.sm,
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              Edit Profile
            </Button>
            <Tooltip title="Share profile">
              <IconButton
                onClick={handleShare}
                sx={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.3)' } }}
              >
                <ShareRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Container>

        {/* Bottom wave */}
        <svg style={{ position: 'absolute', bottom: -1, left: 0, width: '100%' }} viewBox="0 0 1440 60" preserveAspectRatio="none">
          <path d="M0,20 C240,60 480,0 720,30 C960,60 1200,0 1440,20 L1440,60 L0,60Z" fill="#F2EFEA" />
        </svg>
      </Box>

      <Container maxWidth="md" sx={{ mt: -6, position: 'relative', zIndex: 2 }}>
        {impactLoading && (
          <Box sx={{ mb: 4 }}>
            <LinearProgress sx={{ borderRadius: SHAPE.bar }} />
          </Box>
        )}
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
            border: '1px solid rgba(0,0,0,0.06)',
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
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#5D4037' }}>{badge.label}</Typography>
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
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: SHAPE.card,
            mb: 3,
            animation: `${fadeIn} 0.5s ease 0.4s both`,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <TrendingUpRoundedIcon sx={{ color: '#2E3D2F' }} />
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
            border: '1px solid rgba(0,0,0,0.06)',
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

        {/* ═══ Settings Tabs ═══ */}
        <Card
          elevation={0}
          sx={{
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: SHAPE.card,
            animation: `${fadeIn} 0.5s ease 0.5s both`,
          }}
        >
          <Tabs
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
                <TextField label="Full Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                <TextField label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
                <Box>
                  <Box sx={{ mb: 1 }}>
                    <AiWritingBar
                      value={bio}
                      onChange={setBio}
                      inputLabel="About Me"
                      allowedActions={[
                        AiWritingAction.FORMALIZE,
                        AiWritingAction.CASUAL,
                        AiWritingAction.FIX_GRAMMAR,
                        AiWritingAction.IMPROVE_CLARITY,
                      ]}
                    />
                  </Box>
                  <TextField label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} multiline rows={3} fullWidth placeholder="Tell us about yourself..." />
                </Box>
                <TextField label="Country" value={country} onChange={(e) => setCountry(e.target.value)} select fullWidth>
                  {['Ghana', 'Kenya', 'Nigeria', 'South Africa', 'Rwanda', 'Tanzania', 'Uganda', 'Ethiopia', 'Senegal', 'Cameroon'].map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  sx={{ alignSelf: 'flex-start', borderRadius: SHAPE.sm, px: 4, fontWeight: 700, textTransform: 'none', boxShadow: '0 2px 12px rgba(46, 61, 47,0.3)' }}
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </TabPanel>

            {/* Change Password */}
            <TabPanel value={tab} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: '100%' }}>
                {passwordError && <Alert severity="error">{passwordError}</Alert>}
                <TextField label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} fullWidth />
                <TextField label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} fullWidth helperText="Minimum 8 characters" />
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
                  {passwordSaving ? 'Updating...' : 'Update Password'}
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
