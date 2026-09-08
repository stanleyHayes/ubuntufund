import { useEffect, useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, Typography } from '@mui/material'
import type { CampaignSplitVersion } from '@ubuntu-fund/types'
import { SHAPE } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

/** Owner-only UI; the API also checks ownership and the current plan. */
export function CampaignSplitSetup({ campaignId }: { campaignId: string }) {
  const [versions, setVersions] = useState<CampaignSplitVersion[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let cancelled = false
    api.get<CampaignSplitVersion[]>(`/campaigns/${campaignId}/split/versions`).then(data => { if (!cancelled) setVersions(data) }).catch(() => { if (!cancelled) setError('Could not load split setup.') })
    return () => { cancelled = true }
  }, [campaignId, refresh])
  const version = [...versions].sort((a, b) => b.version - a.version)[0]
  async function update(path: string, payload: object) {
    setBusy(true); setError('')
    try {
      const updated = await api.post<CampaignSplitVersion>(path, payload)
      setVersions(items => items.map(item => item.version === updated.version ? updated : item))
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update split setup.') }
    finally { setBusy(false) }
  }
  if (!version && !error) return null
  return <Box sx={{ mt: 3, p: 3, textAlign: 'left', borderRadius: SHAPE.card, border: '1px solid', borderColor: 'divider' }}>
    <Typography variant="h6">Split proceeds {version ? `· ${version.status}` : ''}</Typography>
    {error && <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={() => { setError(''); setRefresh(value => value + 1) }}>Reload</Button>}>{error}</Alert>}
    {version && <>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Record acceptance only after receiving the beneficiary’s agreement to the allocation. All beneficiaries must accept before activation.</Typography>
      {version.allocations.map(allocation => <Box key={allocation.beneficiaryId} sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700 }}>{allocation.name} · {allocation.shareBps / 100}%</Typography>
        <Typography variant="body2" color="text.secondary">Consent: {allocation.consent}</Typography>
        {version.status === 'draft' && !version.locked && allocation.consent !== 'accepted' && <>
          <FormControlLabel control={<Checkbox checked={!!confirmed[allocation.beneficiaryId]} onChange={e => setConfirmed(state => ({ ...state, [allocation.beneficiaryId]: e.target.checked }))} />} label={`I have received ${allocation.name}’s acceptance`} />
          <Button disabled={busy || !confirmed[allocation.beneficiaryId]} onClick={() => update(`/campaigns/${campaignId}/split/${version.version}/consent`, { beneficiaryId: allocation.beneficiaryId, status: 'accepted' })}>Record acceptance</Button>
        </>}
      </Box>)}
      {version.status === 'draft' && <Button variant="contained" sx={{ mt: 2 }} disabled={busy || !version.allocations.every(item => item.consent === 'accepted')} onClick={() => update(`/campaigns/${campaignId}/split/${version.version}/activate`, {})}>Activate agreed split</Button>}
    </>}
  </Box>
}
