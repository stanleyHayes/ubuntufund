import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import DashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded'
import ApiRoundedIcon from '@mui/icons-material/ApiRounded'
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
  { icon: PaletteRoundedIcon, title: 'Branded pages', detail: 'Campaign pages that carry your logo, colours, and voice.' },
  { icon: InsightsRoundedIcon, title: 'Donor analytics', detail: 'See what moves your supporters and build lasting relationships.' },
  { icon: ReceiptLongRoundedIcon, title: 'Tax & compliance', detail: 'Automated receipts and reporting that keep you audit-ready.' },
  { icon: AutorenewRoundedIcon, title: 'Recurring giving', detail: 'Bulk processing and monthly plans for dependable funding.' },
  { icon: VerifiedRoundedIcon, title: 'Trust badges', detail: 'Priority verification and badges that signal credibility.' },
  { icon: ApiRoundedIcon, title: 'API access', detail: 'Integrate UbuntuFund with the systems you already run.' },
  { icon: SupportAgentRoundedIcon, title: 'Priority support', detail: 'A named account manager and a fast lane when you need help.' },
]

function OrganizationsSection() {
  return (
    <Box
      id="organizations"
      sx={{
        py: { xs: 8, md: 10 },
        background: 'linear-gradient(160deg, #1C261D 0%, #2E3D2F 100%)',
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
              UbuntuFund gives you the tools to grow your fundraising and build
              lasting donor relationships across Ghana.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              size="large"
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
                      backgroundColor: 'rgba(242,239,234,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      transition: 'border-color 160ms ease, background-color 160ms ease',
                      '&:hover': {
                        borderColor: 'rgba(199,162,74,0.5)',
                        backgroundColor: 'rgba(242,239,234,0.08)',
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
                          backgroundColor: 'rgba(199,162,74,0.14)',
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
