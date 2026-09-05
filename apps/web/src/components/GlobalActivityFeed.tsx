import { useState, useCallback, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import { Link } from 'react-router-dom'
import { EmptyState, formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import { useSSE } from '@/hooks/useSSE'
import { api } from '@/lib/api'

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

interface RecentDonation {
  id: string
  campaignId: string
  campaignTitle?: string
  donorName?: string
  amount: number
  currency: string
  createdAt: string
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  donation: { icon: '💚', color: 'var(--text-brand)', bg: 'rgba(46, 61, 47,0.08)' },
  campaign_created: { icon: '🚀', color: 'var(--text-info)', bg: 'rgba(21,101,192,0.08)' },
  milestone: { icon: '🏆', color: 'var(--text-warning)', bg: 'rgba(245,127,23,0.08)' },
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
    let cancelled = false
    api.get<RecentDonation[]>(`/donations?limit=${compact ? 8 : 20}`)
      .then((donations) => {
        if (cancelled || !Array.isArray(donations)) return
        setItems(donations.map((donation) => ({
          id: donation.id,
          type: 'donation',
          userName: donation.donorName || 'Anonymous',
          campaignTitle: donation.campaignTitle,
          campaignId: donation.campaignId,
          amount: donation.amount,
          currency: donation.currency,
          timestamp: new Date(donation.createdAt).getTime(),
        })))
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
      if (throttleRef.current) {
        clearTimeout(throttleRef.current)
      }
    }
  }, [compact])

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: SHAPE.card, p: { xs: 2.5, md: 4 }, boxShadow: 'var(--neu-inset)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">One community, many hands</Typography>
          <Typography component="h2" variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>Recent activity</Typography>
        </Box>
        <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-subtle)', display: 'grid', placeItems: 'center', color: 'primary.main' }} aria-hidden="true">
          <Box component="svg" viewBox="0 0 32 32" sx={{ width: 28, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <rect x="5" y="5" width="14" height="14" rx="5" /><rect x="13" y="13" width="14" height="14" rx="5" />
          </Box>
        </Box>
      </Box>
      {items.length === 0 ? (
        <EmptyState compact title="Every contribution starts something" description="Recent contributions and campaign milestones will appear here." />
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          {items.slice(0, compact ? 6 : 20).map((item) => {
            const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.donation
            return (
              <Box component="li" key={item.id} sx={{ minWidth: 0, p: 2, borderRadius: SHAPE.sm, bgcolor: 'background.paper', boxShadow: 'var(--neu-subtle)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.78rem', bgcolor: 'primary.main', color: 'primary.contrastText' }}>{item.userName.charAt(0).toUpperCase()}</Avatar>
                  <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: '0.84rem', overflowWrap: 'anywhere' }}>{item.userName}</Typography>
                  <Typography component="time" dateTime={new Date(item.timestamp).toISOString()} sx={{ fontSize: '0.7rem', color: 'text.secondary', flexShrink: 0 }}>{formatTimeAgo(item.timestamp)}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 0.5 }}>
                  {item.type === 'donation' ? <>Contributed <Box component="strong" sx={{ color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{item.amount != null && item.currency ? formatCurrency(item.amount, item.currency) : ''}</Box> to</> : item.type === 'campaign_created' ? 'Started a new campaign' : 'Reached a milestone'}
                </Typography>
                {item.campaignId && (
                  <Box component={Link} to={`/campaigns/${item.campaignId}`} sx={{ color: cfg.color, fontWeight: 600, fontSize: '0.84rem', lineHeight: 1.5, textDecoration: 'none', display: 'block', '&:hover': { textDecoration: 'underline' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 3 } }}>{item.campaignTitle ?? 'View campaign'}</Box>
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
