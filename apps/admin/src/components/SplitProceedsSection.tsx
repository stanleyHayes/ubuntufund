import { useEffect, useState } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { EmptyState } from '@ubuntu-fund/ui'
import type {
  CampaignBeneficiaryBalance,
  CampaignSplitDisclosure,
  CampaignSplitVersion,
} from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const B = 'rgba(255,255,255,0.06)'

const STATUS_COLOR: Record<string, string> = {
  active: '#5E8F72',
  draft: '#D3A95C',
  superseded: '#78909C',
}
const CONSENT_COLOR: Record<string, string> = {
  accepted: '#5E8F72',
  pending: '#D3A95C',
  declined: '#C06B58',
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 1, mb: 1.5, fontFamily: '"Outfit", sans-serif' }}>
      {children}
    </Typography>
  )
}

function money(n: number, currency = 'GHS'): string {
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Read-only admin view of a campaign's split-proceeds configuration (spec §17):
 * the active split's beneficiaries + shares + consent, the version history, and
 * per-beneficiary balances (populated only once the flag is on and money has
 * accrued). Gracefully shows nothing for campaigns with no split.
 */
export default function SplitProceedsSection({ campaignId }: { campaignId: string }) {
  const [disclosure, setDisclosure] = useState<CampaignSplitDisclosure | null>(null)
  const [versions, setVersions] = useState<CampaignSplitVersion[]>([])
  const [balances, setBalances] = useState<CampaignBeneficiaryBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [d, v, b] = await Promise.allSettled([
        api.get<CampaignSplitDisclosure | null>(`/campaigns/${campaignId}/split`),
        api.get<CampaignSplitVersion[]>(`/campaigns/${campaignId}/split/versions`),
        api.get<CampaignBeneficiaryBalance[]>(`/campaigns/${campaignId}/split/beneficiaries`),
      ])
      if (cancelled) return
      setDisclosure(d.status === 'fulfilled' ? d.value : null)
      setVersions(v.status === 'fulfilled' && Array.isArray(v.value) ? v.value : [])
      setBalances(b.status === 'fulfilled' && Array.isArray(b.value) ? b.value : [])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [campaignId])

  if (loading) {
    return (
      <Box sx={{ borderBottom: `1px solid ${B}`, p: 2.5 }}>
        <Label>Split-proceeds</Label>
        <Box sx={{ height: 14, width: '40%', bgcolor: 'rgba(255,255,255,0.04)' }} />
      </Box>
    )
  }

  const hasSplit = Boolean(disclosure) || versions.length > 0

  return (
    <>
      <Box sx={{ borderBottom: `1px solid ${B}`, p: 2.5 }}>
        <Label>Split-proceeds</Label>
        {!hasSplit && (
          <EmptyState variant="noData" title="No split configured" description="This campaign pays out to a single recipient." compact />
        )}

        {disclosure && (
          <Box sx={{ mb: versions.length || balances.length ? 3 : 0 }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#8A8AA0', mb: 1 }}>
              Active split · v{disclosure.version}
              {disclosure.locked ? ' · locked' : ''}
            </Typography>
            {disclosure.beneficiaries.map((bene, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderTop: i ? `1px solid ${B}` : undefined }}>
                <Typography sx={{ fontSize: '0.85rem', color: '#E6E6F0' }}>{bene.name}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '0.85rem', color: '#E6E6F0' }}>{bene.sharePercent}%</Typography>
                  <Chip
                    label={bene.consent}
                    size="small"
                    sx={{ color: CONSENT_COLOR[bene.consent] ?? '#8A8AA0', bgcolor: 'transparent', border: `1px solid ${CONSENT_COLOR[bene.consent] ?? '#8A8AA0'}`, fontSize: '0.6rem' }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {balances.length > 0 && (
          <Box sx={{ mb: versions.length ? 3 : 0 }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#8A8AA0', mb: 1 }}>Beneficiary balances</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1 }}>
              {balances.map((bal) => (
                <Box key={bal.beneficiaryId} sx={{ p: 1.5, border: `1px solid ${B}` }}>
                  <Typography sx={{ fontSize: '0.7rem', color: '#8A8AA0', wordBreak: 'break-all' }}>{bal.beneficiaryId}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#E6E6F0', mt: 0.5 }}>
                    Pending {money(bal.pendingBalance, bal.currency)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#E6E6F0' }}>
                    Available {money(bal.availableBalance, bal.currency)} · Paid {money(bal.paidOutBalance, bal.currency)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {versions.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#8A8AA0', mb: 1 }}>Versions</Typography>
            {versions.map((ver) => (
              <Box key={ver.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#E6E6F0' }}>
                  v{ver.version} · {ver.allocations.length} beneficiaries{ver.locked ? ' · locked' : ''}
                </Typography>
                <Chip
                  label={ver.status}
                  size="small"
                  sx={{ color: STATUS_COLOR[ver.status] ?? '#8A8AA0', bgcolor: 'transparent', border: `1px solid ${STATUS_COLOR[ver.status] ?? '#8A8AA0'}`, fontSize: '0.6rem' }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </>
  )
}
