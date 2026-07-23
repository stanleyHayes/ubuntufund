import { useEffect, useRef, useState } from 'react'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { keyframes } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string
  type: 'donation' | 'campaign_created' | 'milestone' | 'follow' | 'comment' | 'share'
  userName: string
  userAvatarUrl?: string
  campaignTitle?: string
  campaignId?: string
  organizationName?: string
  organizationId?: string
  amount?: number
  currency?: string
  message?: string
  timestamp: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ─── Animations ───────────────────────────────────────────────────────────────

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-24px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0);     max-height: 120px; }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.3); }
`

// ─── Activity type config ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  donation:         { icon: '💚', color: '#2E7D32', bg: 'rgba(46,125,50,0.08)' },
  campaign_created: { icon: '🚀', color: '#1565C0', bg: 'rgba(21,101,192,0.08)' },
  milestone:        { icon: '🏆', color: '#F57F17', bg: 'rgba(245,127,23,0.08)' },
  follow:           { icon: '👥', color: '#6A1B9A', bg: 'rgba(106,27,154,0.08)' },
  comment:          { icon: '💬', color: '#E65100', bg: 'rgba(230,81,0,0.08)' },
  share:            { icon: '🔗', color: '#00695C', bg: 'rgba(0,105,92,0.08)' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildActionText(item: ActivityItem): React.ReactNode {
  const cfg = TYPE_CONFIG[item.type]
  const campaignLink = item.campaignId ? (
    <Link
      to={`/campaigns/${item.campaignId}`}
      style={{ color: cfg.color, fontWeight: 600, textDecoration: 'none' }}
    >
      {item.campaignTitle}
    </Link>
  ) : null

  const orgLink = item.organizationId ? (
    <Link
      to={`/organizations/${item.organizationId}`}
      style={{ color: cfg.color, fontWeight: 600, textDecoration: 'none' }}
    >
      {item.organizationName}
    </Link>
  ) : null

  switch (item.type) {
    case 'donation':
      return (
        <>
          donated{' '}
          <strong>
            {item.amount != null && item.currency
              ? formatCurrency(item.amount, item.currency)
              : ''}
          </strong>{' '}
          to {campaignLink}
        </>
      )
    case 'campaign_created':
      return <>created a new campaign {campaignLink}</>
    case 'milestone':
      return (
        <>
          {campaignLink} {item.message ?? 'reached a milestone!'}
        </>
      )
    case 'follow':
      return <>started following {orgLink}</>
    case 'comment':
      return <>commented on {campaignLink}</>
    case 'share':
      return <>shared {campaignLink}</>
    default:
      return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<Array<{ id: string; _id?: string; donorId: string; donorName?: string; campaignId: string; campaignTitle?: string; amount: number; currency: string; createdAt: string }>>('/donations?limit=10')
      .then((data) => {
        const mapped: ActivityItem[] = (Array.isArray(data) ? data : []).map((d) => ({
          id: d.id ?? d._id,
          type: 'donation' as const,
          userName: d.donorName ?? 'Anonymous Donor',
          campaignTitle: d.campaignTitle ?? 'Campaign',
          campaignId: d.campaignId,
          amount: d.amount,
          currency: d.currency,
          timestamp: new Date(d.createdAt),
        }))
        setItems(mapped)
      })
      .catch(() => {
        setItems([])
      })
  }, [])

  const maxItems = compact ? 8 : items.length

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: compact ? 520 : 'none',
        bgcolor: 'background.paper',
        borderRadius: SHAPE.card,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: compact ? 2 : 2.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Pulsing live dot */}
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: '#2E7D32',
            animation: `${pulse} 2s ease-in-out infinite`,
          }}
        />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Live Activity
        </Typography>
        <Chip
          label="Live"
          size="small"
          sx={{
            bgcolor: 'rgba(46,125,50,0.1)',
            color: '#2E7D32',
            fontWeight: 700,
            fontSize: '0.7rem',
            height: 22,
          }}
        />
      </Box>

      {/* Scrollable list */}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(0,0,0,0.15)',
            borderRadius: SHAPE.bar,
          },
        }}
      >
        {items.slice(0, maxItems).map((item, idx) => {
          const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.donation
          const isNew = newIds.has(item.id)

          return (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: compact ? 1 : 1.5,
                px: compact ? 2 : 2.5,
                py: compact ? 1 : 1.5,
                bgcolor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                animation: isNew ? `${slideIn} 0.5s ease-out` : undefined,
                transition: 'background-color 0.2s',
                cursor: 'default',
                '&:hover': {
                  bgcolor: cfg.bg,
                },
              }}
            >
              {/* Avatar with type icon overlay */}
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  src={item.userAvatarUrl}
                  alt={item.userName}
                  sx={{
                    width: compact ? 28 : 36,
                    height: compact ? 28 : 36,
                    fontSize: compact ? '0.7rem' : '0.85rem',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -2,
                    right: -4,
                    fontSize: compact ? '0.6rem' : '0.7rem',
                    lineHeight: 1,
                  }}
                >
                  {cfg.icon}
                </Box>
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: compact ? '0.75rem' : '0.82rem',
                    lineHeight: 1.4,
                    color: 'text.primary',
                  }}
                >
                  <Box
                    component="span"
                    sx={{ fontWeight: 700, color: cfg.color }}
                  >
                    {item.userName}
                  </Box>{' '}
                  {buildActionText(item)}
                </Typography>

                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    fontSize: compact ? '0.65rem' : '0.72rem',
                    mt: 0.25,
                    display: 'block',
                  }}
                >
                  {formatTimeAgo(item.timestamp)}
                </Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
