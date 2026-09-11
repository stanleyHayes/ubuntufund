import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded'
import { keyframes } from '@emotion/react'
import {
  ProgressBar,
  ErrorState,
  ItemNotFound,
  BrandLogo,
  SHAPE,
} from '@ubuntu-fund/ui'
import { breadcrumbList } from '@ubuntu-fund/ui'
import { CampaignStatus } from '@ubuntu-fund/types'
import {
  getCampaignBySlug,
  donatePath,
  type CampaignPublicView,
} from '@/lib/fundraising'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

/** Statuses a campaign page must never be indexed in — it is not public yet, or no longer is. */
const UNINDEXED_STATUSES: CampaignStatus[] = [
  CampaignStatus.DRAFT,
  CampaignStatus.PENDING_REVIEW,
  CampaignStatus.BLOCKED,
]

/** Collapse whitespace and trim to `max` characters at a word boundary. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:\u2014-]+$/, '')}\u2026`
}

/** Meta description built from the organizer's own story, topped up when it is very short. */
function campaignDescription(story: string): string {
  const blurb = clip(story || '', 155)
  if (blurb.length >= 100) return blurb
  return `${blurb ? `${blurb} ` : ''}Donate by mobile money or card on Ujimora.`
}

function looksLikeNotFound(message: string): boolean {
  return /not\s*found|404|no\s*such|does not exist/i.test(message)
}

// ---------------------------------------------------------------------------
// CampaignPublicPage — public landing for QR / social visitors (no auth)
// Route: /c/:slug
// ---------------------------------------------------------------------------

