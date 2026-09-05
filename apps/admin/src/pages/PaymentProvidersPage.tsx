import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import Snackbar from '@mui/material/Snackbar'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import { useAdminPaymentProviders } from '@/hooks/useApiData'
import type { PaymentProvider } from '@/hooks/useMockData'
import { api } from '@/lib/api'
import PageHeader from '@/components/PageHeader'

export default function PaymentProvidersPage() {
  const { data, isLoading, error } = useAdminPaymentProviders()
  const [providers, setProviders] = useState<PaymentProvider[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null)

  useEffect(() => { setProviders(data) }, [data])

  const enabledCount = useMemo(() => providers.filter((provider) => provider.enabled).length, [providers])

  async function toggle(provider: PaymentProvider) {
    setBusyId(provider.id)
    try {
      const updated = await api.patch<PaymentProvider>(`/payment-providers/${provider.id}/toggle`)
      setProviders((current) => current.map((item) => item.id === provider.id ? updated : item))
      setMessage({ text: `${provider.name} ${updated.enabled ? 'enabled' : 'disabled'}.`, severity: 'success' })
    } catch (toggleError) {
      setMessage({ text: toggleError instanceof Error ? toggleError.message : `Unable to update ${provider.name}.`, severity: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader tone="green" eyebrow="Payments" title="Payment providers" lede="Review persisted provider state and enable only production-ready adapters." icon={<AccountBalanceRoundedIcon />} stats={[{ label: 'Configured', value: isLoading ? <Skeleton width={48} /> : error ? '—' : providers.length }, { label: 'Enabled', value: isLoading ? <Skeleton width={48} /> : error ? '—' : enabledCount }, { label: 'Disabled', value: isLoading ? <Skeleton width={48} /> : error ? '—' : providers.length - enabledCount }]} />

      <Alert severity="info" sx={{ mb: 3 }}>
        Provider definitions and credentials are deployment configuration. This console only toggles persisted availability; unsupported non-wallet adapters are rejected by the API even if an operator attempts to enable them.
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {isLoading ? (
        <Box aria-label="Loading payment providers" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {[0, 1, 2, 3].map((item) => <Box key={item} sx={{ ...raisedSurface, p: 3 }}><Skeleton width="55%" height={30} /><Skeleton height={72} sx={{ my: 2 }} /><Skeleton width="35%" /></Box>)}
        </Box>
      ) : providers.length === 0 ? (
        <Box sx={{ ...raisedSurface, p: 4, textAlign: 'center' }}><AccountBalanceRoundedIcon sx={{ color: 'primary.main', fontSize: 36, mb: 2 }} /><Typography variant="h6">{error ? 'Provider list unavailable' : 'No payment providers configured'}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{error ? 'Refresh the page to try again.' : 'Configured providers will appear here when they are added to the deployment.'}</Typography></Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
          {providers.map((provider) => (
            <Card key={provider.id} sx={raisedSurface}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    <Typography sx={{ fontWeight: 800 }}>{provider.name}</Typography>
                    {provider.isDefault && <Chip label="Default" size="small" color="primary" variant="filled" />}
                  </Box>
                  <Box sx={{ ...insetSurface, p: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                    <Box><Typography variant="caption" color="text.secondary">Provider type</Typography><Typography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: 600 }}>{provider.type.replace(/_/g, ' ')}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Configured fee</Typography><Typography sx={{ fontWeight: 700 }}>{provider.feePercent}%</Typography></Box>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Chip label={busyId === provider.id ? 'Updating…' : provider.enabled ? 'Enabled' : 'Disabled'} color={provider.enabled ? 'success' : 'default'} size="small" />
                  <Switch checked={provider.enabled} disabled={busyId !== null} onChange={() => toggle(provider)} inputProps={{ 'aria-label': `Toggle ${provider.name}` }} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Snackbar open={Boolean(message)} autoHideDuration={message?.severity === 'error' ? null : 4000} onClose={() => setMessage(null)}>
        <Alert severity={message?.severity ?? 'success'} variant="filled" onClose={() => setMessage(null)}>{message?.text}</Alert>
      </Snackbar>
    </Box>
  )
}
