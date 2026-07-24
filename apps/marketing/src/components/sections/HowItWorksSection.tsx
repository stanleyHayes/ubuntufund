import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import { SHAPE } from '@ubuntu-fund/ui'

const steps = [
  {
    icon: <CampaignRoundedIcon sx={{ fontSize: 28 }} />,
    step: '01',
    title: 'Create your campaign',
    description:
      'Set up your fundraiser in minutes. Add your story, set a goal in cedis, and get verified through our trust system.',
  },
  {
    icon: <ShareRoundedIcon sx={{ fontSize: 28 }} />,
    step: '02',
    title: 'Share with your network',
    description:
      'Spread the word across Ghana and the diaspora. Share on WhatsApp, social media, and email to reach supporters at home and abroad.',
  },
  {
    icon: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 28 }} />,
    step: '03',
    title: 'Receive your funds',
    description:
      'Get donations directly via MTN MoMo, Telecel Cash, AT Money, bank transfer, or card. Funds are released securely with full transparency and tracking.',
  },
]

function HowItWorksSection() {
  return (
    <Box
      id="how-it-works"
      sx={{
        py: { xs: 8, md: 10 },
        backgroundColor: '#F2EFEA',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 } }}>
          <Typography variant="overline" sx={{ color: '#A07E33' }}>
            Simple process
          </Typography>
          <Typography
            variant="h2"
            sx={{
              mt: 1,
              mb: 2,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            How it works
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 640, mx: 'auto' }}>
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
                  backgroundColor: '#fff',
                  border: '1px solid #E7E3D8',
                  borderRadius: SHAPE.card,
                }}
              >
                <Typography variant="overline" sx={{ color: '#A07E33', display: 'block', mb: 2 }}>
                  Step {step.step}
                </Typography>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                    borderRadius: SHAPE.sm,
                    backgroundColor: 'rgba(168, 181, 160, 0.18)',
                    color: 'primary.main',
                  }}
                >
                  {step.icon}
                </Box>
                <Typography variant="h5" sx={{ mb: 1.5 }}>
                  {step.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                  {step.description}
                </Typography>

                {index < steps.length - 1 && (
                  <Box
                    component="svg"
                    viewBox="0 0 40 40"
                    aria-hidden="true"
                    sx={{
                      display: { xs: 'none', md: 'block' },
                      position: 'absolute',
                      right: -30,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 26,
                      height: 26,
                      zIndex: 2,
                    }}
                  >
                    <rect
                      x={4}
                      y={4}
                      width={32}
                      height={32}
                      rx={index % 2 === 0 ? 4 : 14}
                      transform="rotate(45 20 20)"
                      fill="none"
                      stroke={index % 2 === 0 ? '#C7A24A' : '#A8B5A0'}
                      strokeWidth={2.5}
                      opacity={0.7}
                    />
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
