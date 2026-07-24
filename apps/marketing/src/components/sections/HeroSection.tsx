import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import FavoriteIcon from '@mui/icons-material/Favorite'

function HeroSection() {
  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: { xs: '100vh', md: '90vh' },
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(160deg, #1C261D 0%, #2E3D2F 100%)',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 20% 50%, rgba(199, 162, 74, 0.12) 0%, transparent 50%)',
        },
      }}
    >
      {/* Decorative circles */}
      <Box
        sx={{
          position: 'absolute',
          width: { xs: 300, md: 500 },
          height: { xs: 300, md: 500 },
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.08)',
          top: { xs: -100, md: -150 },
          right: { xs: -100, md: -100 },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: { xs: 200, md: 350 },
          height: { xs: 200, md: 350 },
          borderRadius: '50%',
          border: '1px solid rgba(199, 162, 74,0.15)',
          bottom: { xs: 50, md: 100 },
          left: { xs: -80, md: -50 },
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
            gap: { xs: 4, md: 8 },
            pt: { xs: 12, md: 4 },
          }}
        >
          {/* Text Content */}
          <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
            <Typography
              variant="overline"
              sx={{
                color: '#C7A24A',
                fontWeight: 700,
                letterSpacing: 3,
                fontSize: '0.85rem',
                mb: 2,
                display: 'block',
              }}
            >
              Ghana's Crowdfunding Platform
            </Typography>
            <Typography
              variant="h1"
              sx={{
                color: '#fff',
                fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
                fontWeight: 800,
                lineHeight: 1.1,
                mb: 3,
              }}
            >
              Together,{' '}
              <Box component="span" sx={{ color: '#DCC07E' }}>
                We Rise
              </Box>
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 400,
                lineHeight: 1.6,
                mb: 4,
                maxWidth: 520,
                mx: { xs: 'auto', md: 0 },
                fontSize: { xs: '1.1rem', md: '1.25rem' },
              }}
            >
              Ghana's trust infrastructure for giving. Raise funds for what matters
              with built-in trust verification, mobile money payouts, and
              transparent impact tracking.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent={{ xs: 'center', md: 'flex-start' }}
            >
              <Button
                variant="contained"
                color="secondary"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                Start a Campaign
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<FavoriteIcon />}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1rem',
                  fontWeight: 700,
                  borderColor: '#fff',
                  color: '#fff',
                  '&:hover': {
                    borderColor: '#fff',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                  },
                }}
              >
                Donate Now
              </Button>
            </Stack>
          </Box>

          {/* Hero Illustration */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                maxWidth: { xs: 300, sm: 380, md: 440 },
              }}
            >
              {/* Nkonsonkonson (unity chain) — interlocked diamond links echoing
                  the platform's diamond-cut shape system */}
              <Box
                component="svg"
                viewBox="0 0 440 150"
                role="img"
                aria-label="Chain of interlinked diamonds, a symbol of unity"
                sx={{ width: '100%', height: 'auto', display: 'block' }}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <rect
                    key={i}
                    x={38 + i * 78}
                    y={43}
                    width={64}
                    height={64}
                    rx={i % 2 === 0 ? 6 : 22}
                    transform={`rotate(45 ${70 + i * 78} 75)`}
                    fill="none"
                    stroke={i % 2 === 0 ? '#C7A24A' : '#A8B5A0'}
                    strokeWidth={i % 2 === 0 ? 3.5 : 2.5}
                    opacity={i % 2 === 0 ? 0.95 : 0.75}
                  />
                ))}
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h4"
                  sx={{
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: { xs: '1.3rem', md: '1.6rem' },
                  }}
                >
                  Empowering{' '}
                  <Box component="span" sx={{ color: '#C7A24A' }}>
                    Ghana
                  </Box>
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, letterSpacing: '0.08em' }}
                >
                  One chain. Many hands. Ubuntu.
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default HeroSection
