import { useEffect, useState } from 'react'
import { Alert, Avatar, Box, Button, Skeleton, Typography } from '@mui/material'
import { CurrencyDisplay, EmptyState, SHAPE } from '@ubuntu-fund/ui'
import type { CampaignDonation, PaginatedResponse } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

/** Uses the paginated donation endpoint; the campaign DTO contains no donations. */
export function CampaignDonationHistory({ campaignId }: { campaignId: string }) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<PaginatedResponse<CampaignDonation> | null>(null)
  const [error, setError] = useState('')
  const [loadedPage, setLoadedPage] = useState(0)
  const loading = loadedPage !== page

  useEffect(() => {
    let cancelled = false
    api.get<PaginatedResponse<CampaignDonation>>(`/campaigns/${campaignId}/donations?page=${page}&pageSize=10`)
      .then((data) => { if (!cancelled) { setResult(data); setError('') } })
      .catch((err: Error) => { if (!cancelled) setError(err.message || 'Could not load donations') })
      .finally(() => { if (!cancelled) setLoadedPage(page) })
    return () => { cancelled = true }
  }, [campaignId, page, revision])

  if (loading) return <Skeleton variant="rounded" height={180} />
  if (error) return <Alert severity="error" action={<Button color="inherit" onClick={() => { setLoadedPage(0); setRevision((n) => n + 1) }}>Retry</Button>}>{error}</Alert>
  if (!result?.items.length) return <EmptyState compact title="Support starts here" description="Completed contributions will appear here." />

  return <Box>
    <Typography component="h2" variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Donations ({result.total})</Typography>
    <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
      {result.items.map((donation) => <Box component="li" key={donation.id} sx={{ display: 'flex', gap: 1.5, p: 2, mb: 1.5, borderRadius: SHAPE.sm, bgcolor: 'background.paper', boxShadow: 'var(--neu-inset)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Avatar src={donation.isAnonymous ? undefined : donation.donorAvatarUrl} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 36, height: 36 }}>{donation.isAnonymous ? '?' : (donation.donorName || 'Supporter').charAt(0)}</Avatar>
        <Box sx={{ flex: 1, minWidth: 100, overflowWrap: 'anywhere' }}><Typography sx={{ fontWeight: 700 }}>{donation.isAnonymous ? 'Anonymous' : donation.donorName || 'Supporter'}</Typography>{donation.message && <Typography variant="body2" color="text.secondary">{donation.message}</Typography>}<Typography variant="caption" color="text.secondary">{new Date(donation.createdAt).toLocaleDateString()}</Typography></Box>
        <CurrencyDisplay amount={donation.amount} currency={donation.currency} sx={{ fontWeight: 700 }} />
      </Box>)}
    </Box>
    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
      <Typography variant="body2" color="text.secondary">Page {page} of {result.totalPages}</Typography>
      <Button disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
    </Box>
  </Box>
}
