import { useState, useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Skeleton from '@mui/material/Skeleton'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import { keyframes } from '@mui/material/styles'
import { EmptyState, SHAPE } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

interface ApiOrg {
  id: string
  name: string
  email: string
  country: string
  verified: boolean
  avatarUrl?: string
  createdAt: string
}

interface Organization extends ApiOrg {
  campaignCount: number
  totalRaised: number
  currency: string
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

// ─── Component ──────────────────────────────────────────────

export function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [orgs, campaignsRes] = await Promise.all([
          api.get<ApiOrg[]>('/organizations'),
          api.get<{ items: Array<{ creatorId: string; raisedAmount: number; currency: string }> }>('/campaigns?pageSize=100'),
        ])
        const campaigns = Array.isArray(campaignsRes) ? campaignsRes : campaignsRes?.items ?? []
        const enriched: Organization[] = orgs.map((org) => {
          const orgCampaigns = campaigns.filter((c) => c.creatorId === org.id)
          return {
            ...org,
            campaignCount: orgCampaigns.length,
            totalRaised: orgCampaigns.reduce((sum, c) => sum + (c.raisedAmount || 0), 0),
            currency: orgCampaigns[0]?.currency ?? 'USD',
          }
        })
        setOrganizations(enriched)
      } catch {
        setOrganizations([])
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 6, animation: `${fadeInUp} 0.5s ease-out` }}>
        <Typography variant="h2" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
          Organizations
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto' }}>
          Discover trusted organizations driving impact across Africa. Follow their work and support their campaigns.
        </Typography>
      </Box>

      {isLoading ? (
        <Grid container spacing={3}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={320} sx={{ borderRadius: SHAPE.card }} />
            </Grid>
          ))}
        </Grid>
      ) : organizations.length === 0 ? (
        <EmptyState
          variant="search"
          title="No organizations found"
          description="Try a different search term."
        />
      ) : (
      <Grid container spacing={3}>
        {organizations.map((org, index) => (
          <Grid key={org.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: SHAPE.card,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                animation: `${fadeInUp} 0.5s ease-out ${index * 0.08}s both`,
                '&:hover': {
                  transform: 'translateY(-6px)',
                  borderColor: 'primary.light',
                  boxShadow: '0 20px 40px rgba(46,125,50,0.12), 0 8px 16px rgba(0,0,0,0.06)',
                },
              }}
            >
              {/* Cover strip */}
              <Box
                sx={{
                  height: 100,
                  background: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #1B5E20 100%)',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.35) 100%)',
                  }}
                />
              </Box>

              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pt: 0 }}>
                {/* Avatar overlapping cover */}
                <Avatar
                  src={org.avatarUrl}
                  alt={org.name}
                  sx={{
                    width: 60,
                    height: 60,
                    border: '3px solid #fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    mt: -3.5,
                    mb: 1.5,
                    bgcolor: 'primary.main',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                  }}
                >
                  {org.name.charAt(0)}
                </Avatar>

                {/* Name + verified */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    {org.name}
                  </Typography>
                  {org.verified && (
                    <VerifiedRoundedIcon sx={{ color: '#4FC3F7', fontSize: 20 }} />
                  )}
                </Box>

                {/* Location */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                  <LocationOnRoundedIcon sx={{ color: 'text.secondary', fontSize: 16 }} />
                  <Typography variant="caption" color="text.secondary">
                    {org.country}
                  </Typography>
                </Box>

                {/* Description */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  Verified organization with {org.campaignCount} active campaign{org.campaignCount !== 1 ? 's' : ''} on UbuntuFund.
                </Typography>

                {/* Spacer */}
                <Box sx={{ flexGrow: 1 }} />

                {/* Stats */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2.5,
                    mb: 2.5,
                    py: 1.5,
                    borderTop: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CampaignRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {org.campaignCount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      campaigns
                    </Typography>
                  </Box>
                  {org.totalRaised > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {org.currency} {org.totalRaised.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        raised
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* View Profile link */}
                <Button
                  component={RouterLink}
                  to={`/organizations/${org.id}`}
                  variant="outlined"
                  color="primary"
                  size="small"
                  fullWidth
                  sx={{
                    borderRadius: SHAPE.sm,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  View Profile
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      )}
    </Container>
  )
}
