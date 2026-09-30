import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import type { BeneficiaryCampaignListItem } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { CONSENT_STATUS } from '@/lib/onBehalf'

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  active: 'Active',
  funded: 'Funded',
  expired: 'Ended',
  blocked: 'Blocked',
}

function payoutLine(item: BeneficiaryCampaignListItem): string {
  if (item.payoutAuthority) return 'You can request payouts from the campaign page.'
  if (item.consentStatus === 'accepted' && item.payoutArrangement === 'organization') return `${item.organizerName} receives the payouts, as you agreed.`
  return 'Payouts are paused. You cannot request them right now.'
}

/** Campaigns other people run on the signed-in user's behalf. Hidden when there are none. */
export function BeneficiaryCampaigns() {
  const [items, setItems] = useState<BeneficiaryCampaignListItem[]>([])
  useEffect(() => {
    let active = true
    api.get<BeneficiaryCampaignListItem[]>('/beneficiary/campaigns')
      .then((data) => { if (active && Array.isArray(data)) setItems(data) })
      .catch(() => { /* Optional section: shown only when it loads. */ })
    return () => { active = false }
  }, [])
  if (!items.length) return null
  return (
    <Box component="section" aria-labelledby="run-for-you-heading" sx={{ mb: 4 }}>
      <Typography id="run-for-you-heading" component="h2" variant="h6" sx={{ fontWeight: 800 }}>
        Campaigns run for you
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Other people or organizations raise money for you here, with your agreement.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        {items.map((item) => {
          const consent = CONSENT_STATUS[item.consentStatus]
          return (
            <Box key={item.id} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)', minWidth: 0 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                <Chip size="small" variant="outlined" label={CAMPAIGN_STATUS_LABELS[item.status] ?? item.status} />
                <Chip size="small" color={consent.tone} label={consent.label} />
              </Box>
              <Link component={RouterLink} to={`/campaigns/${item.id}`} underline="hover" sx={{ fontWeight: 700, fontSize: '1.02rem', color: 'text.primary', overflowWrap: 'anywhere' }}>
                {item.title}
              </Link>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Organized by {item.organizerName}
              </Typography>
              <Typography sx={{ mt: 1.25, fontWeight: 700, fontSize: '0.9rem' }}>
                {formatCurrency(item.raisedAmount, item.currency)}
                <Typography component="span" sx={{ fontWeight: 400, fontSize: '0.8rem', color: 'text.secondary', ml: 0.5 }}>
                  raised of {formatCurrency(item.goalAmount, item.currency)}
                </Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {payoutLine(item)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
