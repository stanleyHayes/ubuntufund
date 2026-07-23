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
        background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 40%, #388E3C 70%, #1a6b3c 100%)',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 20% 50%, rgba(249, 168, 37, 0.15) 0%, transparent 50%), ' +
            'radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 40%), ' +
            'radial-gradient(circle at 60% 80%, rgba(249, 168, 37, 0.1) 0%, transparent 40%)',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: -2,
          left: 0,
          right: 0,
          height: 80,
          background: 'linear-gradient(to top, #FAFAF5, transparent)',
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
          border: '1px solid rgba(249,168,37,0.15)',
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
                color: '#F9A825',
                fontWeight: 700,
                letterSpacing: 3,
                fontSize: '0.85rem',
                mb: 2,
                display: 'block',
              }}
            >
              Pan-African Crowdfunding Platform
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
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #F9A825, #FDD835)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
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
              Africa's trust infrastructure for giving. Raise funds for what matters
              with built-in trust verification, multi-currency support, and
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
                width: { xs: 280, sm: 340, md: 400 },
                height: { xs: 280, sm: 340, md: 400 },
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(249,168,37,0.3), rgba(255,255,255,0.1))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(255,255,255,0.15)',
                position: 'relative',
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '4rem', md: '5rem' },
                  lineHeight: 1,
                  mb: 1,
                }}
              >
                🌍
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  color: '#fff',
                  fontWeight: 800,
                  textAlign: 'center',
                  fontSize: { xs: '1.3rem', md: '1.6rem' },
                }}
              >
                Empowering
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  color: '#F9A825',
                  fontWeight: 800,
                  textAlign: 'center',
                  fontSize: { xs: '1.3rem', md: '1.6rem' },
                }}
              >
                Africa
              </Typography>
              {/* Orbiting dots */}
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <Box
                  key={deg}
                  sx={{
                    position: 'absolute',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: deg % 120 === 0 ? '#F9A825' : 'rgba(255,255,255,0.4)',
                    top: `${50 - 48 * Math.cos((deg * Math.PI) / 180)}%`,
                    left: `${50 + 48 * Math.sin((deg * Math.PI) / 180)}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default HeroSection
