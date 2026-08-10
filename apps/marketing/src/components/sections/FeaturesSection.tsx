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
import { SHAPE } from '@ubuntu-fund/ui'

const features = [
  {
    icon: VerifiedUserIcon,
    title: 'Trust system',
    description:
      'Multi-level verification builds confidence. Verified campaigns earn trust badges so donors give with certainty.',
    accent: '#2E3D2F',
  },
  {
    icon: CurrencyExchangeIcon,
    title: 'Cedi-first records',
    description:
      'Campaign goals, wallet balances, and donation records use Ghanaian cedis (GHS) throughout the product.',
    accent: '#C7A24A',
  },
  {
    icon: PaymentsIcon,
    title: 'Wallet contributions',
    description:
      'The internal UbuntuFund Wallet is the active launch method. External payment rails remain disabled until verified.',
    accent: '#2E3D2F',
  },
  {
    icon: LiveTvIcon,
    title: 'Live progress',
    description:
      'Follow campaign totals, goals, updates, supporter comments, and persisted donation activity as they change.',
    accent: '#C7A24A',
  },
  {
    icon: PublicIcon,
    title: 'Shareable campaigns',
    description:
      'Publish a clear campaign story and share its public page with supporters wherever your community is located.',
    accent: '#2E3D2F',
  },
  {
    icon: LockIcon,
    title: 'Accountable records',
    description:
      'Review workflows, audit trails, reporting, moderation, and soft deletion protect users without erasing operational history.',
    accent: '#C7A24A',
  },
]

function FeaturesSection() {
  return (
    <Box
      id="features"
      sx={{
        py: { xs: 8, md: 10 },
        backgroundColor: '#fff',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.dark' }}
          >
            Why UbuntuFund
          </Typography>
          <Typography
            variant="h2"
            sx={{
              mt: 1,
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            Built for Ghana, by Ghanaians
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 640, mx: 'auto' }}
          >
            Purpose-built features for how fundraising actually works in Ghana —
            at home and among Ghanaians abroad.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {features.map((feature) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.title}>
              <Card sx={{ height: '100%' }} elevation={0}>
                <CardContent sx={{ p: 3.5 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: SHAPE.sm,
                      backgroundColor: `${feature.accent}14`,
                      color: feature.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2.5,
                    }}
                  >
                    <feature.icon sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
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
