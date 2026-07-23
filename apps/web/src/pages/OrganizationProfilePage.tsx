import { useState, useEffect } from 'react'
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import { keyframes } from '@mui/material/styles'
import { CurrencyDisplay, ProgressBar, EmptyState, ItemNotFound, SHAPE } from '@ubuntu-fund/ui'
import { CampaignCategory } from '@ubuntu-fund/types'
import type { Campaign } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { CampaignCard } from '@/components/campaigns/CampaignCard'

interface Organization {
  id: string
  name: string
  slug: string
  description: string
  logoUrl: string
  coverUrl: string
  country: string
  city: string
  verified: boolean
  website?: string
  founded: number
  impactStatement: string
  campaignCount: number
  totalRaised: number
  currency: string
  followerCount: number
  categories?: CampaignCategory[]
}

// ─── Animations ─────────────────────────────────────────────

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

// ─── Helpers ────────────────────────────────────────────────

function formatCategory(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ')
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Component ──────────────────────────────────────────────

export function OrganizationProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [following, setFollowing] = useState(false)
  const [snackOpen, setSnackOpen] = useState(false)
  const [org, setOrg] = useState<Organization | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!slug) {
      const id = setTimeout(() => setIsLoading(false), 0)
      return () => clearTimeout(id)
    }
    let cancelled = false
    api.get<Organization>(`/organizations/${slug}`)
      .then((data) => {
        if (cancelled) return
        setOrg(data)
        return api.get<Campaign[]>(`/organizations/${data.id}/campaigns`)
      })
      .then((data) => {
        if (!cancelled && data) setCampaigns(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) { setOrg(null); setCampaigns([]) }
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  if (!slug || isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        {/* Hero skeleton */}
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: SHAPE.card, mb: 3 }} />
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
          <Skeleton variant="circular" width={72} height={72} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="40%" height={32} />
            <Skeleton width="25%" height={18} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 3, mb: 4 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" width={120} height={64} sx={{ borderRadius: SHAPE.card }} />
          ))}
        </Box>
        <Skeleton width="100%" height={16} sx={{ mb: 0.5 }} />
        <Skeleton width="85%" height={16} sx={{ mb: 0.5 }} />
        <Skeleton width="60%" height={16} />
      </Container>
    )
  }

  if (!org) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound
          itemType="Organization"
          onBack={() => navigate('/organizations')}
        />
      </Container>
    )
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    setSnackOpen(true)
  }

  return (
    <Box sx={{ animation: `${fadeIn} 0.5s ease-out` }}>
      {/* ─── Hero Section ──────────────────────────────────── */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 240, md: 340 },
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={org.coverUrl}
          alt={`${org.name} cover`}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.65) 100%)',
          }}
        />

        {/* Organization info overlaid on cover */}
        <Container
          maxWidth="lg"
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            pb: 3,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'flex-end' },
            gap: 2.5,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Avatar
            src={org.logoUrl}
            alt={org.name}
            sx={{
              width: { xs: 80, md: 100 },
              height: { xs: 80, md: 100 },
              border: '4px solid #fff',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              animation: `${fadeInUp} 0.6s ease-out`,
            }}
          />
          <Box sx={{ flex: 1, animation: `${fadeInUp} 0.6s ease-out 0.1s both` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 800, color: '#fff' }}
              >
                {org.name}
              </Typography>
              {org.verified && (
                <VerifiedRoundedIcon sx={{ color: '#4FC3F7', fontSize: 28 }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationOnRoundedIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  {org.city}, {org.country}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarTodayRoundedIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Founded {org.founded}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* ─── Stats Row ─────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 2, md: 4 },
            mb: 4,
            flexWrap: 'wrap',
            animation: `${fadeInUp} 0.6s ease-out 0.2s both`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CampaignRoundedIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {org.campaignCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Campaigns
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FavoriteRoundedIcon sx={{ color: 'error.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              <CurrencyDisplay
                amount={org.totalRaised}
                currency={org.currency}
                variant="h6"
                sx={{ fontWeight: 700 }}
              />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Raised
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleRoundedIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {formatNumber(org.followerCount)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Followers
            </Typography>
          </Box>
        </Box>

        {/* ─── Action Buttons ────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            mb: 4,
            flexWrap: 'wrap',
            animation: `${fadeInUp} 0.6s ease-out 0.25s both`,
          }}
        >
          <Button
            variant={following ? 'outlined' : 'contained'}
            color="primary"
            startIcon={following ? <PersonRemoveRoundedIcon /> : <PersonAddRoundedIcon />}
            onClick={() => setFollowing((prev) => !prev)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {following ? 'Following' : 'Follow'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ShareRoundedIcon />}
            onClick={handleShare}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Share
          </Button>
          {org.website && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<LaunchRoundedIcon />}
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Website
            </Button>
          )}
        </Box>

        {/* ─── Impact Statement ──────────────────────────── */}
        <Card
          sx={{
            mb: 4,
            background: 'linear-gradient(135deg, rgba(46,125,50,0.06) 0%, rgba(249,168,37,0.06) 100%)',
            border: '1px solid',
            borderColor: 'rgba(46,125,50,0.15)',
            animation: `${fadeInUp} 0.6s ease-out 0.3s both`,
          }}
        >
          <CardContent sx={{ py: 3 }}>
            <Typography
              variant="overline"
              sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: 1.5, mb: 1, display: 'block' }}
            >
              Impact
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
              {org.impactStatement}
            </Typography>
          </CardContent>
        </Card>

        {/* ─── Description ───────────────────────────────── */}
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            mb: 4,
            lineHeight: 1.7,
            maxWidth: 720,
            animation: `${fadeInUp} 0.6s ease-out 0.35s both`,
          }}
        >
          {org.description}
        </Typography>

        {/* ─── Categories ────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            mb: 5,
            animation: `${fadeInUp} 0.6s ease-out 0.4s both`,
          }}
        >
          {org.categories?.map((cat) => (
            <Chip
              key={cat}
              label={formatCategory(cat)}
              variant="outlined"
              color="primary"
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Box>

        {/* ─── Campaigns ─────────────────────────────────── */}
        <Box sx={{ animation: `${fadeInUp} 0.6s ease-out 0.45s both` }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 3 }}>
            Campaigns
          </Typography>

          {campaigns.length === 0 ? (
            <EmptyState
              variant="empty"
              title="No campaigns yet"
              description="This organization hasn't created any campaigns."
            />
          ) : (
            <Grid container spacing={3}>
              {campaigns.map((campaign) => (
                <Grid key={campaign.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <CampaignCard campaign={campaign} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Container>

      {/* ─── Snackbar ──────────────────────────────────── */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
          Link copied to clipboard!
        </Alert>
      </Snackbar>
    </Box>
  )
}
