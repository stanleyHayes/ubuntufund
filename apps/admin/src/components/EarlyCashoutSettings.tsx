import { Skeleton, Stack } from '@mui/material'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { useEffect, useState } from 'react'
import { Alert, Box, Button, Typography } from '@mui/material'
import { api } from '@/lib/api'
export function EarlyCashoutSettings({ canEdit }: { canEdit: boolean }) {
  const [percent, setPercent] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api
      .get<{ resolved: { earlyFeePercent: number } }>('/admin/commercial-config')
      .then((r) => {
        if (active) setPercent(String(r.resolved.earlyFeePercent))
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])
  async function save() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await api.put('/admin/commercial-config/earlyFeePercent', {
        value: Number(percent),
        reason: 'Early cashout surcharge updated from platform settings',
      })
      setMessage('Early cashout surcharge saved. New requests use this rate.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save surcharge.')
    } finally {
      setBusy(false)
    }
  }
  if (loading)
    return (
      <Stack aria-label="Loading settings" spacing={2} sx={{ p: 3, my: 3 }}>
        <Skeleton width="45%" height={32} />
        <Skeleton width="90%" />
        <Skeleton variant="rounded" height={56} />
        <Skeleton width={180} height={48} />
      </Stack>
    )
  if (error && !percent)
    return (
      <Alert
        severity="error"
        sx={{ my: 3 }}
        action={<Button onClick={() => setRetry((value) => value + 1)}>Retry</Button>}
      >
        {error}
      </Alert>
    )

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        my: 3,
        boxShadow: 'var(--neu-raised)',
        borderRadius: 3,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="h6">Early cashout surcharge</Typography>
      <Typography variant="body2" sx={{ my: 2 }}>
        Before a campaign ends or reaches its goal, cashout requires an additional fee. Choosing
        standard cashout cannot bypass this surcharge.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <TextField
        fullWidth
        label="Additional early cashout (%)"
        type="number"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        disabled={!canEdit || busy}
        slotProps={{ htmlInput: { min: 0, max: 100, step: 0.1 } }}
      />
      <Button
        onClick={() => void save()}
        disabled={
          !canEdit ||
          busy ||
          !percent ||
          !Number.isFinite(Number(percent)) ||
          Number(percent) < 0 ||
          Number(percent) > 100
        }
      >
        Save surcharge
      </Button>
    </Box>
  )
}
