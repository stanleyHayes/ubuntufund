import ProductIllustration from '../ProductIllustration'
import HomeWatermark from '../art/HomeWatermark'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import DashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import type { SvgIconComponent } from '@mui/icons-material'
import { SHAPE } from '@ubuntu-fund/ui'

interface Feature {
  icon: SvgIconComponent
  title: string
  detail: string
}

const features: Feature[] = [
  { icon: DashboardRoundedIcon, title: 'Team dashboard', detail: 'A dedicated organization workspace with roles for your whole team.' },
  { icon: GroupsRoundedIcon, title: 'Collaboration', detail: 'Invite team members into accountable campaign workflows.' },
  { icon: InsightsRoundedIcon, title: 'Campaign progress', detail: 'See goals, totals, donations, updates, and comments from real records.' },
  { icon: ReceiptLongRoundedIcon, title: 'Transaction history', detail: 'Review dated wallet and donation activity in one workspace.' },
  { icon: CampaignRoundedIcon, title: 'Campaign operations', detail: 'Create, submit, update, and monitor organization campaigns.' },
  { icon: VerifiedRoundedIcon, title: 'Trust review', detail: 'Submit organization details and documents for administrative review.' },
  { icon: SupportAgentRoundedIcon, title: 'Human support', detail: 'Get help with verification, access, and controlled disbursement.' },
]

const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:8200'

function OrganizationsSection() {
  return (
    <Box
      id="organizations"
      sx={{
        position: 'relative', overflow: 'hidden', py: { xs: 8, md: 10 },
        background: 'linear-gradient(160deg, #1C261D 0%, #2E3D2F 100%)',
        '--neu-surface': '#233126',
        '--neu-raised': 'var(--forest-raised)',
        '--neu-raised-hover': 'var(--forest-raised-hover)',
        '--neu-subtle': 'var(--forest-subtle)',
        '--neu-inset': 'var(--forest-inset)',
        color: '#fff',
      }}
    >
      <HomeWatermark variant="leaf" />
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography
              variant="overline"
              sx={{ color: 'secondary.main', fontWeight: 700, letterSpacing: '0.2em' }}
            >
              For organizations
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 700,
                mt: 1.5,
                mb: 2,
                color: '#fff',
                fontSize: { xs: '1.9rem', md: '2.4rem' },
                lineHeight: 1.15,
              }}
            >
              Everything a serious cause needs to scale
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'rgba(255,255,255,0.78)', mb: 4, lineHeight: 1.7, maxWidth: 460 }}
            >
              Whether you are an NGO, hospital, school, or religious institution,
              Ujimora gives you the tools to grow your fundraising and build
              lasting donor relationships across Ghana.
            </Typography>
            <Box component="figure" sx={{ m: 0, mb: 4 }}>
              <Box component="img" className="home-art-image" src="/images/home/community-learning.jpg"
                alt="Illustration of a Ghanaian team arranging books and learning supplies together"
                width={1536} height={1024} loading="lazy" decoding="async" sx={{ width: '100%', height: 'auto' }} />
              <Typography component="figcaption" sx={{ mt: 1.5, fontSize: '.75rem', color: '#B5C9BA' }}>
                A shared purpose starts with people.
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              href={`${WEB_APP_URL}/register`}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700, borderRadius: '999px' }}
            >
              Get started for organizations
            </Button>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Box sx={{ mb: 4 }}><ProductIllustration screen="create" caption="A guided start for your next cause" dark /></Box>
            <Grid container spacing={2}>
              {features.map(({ icon: Icon, title, detail }) => (
                <Grid key={title} size={{ xs: 12, sm: 6 }}>
                  <Box
                    sx={{
                      height: '100%',
                      p: 2.5,
                      borderRadius: SHAPE.card,
                      backgroundColor: 'var(--neu-surface)',
                      boxShadow: 'var(--neu-raised)',
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 'var(--neu-raised-hover)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
                      <Box
                        aria-hidden
                        sx={{
                          width: 34,
                          height: 34,
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          color: '#DCC07E',
                          backgroundColor: 'var(--neu-surface)',
                          boxShadow: 'var(--neu-subtle)',
                          borderRadius: 'var(--shape-card)',
                        }}
                      >
                        <Icon sx={{ fontSize: 19 }} />
                      </Box>
                      <Typography
                        sx={{ fontWeight: 700, fontSize: '1rem', color: '#fff', lineHeight: 1.2 }}
                      >
                        {title}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ color: 'rgba(255,255,255,0.66)', fontSize: '0.86rem', lineHeight: 1.55 }}
                    >
                      {detail}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}

export default OrganizationsSection
