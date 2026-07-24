import { useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardMedia from '@mui/material/CardMedia'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { Link as RouterLink } from 'react-router-dom'
import { ProgressBar, SHAPE } from '@ubuntu-fund/ui'
import type { Campaign } from '@ubuntu-fund/types'

interface CampaignCardProps {
  campaign: Campaign
}

const MS_PER_DAY = 86_400_000

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '...'
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

/** Forest-toned cover placeholder with the unity-chain motif. */
export function CoverPlaceholder({ category, height = 150 }: { category: string; height?: number }) {
  return (
    <Box
      sx={{
        height,
        background: 'linear-gradient(150deg, #2E3D2F 0%, #1C261D 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box component="svg" viewBox="0 0 220 60" aria-hidden sx={{ width: 150, opacity: 0.8 }}>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={14 + i * 52}
            y={12}
            width={32}
            height={32}
            rx={i % 2 === 0 ? 4 : 12}
            transform={`rotate(45 ${30 + i * 52} 28)`}
            fill="none"
            stroke={i % 2 === 0 ? '#C7A24A' : '#A8B5A0'}
            strokeWidth={2.5}
            opacity={i % 2 === 0 ? 0.9 : 0.6}
          />
        ))}
      </Box>
      <Typography
        sx={{
          position: 'absolute',
          bottom: 10,
          left: 14,
          fontSize: '0.6rem',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(245, 242, 234, 0.55)',
        }}
      >
        {formatCategory(category)}
      </Typography>
    </Box>
  )
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const [now] = useState(() => Date.now())
  const daysLeft = useMemo(
    () => Math.ceil((new Date(campaign.endDate).getTime() - now) / MS_PER_DAY),
    [campaign.endDate, now]
  )
  const cover = campaign.imageUrls[0]
  const href = `/campaigns/${campaign.id}`

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea
        component={RouterLink}
        to={href}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          '&:hover .card-cta': { color: 'secondary.dark' },
          '&:hover .card-cta svg': { transform: 'translateX(3px)' },
        }}
      >
        {cover ? (
          <CardMedia component="img" height={150} image={cover} alt={campaign.title} sx={{ objectFit: 'cover' }} />
        ) : (
          <CoverPlaceholder category={campaign.category} />
        )}

        <Box sx={{ p: 2.25, pt: 1.75, display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 1.25 }}>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label={formatCategory(campaign.category)}
              size="small"
              sx={{
                bgcolor: 'rgba(168, 181, 160, 0.28)',
                color: '#2E3D2F',
                fontWeight: 600,
                borderRadius: SHAPE.sm,
              }}
            />
            {campaign.priority === 'critical' && <Chip label="Critical" size="small" color="error" />}
            {campaign.priority === 'urgent' && <Chip label="Urgent" size="small" color="warning" />}
          </Box>

          <Box>
            <Typography
              component="h3"
              sx={{
                fontFamily: '"TT Squares", "Inter", sans-serif',
                fontWeight: 700,
                fontSize: '1.05rem',
                lineHeight: 1.3,
                color: 'text.primary',
              }}
            >
              {campaign.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.5 }}>
              {truncate(campaign.description, 100)}
            </Typography>
          </Box>

          <Box sx={{ mt: 'auto' }}>
            <ProgressBar
              current={campaign.raisedAmount}
              goal={campaign.goalAmount}
              currency={campaign.currency}
            />

            <Box
              sx={{
                mt: 1.25,
                pt: 1.25,
                borderTop: '1px solid #EEEAE0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
                </Typography>
              </Box>
              <Typography
                className="card-cta"
                variant="caption"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.4,
                  fontWeight: 700,
                  color: '#2E3D2F',
                  transition: 'color 0.15s ease',
                }}
              >
                View campaign
                <ArrowForwardRoundedIcon sx={{ fontSize: 13, transition: 'transform 0.15s ease' }} />
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  )
}
