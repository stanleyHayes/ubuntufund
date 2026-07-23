import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'

export interface StartCampaignBannerProps {}

export function StartCampaignBanner({}: StartCampaignBannerProps = {}) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        background: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)',
        py: { xs: 6, md: 8 },
        overflow: 'hidden',
      }}
    >
      {/* Decorative background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -50,
          left: -50,
          width: 250,
          height: 250,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.03)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 3,
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: SHAPE.card,
              bgcolor: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1.5px solid rgba(255,255,255,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
          >
            <LightbulbRoundedIcon
              sx={{
                fontSize: 40,
                color: '#FFD700',
              }}
            />
          </Box>

          {/* Title */}
          <Typography
            variant="h3"
            component="h2"
            sx={{
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.2,
              maxWidth: 600,
              textShadow: '0 2px 12px rgba(0,0,0,0.2)',
            }}
          >
            Have a Campaign Idea?
          </Typography>

          {/* Subtitle */}
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '1.05rem',
              maxWidth: 550,
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            Share your vision with our community. Start a campaign and mobilize support for causes that matter.
          </Typography>

          {/* Call-to-action button */}
          <Box sx={{ mt: 2 }}>
            <Button
              component={RouterLink}
              to="/campaigns/new"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                bgcolor: '#FFD700',
                color: '#2E7D32',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                borderRadius: SHAPE.sm,
                textTransform: 'none',
                fontSize: '1rem',
                boxShadow: '0 8px 24px rgba(255,215,0,0.3)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: '#FFC500',
                  boxShadow: '0 12px 32px rgba(255,215,0,0.4)',
                  transform: 'translateY(-2px)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              Start a Campaign
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
