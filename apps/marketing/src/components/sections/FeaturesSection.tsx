import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange'
import PaymentsIcon from '@mui/icons-material/Payments'
import LiveTvIcon from '@mui/icons-material/LiveTv'
import PublicIcon from '@mui/icons-material/Public'
import LockIcon from '@mui/icons-material/Lock'

const features = [
  {
    icon: <VerifiedUserIcon sx={{ fontSize: 40 }} />,
    title: 'Trust System',
    description:
      'Multi-level verification builds confidence. Verified campaigns earn trust badges so donors give with certainty.',
    color: '#2E3D2F',
  },
  {
    icon: <CurrencyExchangeIcon sx={{ fontSize: 40 }} />,
    title: 'Multi-Currency',
    description:
      'Accept donations in USD, KES, NGN, ZAR, GHS, and more. Automatic conversion with transparent exchange rates.',
    color: '#A07E33',
  },
  {
    icon: <PaymentsIcon sx={{ fontSize: 40 }} />,
    title: 'Direct Payments',
    description:
      'M-Pesa, bank transfers, cards, and mobile money. Funds reach you through the channels that work in Africa.',
    color: '#1565C0',
  },
  {
    icon: <LiveTvIcon sx={{ fontSize: 40 }} />,
    title: 'Live Fundraising',
    description:
      'Host live fundraising events with real-time donation tracking, leaderboards, and audience engagement tools.',
    color: '#C62828',
  },
  {
    icon: <PublicIcon sx={{ fontSize: 40 }} />,
    title: 'Diaspora Mode',
    description:
      'Connect the African diaspora to causes back home. Localized experiences for supporters in Europe, Americas, and beyond.',
    color: '#6A1B9A',
  },
  {
    icon: <LockIcon sx={{ fontSize: 40 }} />,
    title: 'Escrow Protection',
    description:
      'Milestone-based fund release ensures accountability. Donors see exactly how their contributions are used.',
    color: '#00695C',
  },
]

function FeaturesSection() {
  return (
    <Box
      id="features"
      sx={{
        py: { xs: 8, md: 12 },
        backgroundColor: '#fff',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.main', fontWeight: 700, letterSpacing: 2, fontSize: '0.85rem' }}
          >
            Why UbuntuFund
          </Typography>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 700,
              mt: 1,
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            Built for Africa, by Africa
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto' }}
          >
            Purpose-built features that address the unique needs of fundraising
            across the African continent and its global diaspora.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {features.map((feature) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.title}>
              <Card
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: feature.color,
                    boxShadow: `0 8px 30px ${feature.color}20`,
                    transform: 'translateY(-4px)',
                  },
                }}
                elevation={0}
              >
                <CardContent sx={{ p: 3.5 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 2,
                      backgroundColor: `${feature.color}10`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2.5,
                      color: feature.color,
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default FeaturesSection
