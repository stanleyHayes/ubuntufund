import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import Alert from '@mui/material/Alert'
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
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <PageHeader tone="green" eyebrow="Payments" title="Payment providers" lede="Review persisted provider state and enable only production-ready adapters." icon={<AccountBalanceRoundedIcon />} />

      <Alert severity="info" sx={{ mb: 3 }}>
        Provider definitions and credentials are deployment configuration. This console only toggles persisted availability; unsupported non-wallet adapters are rejected by the API even if an operator attempts to enable them.
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Chip label={`${providers.length} configured`} />
        <Chip label={`${enabledCount} enabled`} color={enabledCount ? 'success' : 'default'} />
      </Box>

      {isLoading ? (
        <Typography color="text.secondary">Loading payment providers…</Typography>
      ) : providers.length === 0 ? (
        <Typography color="text.secondary">No payment providers are configured.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 800 }}>{provider.name}</Typography>
                    {provider.isDefault && <Chip label="Default" size="small" color="primary" variant="outlined" />}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {provider.type.replace(/_/g, ' ')} · configured fee {provider.feePercent}%
                  </Typography>
                </Box>
                <Switch checked={provider.enabled} disabled={busyId === provider.id} onChange={() => toggle(provider)} inputProps={{ 'aria-label': `Toggle ${provider.name}` }} />
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Snackbar open={Boolean(message)} autoHideDuration={4000} onClose={() => setMessage(null)}>
        <Alert severity={message?.severity ?? 'success'} variant="filled" onClose={() => setMessage(null)}>{message?.text}</Alert>
      </Snackbar>
    </Box>
  )
}
