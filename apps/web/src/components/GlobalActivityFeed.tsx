import { useState, useCallback, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import { keyframes } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import { useSSE } from '@/hooks/useSSE'

interface ActivityEvent {
  type: 'donation' | 'campaign_created' | 'milestone'
  campaignId?: string
  campaignTitle?: string
  donorName?: string
  amount?: number
  currency?: string
  timestamp?: number
}

interface ActivityItem {
  id: string
  type: 'donation' | 'campaign_created' | 'milestone'
  userName: string
  campaignTitle?: string
  campaignId?: string
  amount?: number
  currency?: string
  timestamp: number
}

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-12px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0);     max-height: 80px; }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(1.3); }
`

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  donation: { icon: '💚', color: '#2E7D32', bg: 'rgba(46,125,50,0.08)' },
  campaign_created: { icon: '🚀', color: '#1565C0', bg: 'rgba(21,101,192,0.08)' },
  milestone: { icon: '🏆', color: '#F57F17', bg: 'rgba(245,127,23,0.08)' },
}

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function GlobalActivityFeed({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const pendingRef = useRef<ActivityItem[]>([])
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)

  const handleMessage = useCallback((event: string, data: unknown) => {
    if (event !== 'activity') return

    const activity = data as ActivityEvent
    const item: ActivityItem = {
      id: `activity-${++idRef.current}`,
      type: activity.type ?? 'donation',
      userName: activity.donorName ?? 'Anonymous',
      campaignTitle: activity.campaignTitle,
      campaignId: activity.campaignId,
      amount: activity.amount,
      currency: activity.currency,
      timestamp: activity.timestamp ?? Date.now(),
    }

    pendingRef.current = [item, ...pendingRef.current]

    if (!throttleRef.current) {
      throttleRef.current = setTimeout(() => {
        setItems((prev) => {
          const merged = [...pendingRef.current, ...prev]
          pendingRef.current = []
          return merged.slice(0, compact ? 8 : 20)
        })
        throttleRef.current = null
      }, 500)
    }
  }, [compact])

  useSSE('global', { onMessage: handleMessage })

  useEffect(() => {
    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current)
      }
    }
  }, [])

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
        {items.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Waiting for activity...
            </Typography>
          </Box>
        )}

        {items.map((item, idx) => {
          const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.donation
          const isNew = idx < 3

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
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  sx={{
                    width: compact ? 28 : 36,
                    height: compact ? 28 : 36,
                    fontSize: compact ? '0.7rem' : '0.85rem',
                    bgcolor: 'primary.main',
                  }}
                >
                  {item.userName.charAt(0).toUpperCase()}
                </Avatar>
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

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: compact ? '0.75rem' : '0.82rem',
                    lineHeight: 1.4,
                    color: 'text.primary',
                  }}
                >
                  <Box component="span" sx={{ fontWeight: 700, color: cfg.color }}>
                    {item.userName}
                  </Box>{' '}
                  {item.type === 'donation' && (
                    <>
                      donated{' '}
                      <strong>
                        {item.amount != null && item.currency
                          ? formatCurrency(item.amount, item.currency)
                          : ''}
                      </strong>
                    </>
                  )}
                  {item.type === 'campaign_created' && 'created a new campaign'}
                  {item.type === 'milestone' && 'reached a milestone'}
                  {item.campaignId && (
                    <>
                      {' '}
                      <Link
                        to={`/campaigns/${item.campaignId}`}
                        style={{ color: cfg.color, fontWeight: 600, textDecoration: 'none' }}
                      >
                        {item.campaignTitle ?? 'Campaign'}
                      </Link>
                    </>
                  )}
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
