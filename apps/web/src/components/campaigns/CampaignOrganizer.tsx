import { Avatar, Box, Skeleton, Typography } from '@mui/material'
import PersonRounded from '@mui/icons-material/PersonRounded'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import CalendarTodayRounded from '@mui/icons-material/CalendarTodayRounded'
import { SHAPE, TrustBadge } from '@ubuntu-fund/ui'
import type { ComponentProps } from 'react'

type Organizer = {
  name: string
  avatarUrl?: string
  country?: string
  verificationLevel: ComponentProps<typeof TrustBadge>['level']
}
export function CampaignOrganizer({
  creator,
  loading,
  startDate,
  endDate,
}: {
  creator?: Organizer | null
  loading: boolean
  startDate: string | Date
  endDate: string | Date
}) {
  return (
    <Box
      component="section"
      aria-labelledby="organizer-heading"
      sx={{
        alignSelf: 'start',
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        borderRadius: SHAPE.card,
        bgcolor: 'var(--neu-surface)',
        boxShadow: 'var(--neu-subtle)',
        border: 'var(--neu-border)',
        backdropFilter: 'var(--neu-backdrop)',
        minWidth: 0,
      }}
    >
      <PersonRounded
        aria-hidden
        sx={{
          position: 'absolute',
          top: -30,
          right: -20,
          fontSize: 200,
          color: 'primary.main',
          opacity: 0.06,
          transform: 'rotate(-12deg)',
          zIndex: -1,
        }}
      />
      <Box sx={{ p: { xs: 2.5, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Box
            aria-hidden
            sx={{ width: 22, height: 3, bgcolor: 'secondary.main', borderRadius: 2 }}
          />
          <Typography
            id="organizer-heading"
            component="h2"
            sx={{
              fontSize: '.72rem',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            Behind the campaign
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, mb: 2.5 }}>
          {loading ? (
            <Skeleton variant="rounded" width={80} height={88} />
          ) : (
            <Avatar
              variant="rounded"
              src={creator?.avatarUrl}
              alt=""
              sx={{
                width: { xs: 68, sm: 80 },
                height: { xs: 76, sm: 88 },
                borderRadius: '16px',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontSize: '2rem',
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: 'var(--neu-raised)',
              }}
            >
              {creator?.name?.charAt(0).toUpperCase() ?? '?'}
            </Avatar>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: '.72rem', color: 'text.secondary', mb: 0.5 }}>
              Campaign organizer
            </Typography>
            <Typography
              component="h3"
              sx={{
                fontSize: { xs: '1.2rem', sm: '1.4rem' },
                fontWeight: 800,
                lineHeight: 1.25,
                letterSpacing: '-.025em',
                overflowWrap: 'anywhere',
              }}
            >
              {loading ? (
                <Skeleton width="80%" />
              ) : (
                (creator?.name ?? 'Organizer details unavailable')
              )}
            </Typography>
            {creator?.country && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 0.8,
                  color: 'text.secondary',
                }}
              >
                <PlaceOutlined sx={{ fontSize: 16 }} />
                <Typography variant="body2">{creator.country}</Typography>
              </Box>
            )}
          </Box>
        </Box>
        {loading ? (
          <Skeleton height={38} />
        ) : (
          creator && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
                p: 1.5,
                borderRadius: SHAPE.sm,
                boxShadow: 'var(--neu-inset)',
                '& .MuiChip-root': {
                  bgcolor: 'var(--neu-surface)',
                  color: 'primary.main',
                  boxShadow: 'var(--neu-subtle)',
                },
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Identity verification
              </Typography>
              <TrustBadge level={creator.verificationLevel} />
            </Box>
          )
        )}
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {[
          { label: 'Started', date: startDate },
          { label: 'Closes', date: endDate },
        ].map(({ label, date }, index) => (
          <Box
            key={label}
            sx={{
              p: { xs: 2, md: 2.5 },
              minWidth: 0,
              borderLeft: index ? '1px solid' : 0,
              borderColor: 'divider',
            }}
          >
            <Typography
              component="dt"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                color: 'text.secondary',
                fontSize: '.72rem',
              }}
            >
              <CalendarTodayRounded sx={{ fontSize: 14, color: 'primary.main' }} />
              {label}
            </Typography>
            <Typography
              component="dd"
              sx={{ m: 0, mt: 0.8, fontWeight: 700, fontSize: { xs: '.85rem', sm: '.95rem' } }}
            >
              {new Date(date).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