export function CampaignPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState<CampaignPublicView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    let active = true
    // Reset view state before each fetch — the standard reset-before-fetch
    // pattern. The React Compiler set-state-in-effect rule flags these synchronous
    // resets, but they're correct and intended here (no external store to sync to).
    /* eslint-disable react-hooks/set-state-in-effect */
    setIsLoading(true)
    setError(null)
    setNotFound(false)
    /* eslint-enable react-hooks/set-state-in-effect */

    getCampaignBySlug(slug)
      .then((data) => {
        if (!active) return
        setCampaign(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        const message = err instanceof Error ? err.message : 'Failed to load campaign'
        if (looksLikeNotFound(message)) {
          setNotFound(true)
        } else {
          setError(message)
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [slug])

  // This slug URL is the one public shape for a campaign: /campaigns/:id and
  // /c/:id resolve to the same fundraiser and canonicalise here, so the page
  // names itself off the campaign's own slug rather than whatever was typed.
  const shareImage = campaign?.socialPreview?.imageUrl ?? campaign?.imageUrls?.[0]
  useSeo({
    title: campaign ? `${clip(campaign.title, 46)} | Ujimora` : 'Support a campaign | Ujimora',
    description: campaign
      ? campaignDescription(campaign.socialPreview?.summary || campaign.description)
      : 'See what this Ghanaian fundraiser is raising for, how far along it is towards its cedi goal, and donate by mobile money or card — no account needed.',
    path: `/c/${encodeURIComponent(campaign?.slug || slug || '')}`,
    type: 'article',
    image: shareImage && /^https?:\/\//i.test(shareImage) ? shareImage : undefined,
    robots: campaign && UNINDEXED_STATUSES.includes(campaign.status) ? 'noindex, follow' : undefined,
    jsonLd: campaign
      ? breadcrumbList(SITE_ORIGIN, [
          { name: 'Home', path: '/' },
          { name: 'Explore', path: '/explore' },
          { name: campaign.title },
        ])
      : undefined,
  })

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
        <Skeleton variant="rectangular" height={260} sx={{ borderRadius: SHAPE.card, mb: 3 }} />
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Skeleton variant="rounded" width={90} height={28} />
          <Skeleton variant="rounded" width={64} height={28} />
        </Box>
        <Skeleton width="80%" height={40} sx={{ mb: 1.5 }} />
        <Skeleton width="100%" height={18} sx={{ mb: 0.5 }} />
        <Skeleton width="92%" height={18} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={12} sx={{ borderRadius: SHAPE.bar, mb: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Skeleton width="30%" height={18} />
          <Skeleton width="24%" height={18} />
        </Box>
        <Skeleton variant="rounded" height={48} sx={{ borderRadius: SHAPE.sm }} />
      </Container>
    )
  }

  if (notFound) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound
          itemType="Campaign"
          message="This fundraiser link may have expired, been removed, or been mistyped."
          onBack={() => navigate('/')}
          backLabel="Explore campaigns"
        />
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ErrorState
          title="Couldn't load this campaign"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </Container>
    )
  }

  if (!campaign) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound itemType="Campaign" onBack={() => navigate('/')} backLabel="Explore campaigns" />
      </Container>
    )
  }

  const heroImage = campaign.socialPreview?.imageUrl ?? campaign.imageUrls?.[0]
  const summary = campaign.socialPreview?.summary || campaign.description
  const isActive = campaign.status === CampaignStatus.ACTIVE
  const donorCount = campaign.donorCount ?? 0

  function handleDonate() {
    if (!slug) return
    navigate(donatePath(slug))
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      {/* Hero image */}
      {heroImage && (
        <Box
          component="img"
          src={heroImage}
          alt={campaign.title}
          sx={{
            width: '100%',
            height: { xs: 220, md: 300 },
            objectFit: 'cover',
            borderRadius: SHAPE.card,
            mb: 3,
            boxShadow: 'var(--neu-raised)',
            animation: `${fadeInUp} 0.45s ease both`,
          }}
        />
      )}

      {/* Category / priority */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 2, flexWrap: 'wrap', gap: 1, animation: `${fadeInUp} 0.45s 0.04s ease both` }}
      >
        <Chip label={formatCategory(campaign.category)} color="primary" variant="outlined" size="small" />
        {campaign.priority === 'critical' && <Chip label="Critical" color="error" size="small" />}
        {campaign.priority === 'urgent' && <Chip label="Urgent" color="warning" size="small" />}
      </Stack>

      {/* Title */}
      <Typography
        variant="h3"
        component="h1"
        sx={{
          fontWeight: 900,
          fontFamily: '"Outfit", sans-serif',
          mb: 1.5,
          lineHeight: 1.2,
          animation: `${fadeInUp} 0.45s 0.08s ease both`,
        }}
      >
        {campaign.title}
      </Typography>

      {/* Summary */}
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, whiteSpace: 'pre-line', animation: `${fadeInUp} 0.45s 0.12s ease both` }}
      >
        {summary}
      </Typography>

      {/* Progress */}
      <Box
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: SHAPE.card,
          boxShadow: 'var(--neu-raised)',
          bgcolor: 'background.paper',
          mb: 3,
          animation: `${fadeInUp} 0.45s 0.16s ease both`,
        }}
      >
        <ProgressBar current={campaign.raisedAmount} goal={campaign.goalAmount} currency="GHS" />
        {donorCount > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2, color: 'text.secondary' }}>
            <PeopleAltRoundedIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {donorCount.toLocaleString()} {donorCount === 1 ? 'donor' : 'donors'} so far
            </Typography>
          </Box>
        )}
      </Box>

      {/* Donate CTA */}
      <Button
        fullWidth
        size="large"
        variant="contained"
        color="secondary"
        startIcon={<FavoriteRoundedIcon />}
        onClick={handleDonate}
        disabled={!isActive}
        sx={{
          py: 1.5,
          fontSize: '1.05rem',
          fontWeight: 800,
          animation: `${fadeInUp} 0.45s 0.2s ease both`,
        }}
      >
        {isActive ? 'Donate now' : 'Donations closed'}
      </Button>

      {!isActive && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1.5 }}>
          This campaign isn't accepting donations right now.
        </Typography>
      )}

      {/* Trust + brand */}
      <Box
        sx={{
          mt: 4,
          pt: 3,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
          animation: `${fadeInUp} 0.45s 0.24s ease both`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
          <LockRoundedIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Secure donations · card & mobile money
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Powered by
          </Typography>
          <BrandLogo size={18} />
        </Box>
      </Box>
    </Container>
  )
}
