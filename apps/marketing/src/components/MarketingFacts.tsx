import type { ReactNode } from 'react'
import { Box, Container, Typography } from '@mui/material'
import { SHAPE } from '@ubuntu-fund/ui'

export function MarketingFacts({
  items,
  label,
}: {
  items: { value: string; label: string; icon: ReactNode }[]
  label: string
}) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{ bgcolor: 'background.default', py: { xs: 4, md: 5 } }}
    >
      <Container maxWidth="lg">
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {items.map((item) => (
            <Box
              key={item.label}
              sx={{
                position: 'relative',
                isolation: 'isolate',
                overflow: 'hidden',
                p: { xs: 2.5, md: 3 },
                borderRadius: SHAPE.card,
                bgcolor: 'var(--neu-surface)',
                border: 'var(--neu-border)',
                boxShadow: 'var(--neu-subtle)',
                backdropFilter: 'var(--neu-backdrop)',
                minWidth: 0,
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  right: -18,
                  bottom: -24,
                  transform: 'rotate(-16deg)',
                  opacity: 0.075,
                  color: 'primary.main',
                  pointerEvents: 'none',
                  zIndex: -1,
                  '& svg': { fontSize: 150 },
                }}
              >
                {item.icon}
              </Box>
              <Box
                aria-hidden="true"
                sx={{
                  width: 40,
                  height: 40,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'primary.main',
                  borderRadius: SHAPE.sm,
                  boxShadow: 'var(--neu-inset)',
                  mb: 2.5,
                  '& svg': { fontSize: 21 },
                }}
              >
                {item.icon}
              </Box>
              <Typography
                component="dt"
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '.72rem', md: '.8rem' },
                  lineHeight: 1.5,
                  mb: 0.75,
                }}
              >
                {item.label}
              </Typography>
              <Typography
                component="dd"
                sx={{
                  m: 0,
                  color: 'text.primary',
                  fontSize: { xs: '1.65rem', md: '2.15rem' },
                  fontWeight: 800,
                  letterSpacing: '-.035em',
                  lineHeight: 1.2,
                  overflowWrap: 'anywhere',
                }}
              >
                {item.value}
              </Typography>
              <Box
                aria-hidden="true"
                sx={{ width: 28, height: 3, bgcolor: 'secondary.main', mt: 2.5, borderRadius: 2 }}
              />
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  )
}
