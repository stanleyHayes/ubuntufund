import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, MenuItem, Skeleton, TextField, Typography } from '@mui/material'
import CurrencyExchangeRoundedIcon from '@mui/icons-material/CurrencyExchangeRounded'
import { LoadingDots } from '@ubuntu-fund/ui'
import type { CryptoAssetInfo } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

interface Availability { enabled: boolean; assets: CryptoAssetInfo[] }
interface Summary { scanned: number; settled: number; detected: number; failed: number; pending: number; errored: number }

export default function CryptoOperations() {
  const { user } = useAuth()
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [age, setAge] = useState(30)
  const [summary, setSummary] = useState<Summary | null>(null)
  async function refresh() {
    setLoading(true)
    setError(null)
    try { setAvailability(await api.get<Availability>('/payments/crypto/assets')) }
    catch (e) { setAvailability(null); setError(e instanceof Error ? e.message : 'Could not load crypto availability.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  async function reconcile() {
    if (busy || user?.role !== 'admin') return
    setBusy(true)
    setError(null)
    setSummary(null)
    try { setSummary(await api.post<Summary>('/admin/crypto/reconcile', { olderThanMinutes: age })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Reconciliation failed. Try again.') }
    finally { setBusy(false) }
  }
  return (
    <Box component="section" aria-label="Crypto contributions" sx={{ mb: 4, border: '1px solid', borderColor: 'divider', borderRadius: 4, overflow: 'hidden', bgcolor: 'background.paper' }}>
      <Box sx={{ p: { xs: 2.5, md: 3 }, bgcolor: '#1C261D', color: '#F5F2EA', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between' }}>
        <Box><CurrencyExchangeRoundedIcon sx={{ color: '#DCC07E', mb: 1 }} /><Typography variant="h5" sx={{ fontWeight: 800 }}>Crypto contributions</Typography><Typography sx={{ color: '#C5CCC2', mt: .5 }}>Checkout availability and delayed payment checks.</Typography></Box>
        <Chip label={loading ? 'Checking availability' : availability ? availability.enabled && availability.assets.length ? 'Offered at checkout' : 'Not offered at checkout' : 'Status unavailable'} sx={{ bgcolor: 'rgba(255,255,255,.12)', color: '#F5F2EA', alignSelf: 'start' }} />
      </Box>
      <Box sx={{ p: { xs: 2.5, md: 3 }, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 4 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, mb: .75 }}>Currencies & networks</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>These options come from the active provider configuration. Availability is managed by the deployment, not the switches below.</Typography>
          {loading ? <Skeleton variant="rounded" height={100} /> : availability?.assets.length ? availability.assets.map((asset) => (
            <Box key={asset.asset} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 750 }}>{asset.asset} <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>· {asset.label}</Box></Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .75, mt: 1 }}>{asset.networks.map((network) => <Chip key={network.id} size="small" variant="outlined" label={network.label} />)}</Box>
            </Box>
          )) : <Alert severity="info">{availability ? 'No crypto currencies are currently available to contributors.' : 'Availability could not be checked.'}</Alert>}
          <Button onClick={() => void refresh()} disabled={loading || busy} sx={{ mt: 1 }}>Refresh availability</Button>
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, mb: .75 }}>Check delayed deposits</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Checks up to 100 pending or processing deposits against the provider and applies confirmed status changes. This can credit confirmed contributions.</Typography>
          <TextField select fullWidth label="Check deposits older than" value={age} onChange={(e) => setAge(Number(e.target.value))} disabled={busy || user?.role !== 'admin'} sx={{ mb: 2 }}>{[15, 30, 60, 120].map((minutes) => <MenuItem key={minutes} value={minutes}>{minutes} minutes</MenuItem>)}</TextField>
          <Button variant="contained" onClick={() => void reconcile()} disabled={busy || user?.role !== 'admin'} startIcon={busy ? <LoadingDots size={6} /> : undefined} sx={{ minHeight: 48, borderRadius: '999px' }}>{busy ? 'Checking deposits…' : 'Reconcile deposits'}</Button>
          {user?.role !== 'admin' && <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>An administrator must run reconciliation.</Typography>}
          {summary && <Box role="status" sx={{ mt: 2 }}><Typography sx={{ fontWeight: 750, mb: 1 }}>Latest check results</Typography><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>{Object.entries(summary).map(([key, count]) => <Box key={key} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}><Typography sx={{ fontSize: '1.5rem', fontWeight: 800 }}>{count}</Typography><Typography sx={{ fontSize: '.75rem', textTransform: 'capitalize' }}>{key === 'errored' ? 'Check errors' : key}</Typography></Box>)}</Box>{summary.errored > 0 && <Alert severity="warning" sx={{ mt: 1 }}>Some provider checks failed. Review provider logs before retrying.</Alert>}</Box>}
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ mx: 3, mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
    </Box>
  )
}
