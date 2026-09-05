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
        py: { xs: 8, md: 10 },
        background: 'linear-gradient(160deg, #1C261D 0%, #2E3D2F 100%)',
        '--neu-surface': '#233126',
        '--neu-raised': '8px 8px 18px rgba(8,14,10,0.48), -7px -7px 16px rgba(91,117,98,0.13)',
        '--neu-raised-hover': '11px 11px 22px rgba(8,14,10,0.52), -9px -9px 19px rgba(91,117,98,0.16)',
        '--neu-subtle': '4px 4px 10px rgba(8,14,10,0.44), -4px -4px 10px rgba(91,117,98,0.12)',
        '--neu-inset': 'inset 3px 3px 8px rgba(8,14,10,0.48), inset -3px -3px 8px rgba(91,117,98,0.14)',
        color: '#fff',
      }}
    >
      <Container maxWidth="lg">
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
                          borderRadius: '4px 12px 4px 12px',
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
