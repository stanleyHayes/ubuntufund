import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { Link as RouterLink } from 'react-router-dom'
import { BrandLogo } from '@ubuntu-fund/ui'

interface AuthLayoutProps {
  /** Small gold kicker above the title, e.g. "Welcome back". */
  eyebrow?: string
  title?: string
  subtitle?: string
  children: ReactNode
}

const VALUE_PROPS = [
  'Built-in trust verification for every campaign',
  'Cedi wallets made for Ghanaian giving',
  'Transparent impact tracking, donation by donation',
]

export function AuthLayout({ eyebrow, title, subtitle, children }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(360px, 44%) 1fr' },
        bgcolor: 'background.default',
      }}
    >
      {/* Brand panel */}
      <Box
        sx={{
          background: 'linear-gradient(160deg, #1C261D 0%, #2E3D2F 100%)',
          color: '#F5F2EA',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'center', md: 'space-between' },
          px: { xs: 3, md: 6 },
          py: { xs: 3, md: 6 },
          minHeight: { xs: 148, md: 'auto' },
        }}
      >
        <Box
          component={RouterLink}
          to="/"
          aria-label="UbuntuFund home"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <BrandLogo size={38} onDark />
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          {/* Unity chain */}
          <Box component="svg" viewBox="0 0 220 60" aria-hidden sx={{ width: 170, display: 'block', mb: 3 }}>
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={12 + i * 52}
                y={12}
                width={32}
                height={32}
                rx={i % 2 === 0 ? 4 : 12}
                transform={`rotate(45 ${28 + i * 52} 28)`}
                fill="none"
                stroke={i % 2 === 0 ? '#C7A24A' : '#A8B5A0'}
                strokeWidth={2.5}
                opacity={i % 2 === 0 ? 0.95 : 0.65}
              />
            ))}
          </Box>

          <Typography
            sx={{
              fontFamily: '"TT Squares", sans-serif',
              fontWeight: 900,
              fontSize: '2rem',
              lineHeight: 1.15,
              maxWidth: 380,
            }}
          >
            Together,{' '}
            <Box component="span" sx={{ color: '#DCC07E' }}>
              We Rise
            </Box>
          </Typography>

          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {VALUE_PROPS.map((prop) => (
              <Box key={prop} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#A8B5A0', mt: 0.2 }} />
                <Typography variant="body2" sx={{ color: 'rgba(245, 242, 234, 0.8)', lineHeight: 1.55 }}>
                  {prop}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography
          sx={{
            display: { xs: 'none', md: 'block' },
            fontSize: '0.7rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(245, 242, 234, 0.45)',
            fontWeight: 600,
          }}
        >
          One chain · Many hands · Ubuntu
        </Typography>
      </Box>

      {/* Form column */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, sm: 4 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {(eyebrow || title) && (
            <Box sx={{ mb: 3 }}>
              {eyebrow && (
                <Typography
                  sx={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.22em',
                    color: '#A07E33',
                  }}
                >
                  {eyebrow}
                </Typography>
              )}
              {title && (
                <Typography
                  component="h1"
                  sx={{
                    mt: 0.75,
                    fontFamily: '"TT Squares", "Inter", sans-serif',
                    fontWeight: 900,
                    fontSize: { xs: '1.5rem', md: '1.75rem' },
                    color: 'text.primary',
                    lineHeight: 1.2,
                  }}
                >
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.6 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          )}

          {children}

          <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
            <Link component={RouterLink} to="/" underline="hover" sx={{ color: 'text.secondary' }}>
              ← Back to home
            </Link>
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
