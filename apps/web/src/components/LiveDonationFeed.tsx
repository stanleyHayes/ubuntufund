import { EmptyState } from '@ubuntu-fund/ui'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import { keyframes } from '@mui/material/styles'
import { formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import { usePublicFeed } from '@/hooks/usePublicFeed'

interface CampaignDonationResponse {
  items?: Array<{
    id: string
    amount: number
    currency: string
    donorName?: string
    isAnonymous?: boolean
    createdAt: string
  }>
}

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-16px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0);     max-height: 80px; }
`

export function LiveDonationFeed({ campaignId, maxItems = 10 }: { campaignId: string; maxItems?: number }) {
  const { data } = usePublicFeed<CampaignDonationResponse | CampaignDonationResponse['items']>(`/campaigns/${campaignId}/donations?page=1&pageSize=${maxItems}`, `campaign:${campaignId}`, 'donation')
  const donations = Array.isArray(data) ? data : data?.items ?? []
  const items = donations.map(donation => ({
    id: donation.id, amount: donation.amount, currency: donation.currency,
    donorName: donation.isAnonymous ? 'Anonymous' : donation.donorName || 'Anonymous',
    timestamp: new Date(donation.createdAt).getTime(),
  }))

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
            bgcolor: idx === 0 ? 'rgba(46, 61, 47,0.06)' : 'transparent',
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
