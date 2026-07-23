import { useState, useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import { keyframes } from '@mui/material/styles'
import { formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import { useSSE } from '@/hooks/useSSE'

interface DonationEvent {
  amount: number
  donorName: string
  currency: string
  timestamp: number
}

interface FeedItem extends DonationEvent {
  id: string
}

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-16px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0);     max-height: 80px; }
`

export function LiveDonationFeed({ campaignId, maxItems = 10 }: { campaignId: string; maxItems?: number }) {
  const [items, setItems] = useState<FeedItem[]>([])
  const pendingRef = useRef<FeedItem[]>([])
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMessage = useCallback((event: string, data: unknown) => {
    if (event !== 'donation') return

    const donation = data as DonationEvent
    const item: FeedItem = {
      ...donation,
      id: `${donation.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    }

    pendingRef.current = [item, ...pendingRef.current]

    if (!throttleRef.current) {
      throttleRef.current = setTimeout(() => {
        setItems((prev) => {
          const merged = [...pendingRef.current, ...prev]
          pendingRef.current = []
          return merged.slice(0, maxItems)
        })
        throttleRef.current = null
      }, 300)
    }
  }, [maxItems])

  useSSE(`campaign:${campaignId}`, { onMessage: handleMessage })

  // Seed with existing donations
  useEffect(() => {
    return () => {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current)
      }
    }
  }, [])

  if (items.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Waiting for donations...
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item, idx) => (
        <Box
          key={item.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: SHAPE.sm,
            bgcolor: idx === 0 ? 'rgba(46,125,50,0.06)' : 'transparent',
            animation: idx === 0 ? `${slideIn} 0.4s ease-out` : undefined,
            transition: 'background-color 0.3s',
          }}
        >
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
            {item.donorName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
              {item.donorName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
              just donated{' '}
              <Box component="span" sx={{ fontWeight: 700, color: 'success.main' }}>
                {formatCurrency(item.amount, item.currency)}
              </Box>
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
