import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { SHAPE } from '@ubuntu-fund/ui'
import { TONES, HAIRLINE, type Tone } from '@/lib/tones'

export interface PageHeaderStat {
  label: string
  value: ReactNode
}

export interface PageHeaderProps {
  /** Section accent tone; drives the top border, eyebrow, and icon tint. */
  tone?: Tone
  /** Short uppercase kicker above the title, e.g. "Trust & Safety". */
  eyebrow: string
  title: string
  /** One-sentence description under the title; kept to a readable measure. */
  lede?: string
  /** Section glyph; rendered in a tinted tile and as a faint corner watermark. */
  icon?: ReactNode
  /** Action buttons, right-aligned next to the title block. */
  actions?: ReactNode
  /** Optional stats strip rendered inside the header card, below the title. */
  stats?: PageHeaderStat[]
}

/**
 * Standard admin page header: tone-accented card with eyebrow, display
 * title, lede, actions, an optional stats strip, and a faint watermark of
 * the section icon in the corner.
 */
export default function PageHeader({
  tone = 'green',
  eyebrow,
  title,
  lede,
  icon,
  actions,
  stats,
}: PageHeaderProps) {
  const t = TONES[tone]

  return (
    <Box
      component="header"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        mb: 3,
        borderRadius: SHAPE.card,
        border: `1px solid ${HAIRLINE}`,
        borderTop: `3px solid ${t.border}`,
        bgcolor: 'background.paper',
      }}
    >
      {icon && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            right: -18,
            bottom: -22,
            opacity: 0.05,
            pointerEvents: 'none',
            '& svg': { fontSize: 150 },
          }}
        >
          {icon}
        </Box>
      )}

      <Box
        sx={{
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75, minWidth: 0 }}>
          {icon && (
            <Box
              sx={{
                mt: 0.25,
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: SHAPE.sm,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: t.soft,
                border: `1px solid ${t.border}55`,
                color: t.text,
                '& svg': { fontSize: 22 },
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '0.66rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                color: t.text,
              }}
            >
              {eyebrow}
            </Typography>
            <Typography
              component="h1"
              sx={{
                mt: 0.5,
                fontFamily: '"TT Squares", "Inter", sans-serif',
                fontWeight: 900,
                fontSize: { xs: '1.45rem', md: '1.7rem' },
                lineHeight: 1.15,
                color: 'text.primary',
              }}
            >
              {title}
            </Typography>
            {lede && (
              <Typography
                variant="body2"
                sx={{ mt: 0.75, maxWidth: 560, color: 'text.secondary', lineHeight: 1.55 }}
              >
                {lede}
              </Typography>
            )}
          </Box>
        </Box>

        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexShrink: 0, pt: 0.5 }}>
            {actions}
          </Box>
        )}
      </Box>

      {stats && stats.length > 0 && (
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
            },
            borderTop: `1px solid ${HAIRLINE}`,
          }}
        >
          {stats.map((stat, i) => (
            <Box
              key={stat.label}
              sx={{
                px: 3,
                py: 1.75,
                borderLeft: { sm: i > 0 ? `1px solid ${HAIRLINE}` : 'none' },
              }}
            >
              <Typography
                component="dd"
                sx={{ m: 0, fontSize: '1.5rem', fontWeight: 700, color: t.text, lineHeight: 1.2 }}
              >
                {stat.value}
              </Typography>
              <Typography
                component="dt"
                sx={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'text.secondary',
                }}
              >
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
