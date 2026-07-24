import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import CampaignIcon from '@mui/icons-material/Campaign'
import ShareIcon from '@mui/icons-material/Share'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

const steps = [
  {
    icon: <CampaignIcon sx={{ fontSize: 48 }} />,
    title: 'Create Your Campaign',
    description:
      'Set up your fundraiser in minutes. Add your story, set a goal, choose your currency, and get verified through our trust system.',
    step: '01',
  },
  {
    icon: <ShareIcon sx={{ fontSize: 48 }} />,
    title: 'Share With Your Network',
    description:
      'Spread the word across Africa and the diaspora. Share on social media, WhatsApp, and email to reach supporters worldwide.',
    step: '02',
  },
  {
    icon: <AccountBalanceWalletIcon sx={{ fontSize: 48 }} />,
    title: 'Receive Your Funds',
    description:
      'Get donations directly via M-Pesa, bank transfer, or card. Funds are released securely with full transparency and tracking.',
    step: '03',
  },
]

function HowItWorksSection() {
  return (
    <Box
      id="how-it-works"
      sx={{
        py: { xs: 8, md: 12 },
        backgroundColor: '#F2EFEA',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.main', fontWeight: 700, letterSpacing: 2, fontSize: '0.85rem' }}
          >
            Simple Process
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
            How It Works
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: 600, mx: 'auto' }}
          >
            Launch your campaign and start receiving support in three simple steps.
            Our platform handles the complexity so you can focus on your cause.
          </Typography>
        </Box>

        <Grid container spacing={4} alignItems="stretch">
          {steps.map((step, index) => (
            <Grid size={{ xs: 12, md: 4 }} key={step.step}>
              <Box
                sx={{
                  position: 'relative',
                  textAlign: 'center',
                  p: 4,
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: '#fff',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 8px 30px rgba(46, 61, 47, 0.1)',
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <Typography
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 20,
                    fontSize: '3rem',
                    fontWeight: 800,
                    color: 'rgba(46, 61, 47, 0.08)',
                    lineHeight: 1,
                  }}
                >
                  {step.step}
                </Typography>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(46, 61, 47, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                    color: 'primary.main',
                  }}
                >
                  {step.icon}
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                  {step.title}
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                  {step.description}
                </Typography>
                {index < steps.length - 1 && (
                  <Box
                    sx={{
                      display: { xs: 'none', md: 'flex' },
                      position: 'absolute',
                      right: -28,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 2,
                      color: 'primary.light',
                    }}
                  >
                    <ArrowForwardIcon sx={{ fontSize: 28 }} />
                  </Box>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )
}

export default HowItWorksSection
