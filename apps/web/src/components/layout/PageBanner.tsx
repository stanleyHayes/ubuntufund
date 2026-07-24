import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

const CREAM = '#F5F2EA'
const GOLD = '#C7A24A'
const SAGE = '#A8B5A0'

interface BannerStat {
  value: string
  label: string
}

/**
 * Top-of-page banner: a forest band with a gold accent seam, a faint chain-link
 * watermark, a gold eyebrow, a large title, an optional lede, and optional stats
 * or action. Mirrors the house identity across Explore, Organizations,
 * Leaderboard, and Start-a-Campaign.
 */
export function PageBanner({
  eyebrow,
  title,
  subtitle,
  icon,
  stats,
  action,
}: {
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  stats?: BannerStat[]
  action?: ReactNode
}) {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        color: CREAM,
        background: 'linear-gradient(120deg, #1C261D 0%, #2E3D2F 100%)',
        boxShadow: 'inset 0 -2px 0 rgba(199, 162, 74, 0.45)',
      }}
    >
      {/* Gold radial glow, top-right */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 88% 20%, rgba(199, 162, 74, 0.14) 0%, transparent 42%)',
        }}
      />
      {/* Faint chain-link diamond watermark */}
      <Box
        aria-hidden
        component="svg"
        viewBox="0 0 340 120"
        sx={{
          position: 'absolute',
          right: { xs: -60, md: -20 },
          top: '50%',
          transform: 'translateY(-50%)',
          width: { xs: 300, md: 420 },
          opacity: 0.12,
          display: { xs: 'none', sm: 'block' },
          pointerEvents: 'none',
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={20 + i * 66}
            y={30}
            width={60}
            height={60}
            rx={i % 2 === 0 ? 6 : 22}
            transform={`rotate(45 ${50 + i * 66} 60)`}
            fill="none"
            stroke={i % 2 === 0 ? GOLD : SAGE}
            strokeWidth={4}
          />
        ))}
      </Box>

      <Container maxWidth="lg" sx={{ position: 'relative', py: { xs: 5, md: 7 } }}>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: GOLD,
            mb: 1.25,
          }}
        >
          {eyebrow}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {icon && (
            <Box
              aria-hidden
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 44,
                height: 44,
                flexShrink: 0,
                color: GOLD,
                bgcolor: 'rgba(199, 162, 74, 0.14)',
                borderRadius: '4px 14px 4px 14px',
              }}
            >
              {icon}
            </Box>
          )}
          <Typography
            component="h1"
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 900,
              fontSize: { xs: '1.9rem', md: '2.6rem' },
              lineHeight: 1.1,
              color: CREAM,
            }}
          >
            {title}
          </Typography>
        </Box>

        {subtitle && (
          <Typography sx={{ mt: 1.75, maxWidth: 620, fontSize: { xs: '0.95rem', md: '1.05rem' }, lineHeight: 1.6, color: 'rgba(245, 242, 234, 0.82)' }}>
            {subtitle}
          </Typography>
        )}

        {stats && stats.length > 0 && (
          <Box sx={{ mt: 3.5, display: 'flex', flexWrap: 'wrap', gap: { xs: 3, md: 5 } }}>
            {stats.map((s) => (
              <Box key={s.label}>
                <Typography sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 900, fontSize: { xs: '1.4rem', md: '1.7rem' }, color: GOLD, lineHeight: 1 }}>
                  {s.value}
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(245, 242, 234, 0.7)' }}>
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {action && <Box sx={{ mt: 3.5 }}>{action}</Box>}
      </Container>
    </Box>
  )
}
