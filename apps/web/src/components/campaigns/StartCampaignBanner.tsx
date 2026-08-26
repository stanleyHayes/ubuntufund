import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'

export function StartCampaignBanner() {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        '--neu-surface': '#243126',
        '--neu-raised': '7px 7px 16px rgba(0,0,0,0.46), -7px -7px 16px rgba(91,117,98,0.16)',
        '--neu-raised-hover': '10px 10px 22px rgba(0,0,0,0.5), -9px -9px 20px rgba(91,117,98,0.18)',
        '--neu-subtle': '4px 4px 10px rgba(0,0,0,0.42), -4px -4px 10px rgba(91,117,98,0.14)',
        '--neu-inset': 'inset 3px 3px 8px rgba(0,0,0,0.44), inset -3px -3px 8px rgba(91,117,98,0.14)',
        background: 'linear-gradient(135deg, #2E3D2F 0%, #1C261D 100%)',
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
              bgcolor: 'var(--neu-surface)',
              boxShadow: 'var(--neu-subtle)',
            }}
          >
            <LightbulbRoundedIcon
              sx={{
                fontSize: 40,
                color: '#DCC07E',
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
                bgcolor: '#C7A24A',
                color: '#221B0E',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                borderRadius: SHAPE.sm,
                textTransform: 'none',
                fontSize: '1rem',
                transition: 'background-color 0.2s ease',
                '&:hover': {
                  bgcolor: '#A07E33',
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
