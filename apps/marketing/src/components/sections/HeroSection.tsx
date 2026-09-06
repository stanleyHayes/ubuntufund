import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { SplitText } from 'gsap/SplitText'
import { keyframes } from '@emotion/react'
import HomeWatermark from '../art/HomeWatermark'
import CommunitySculpture from '../art/CommunitySculpture'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import FavoriteIcon from '@mui/icons-material/Favorite'

gsap.registerPlugin(useGSAP, SplitText)

const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:8200'

// A slow light-sweep across the gold accent — the "sparkle" of the headline.
const shimmer = keyframes`
  0%   { background-position: -140% 0; }
  60%  { background-position: 240% 0; }
  100% { background-position: 240% 0; }
`
// Tiny twinkling stars beside the accent.
const twinkle = keyframes`
  0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
  50%      { opacity: 1; transform: scale(1) rotate(90deg); }
`

function Sparkle({ top, left, size, delay }: { top: string; left: string; size: number; delay: number }) {
  return (
    <Box
      aria-hidden
      className="hero-sparkle"
      sx={{
        position: 'absolute', top, left, width: size, height: size, pointerEvents: 'none',
        opacity: 0,
        animation: `${twinkle} 2.6s ease-in-out ${delay}s infinite`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0 },
      }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="#F3DE9E" />
      </svg>
    </Box>
  )
}

function HeroSection() {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const split = new SplitText('.hero-title', { type: 'words', wordsClass: 'hero-word' })
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        tl.from('.hero-overline', { y: 18, autoAlpha: 0, duration: 0.55 })
          .from(
            split.words,
            { yPercent: 115, autoAlpha: 0, stagger: 0.06, duration: 0.75, ease: 'power4.out' },
            '-=0.25',
          )
          .from('.hero-sub', { y: 20, autoAlpha: 0, duration: 0.7 }, '-=0.35')
          .from('.hero-cta', { y: 16, autoAlpha: 0, stagger: 0.12, duration: 0.5 }, '-=0.4')
          .from('.hero-art', { autoAlpha: 0, scale: 0.96, y: 24, duration: 0.9, ease: 'power2.out' }, '-=0.9')
          .from('.hero-sparkle', { autoAlpha: 0, duration: 0.4 }, '-=0.3')
          // Restore the intact headline so the gold accent's CSS shimmer runs cleanly.
          .add(() => split.revert())
        return () => split.revert()
      })
    },
    { scope: root },
  )

  return (
    <Box
      ref={root}
      sx={{
        position: 'relative',
        minHeight: { xs: '100vh', md: '90vh' },
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(160deg, #1C261D 0%, #2E3D2F 100%)',
        '--neu-surface': '#233126',
        '--neu-raised': 'var(--forest-raised)',
        '--neu-raised-hover': 'var(--forest-raised-hover)',
        '--neu-subtle': 'var(--forest-subtle)',
        '--neu-inset': 'var(--forest-inset)',
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
      <HomeWatermark variant="chain" />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
            gap: { xs: 4, md: 8 },
            pt: { xs: 14, md: 12 }, pb: { xs: 6, md: 8 },
          }}
        >
          {/* Text Content */}
          <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
            <Typography
              variant="overline"
              className="hero-overline"
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
              className="hero-title"
              sx={{
                position: 'relative',
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
                className="hero-accent"
                sx={{
                  position: 'relative',
                  color: '#DCC07E',
                  // Gold text with a bright light-sweep — the "sparkle".
                  backgroundImage:
                    'linear-gradient(100deg, #DCC07E 38%, #FFF4D2 50%, #DCC07E 62%)',
                  backgroundSize: '250% 100%',
                  backgroundRepeat: 'no-repeat',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: `${shimmer} 5.5s ease-in-out 1.6s infinite`,
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                    WebkitTextFillColor: '#DCC07E',
                  },
                }}
              >
                we fund what matters
              </Box>
              <Sparkle top="-6%" left="46%" size={18} delay={1.8} />
              <Sparkle top="72%" left="92%" size={13} delay={2.5} />
              <Sparkle top="18%" left="78%" size={10} delay={3.1} />
            </Typography>
            <Typography
              variant="h5"
              className="hero-sub"
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
              with campaign review workflows, accountable records, and
              transparent progress updates.
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
                className="hero-cta"
                href={`${WEB_APP_URL}/campaigns/new`}
                endIcon={<ArrowForwardIcon />}
                sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700 }}
              >
                Start a Campaign
              </Button>
              <Button
                variant="outlined"
                size="large"
                className="hero-cta"
                href={`${WEB_APP_URL}/explore`}
                startIcon={<FavoriteIcon />}
                sx={{
                  py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700, color: '#fff',
                  '&:hover': { backgroundColor: '#233126' },
                }}
              >
                Donate Now
              </Button>
            </Stack>
          </Box>

          <Box className="hero-art" sx={{ flex: 1, width: '100%', minWidth: 0, maxWidth: 560, position: 'relative', pb: 2 }}>
            <Box component="img" className="home-art-image" src="/images/home/community-garden.jpg"
              alt="Illustration of neighbors planning a community garden in a Ghanaian courtyard"
              width={1536} height={1024} fetchPriority="high"
              sx={{ width: '100%', height: 'auto', boxShadow: '20px 25px 60px rgba(0,0,0,.25)' }} />
            <Box sx={{ mt: -3, position: 'relative', color: '#E8EBE3' }}><CommunitySculpture /></Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default HeroSection
