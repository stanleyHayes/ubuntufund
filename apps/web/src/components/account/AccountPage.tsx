import { useEntrance } from '@/components/motion/useEntrance'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import { SHAPE } from '@ubuntu-fund/ui'

export function AccountHeading({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: ReactNode
}) {
  const entrance = useEntrance<HTMLDivElement>()
  return (
    <Box
      ref={entrance}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mb: 4,
        pb: 3,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          display: 'grid',
          placeItems: 'center',
          borderRadius: SHAPE.sm,
          bgcolor: 'action.hover',
          color: 'primary.main',
          '& svg': { fontSize: 28 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            color: 'var(--text-warning)',
            letterSpacing: '.16em',
            fontSize: '.65rem',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          Your workspace
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '1.65rem', md: '2.1rem' },
            fontWeight: 800,
            lineHeight: 1.25,
            my: 0.5,
          }}
        >
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: '.9rem', maxWidth: 620 }}>
          {description}
        </Typography>
      </Box>
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          right: -12,
          top: -24,
          opacity: 0.055,
          color: 'primary.main',
          pointerEvents: 'none',
          '& svg': { fontSize: 160, transform: 'rotate(-15deg)' },
        }}
      >
        {icon}
      </Box>
    </Box>
  )
}

export function AccountRowsSkeleton() {
  return (
    <Box aria-busy="true" aria-label="Loading records" sx={{ p: 2 }}>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 1.5 }}>
          <Skeleton variant="circular" width={36} height={36} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="65%" />
            <Skeleton width="40%" />
          </Box>
          <Skeleton width={70} />
        </Box>
      ))}
    </Box>
  )
}

export function AccountPageSkeleton({
  layout = 'table',
}: {
  layout?: 'table' | 'cards' | 'settings'
}) {
  return (
    <Container
      maxWidth="lg"
      aria-busy="true"
      aria-label="Loading your workspace"
      sx={{
        py: { xs: 4, md: 5 },
        '& .MuiSkeleton-root': { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } },
      }}
    >
      <Skeleton width={110} />
      <Skeleton width="45%" height={52} />
      <Skeleton width="65%" sx={{ mb: 4 }} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 3,
          mb: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={130} sx={{ borderRadius: SHAPE.card }} />
        ))}
      </Box>
      {layout === 'cards' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 3,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={240} sx={{ borderRadius: SHAPE.card }} />
          ))}
        </Box>
      ) : layout === 'settings' ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3 }}>
          <Skeleton variant="rounded" height={240} />
          <Skeleton variant="rounded" height={470} />
        </Box>
      ) : (
        <Box
          sx={{
            borderRadius: SHAPE.card,
            bgcolor: 'background.paper',
            boxShadow: 'var(--neu-raised)',
          }}
        >
          <AccountRowsSkeleton />
        </Box>
      )}
    </Container>
  )
}
