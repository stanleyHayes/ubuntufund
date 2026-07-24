import { useState, useMemo, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import PhoneAndroidRoundedIcon from '@mui/icons-material/PhoneAndroidRounded'
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded'
import CurrencyBitcoinRoundedIcon from '@mui/icons-material/CurrencyBitcoinRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import { keyframes } from '@mui/material/styles'
import { api } from '@/lib/api'
import { useAdminPaymentProviders } from '@/hooks/useApiData'
import type { PaymentProvider } from '@/hooks/useMockData'
import { SHAPE, AiWritingBar } from '@ubuntu-fund/ui'
import { AiWritingAction } from '@ubuntu-fund/types'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Constants ───────────────────────────────────────────────────────────────

const B = 'rgba(255,255,255,0.06)'

const TYPE_COLORS: Record<PaymentProvider['type'], string> = {
  mobile_money: '#5E8F72',
  card: '#74909A',
  bank: '#D3A95C',
  crypto: '#FF7043',
  wallet: '#5E8F72',
}

const TYPE_LABELS: Record<PaymentProvider['type'], string> = {
  mobile_money: 'Mobile Money',
  card: 'Card',
  bank: 'Bank',
  crypto: 'Crypto',
  wallet: 'Wallet',
}

const TYPE_ICONS: Record<PaymentProvider['type'], React.ReactNode> = {
  wallet: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 20 }} />,
  mobile_money: <PhoneAndroidRoundedIcon sx={{ fontSize: 20 }} />,
  card: <CreditCardRoundedIcon sx={{ fontSize: 20 }} />,
  bank: <AccountBalanceRoundedIcon sx={{ fontSize: 20 }} />,
  crypto: <CurrencyBitcoinRoundedIcon sx={{ fontSize: 20 }} />,
}

// ─── Components ──────────────────────────────────────────────────────────────

export default function PaymentProvidersPage() {
  const { data: initialProviders } = useAdminPaymentProviders()
  const [providers, setProviders] = useState<PaymentProvider[]>(initialProviders)
  const [editTarget, setEditTarget] = useState<PaymentProvider | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PaymentProvider | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Keep local state in sync when API/mock data loads
  useMemo(() => {
    if (initialProviders.length && providers.length === 0) {
      setProviders(initialProviders)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProviders])

  const stats = useMemo(() => {
    const total = providers.length
    const active = providers.filter((p) => p.enabled).length
    const inactive = total - active
    const defaultCount = providers.filter((p) => p.isDefault).length
    return { total, active, inactive, default: defaultCount }
  }, [providers])

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity })
  }, [])

  async function handleToggle(provider: PaymentProvider) {
    const nextEnabled = !provider.enabled
    // Optimistic update
    setProviders((prev) =>
      prev.map((p) => (p.id === provider.id ? { ...p, enabled: nextEnabled } : p))
    )
    try {
      await api.patch(`/payment-providers/${provider.id}/toggle`)
      showSnackbar(`${provider.name} ${nextEnabled ? 'enabled' : 'disabled'}`, 'success')
    } catch {
      // Rollback on error
      setProviders((prev) =>
        prev.map((p) => (p.id === provider.id ? { ...p, enabled: provider.enabled } : p))
      )
      showSnackbar(`Failed to toggle ${provider.name}`, 'error')
    }
  }

  function handleDelete() {
    if (!deleteTarget || deleteTarget.isDefault) return
    setProviders((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    showSnackbar(`Payment provider "${deleteTarget.name}" deleted.`, 'success')
    setDeleteTarget(null)
  }

  function handleSaveEdit(updated: PaymentProvider) {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id !== updated.id) return p
        // If setting as default, unset others
        if (updated.isDefault && !p.isDefault) {
          return updated
        }
        return updated
      }).map((p) => (updated.isDefault && p.id !== updated.id ? { ...p, isDefault: false } : p))
    )
    showSnackbar(`Payment provider "${updated.name}" updated.`, 'success')
    setEditTarget(null)
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <AccountBalanceRoundedIcon sx={{ color: '#5E8F72', fontSize: 28 }} />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Payment Providers
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', ml: 5.5 }}>
            Enable, disable, and configure platform payment integrations
          </Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: '1px',
          bgcolor: B,
          border: `1px solid ${B}`,
          borderRadius: '12px',
          overflow: 'hidden',
          mb: 3,
          animation: `${fadeSlide} 0.3s ease both`,
        }}
      >
        {[
          { label: 'Total Providers', value: stats.total, color: '#74909A' },
          { label: 'Active', value: stats.active, color: '#5E8F72' },
          { label: 'Inactive', value: stats.inactive, color: '#C06B58' },
          { label: 'Default', value: stats.default, color: '#D3A95C' },
        ].map((stat) => (
          <Box
            key={stat.label}
            sx={{
              bgcolor: 'background.paper',
              py: 2,
              px: 2.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, lineHeight: 1 }}>
                {stat.value}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', letterSpacing: '0.3px' }}>
                {stat.label}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Cards Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
          gap: 2.5,
        }}
      >
        {providers.map((provider, index) => {
          const color = TYPE_COLORS[provider.type]
          const icon = TYPE_ICONS[provider.type]
          return (
            <Card
              key={provider.id}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                animation: `${fadeSlide} 0.4s ease ${index * 0.06}s both`,
                transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                border: '1px solid',
                borderColor: provider.enabled ? 'divider' : 'rgba(192,107,88,0.2)',
                opacity: provider.enabled ? 1 : 0.6,
                '&:hover': {
                  borderColor: `${color}40`,
                  boxShadow: `0 2px 10px ${color}18`,
                },
              }}
            >
              {/* Top accent strip */}
              <Box sx={{ height: 3, background: color }} />

              <Box sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      bgcolor: `${color}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color,
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.3 }}>
                        {provider.name}
                      </Typography>
                      {provider.isDefault && (
                        <Chip
                          label="Default"
                          size="small"
                          sx={{
                            bgcolor: `${color}15`,
                            color,
                            fontWeight: 700,
                            fontSize: '0.6rem',
                            height: 20,
                          }}
                        />
                      )}
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.68rem',
                        color: 'text.secondary',
                        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        mt: 0.25,
                      }}
                    >
                      {provider.slug}
                    </Typography>
                  </Box>
                </Box>

                {/* Type chip */}
                <Chip
                  size="small"
                  label={TYPE_LABELS[provider.type]}
                  sx={{
                    mb: 2,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: `${color}15`,
                    color,
                    border: '1px solid',
                    borderColor: `${color}30`,
                    width: 'fit-content',
                    '& .MuiChip-icon': { color: 'inherit', fontSize: '14px !important' },
                  }}
                />

                {/* Fee */}
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 2 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color }}>
                    {provider.feePercent}%
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>fee</Typography>
                </Box>

                {/* Status */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Chip
                    label={provider.enabled ? 'Active' : 'Inactive'}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      bgcolor: provider.enabled ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.04)',
                      color: provider.enabled ? '#5E8F72' : 'text.secondary',
                    }}
                  />
                </Box>

                <Divider sx={{ my: 1.5, borderColor: B }} />

                {/* Actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={provider.enabled}
                        onChange={() => handleToggle(provider)}
                        size="small"
                      />
                    }
                    label={
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {provider.enabled ? 'Enabled' : 'Disabled'}
                      </Typography>
                    }
                    sx={{ mr: 0 }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <Tooltip title="Edit provider" arrow>
                      <IconButton
                        size="small"
                        onClick={() => setEditTarget(provider)}
                        sx={{ color: 'text.secondary', '&:hover': { color: '#5E8F72', bgcolor: 'rgba(76,175,80,0.08)' } }}
                      >
                        <EditRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={provider.isDefault ? 'Default provider cannot be deleted' : 'Delete provider'} arrow>
                      <span>
                        <IconButton
                          size="small"
                          disabled={provider.isDefault}
                          onClick={() => setDeleteTarget(provider)}
                          sx={{
                            color: 'text.secondary',
                            '&:hover': { color: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
                            '&.Mui-disabled': { color: 'rgba(255,255,255,0.08)' },
                          }}
                        >
                          <DeleteRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            </Card>
          )
        })}
      </Box>

      {/* Edit Dialog */}
      {editTarget && (
        <EditProviderDialog
          provider={editTarget}
          open
          onClose={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            border: `1px solid ${B}`,
            maxWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                bgcolor: 'rgba(192,107,88,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DeleteRoundedIcon sx={{ fontSize: 18, color: '#C06B58' }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Delete Provider</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.88rem', lineHeight: 1.6 }}>
            Are you sure you want to delete <strong style={{ color: '#E0E0E8' }}>{deleteTarget?.name}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            sx={{ bgcolor: '#C06B58', '&:hover': { bgcolor: '#A5432F' } }}
          >
            Delete Provider
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ─── Edit Dialog ───────────────────────────────────────────────────────────────

function EditProviderDialog({
  provider,
  open,
  onClose,
  onSave,
}: {
  provider: PaymentProvider
  open: boolean
  onClose: () => void
  onSave: (p: PaymentProvider) => void
}) {
  const [name] = useState(provider.name)
  const [feePercent, setFeePercent] = useState(String(provider.feePercent))
  const [configJson, setConfigJson] = useState('{}')
  const [enabled, setEnabled] = useState(provider.enabled)
  const [isDefault, setIsDefault] = useState(provider.isDefault)
  const [configError, setConfigError] = useState<string | null>(null)

  const isSeeded = provider.id === '1' || provider.id === '2' || provider.id === '3' || provider.id === '4' || provider.id === '5' || provider.id === '6' || provider.id === '7'

  function handleSave() {
    try {
      JSON.parse(configJson)
    } catch {
      setConfigError('Invalid JSON')
      return
    }
    setConfigError(null)
    onSave({
      ...provider,
      feePercent: parseFloat(feePercent) || 0,
      enabled,
      isDefault,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          border: `1px solid ${B}`,
          borderRadius: SHAPE.card,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>Edit Provider</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
          <TextField
            label="Name"
            value={name}
            disabled={isSeeded}
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.03)',
              },
            }}
          />
          <TextField
            label="Fee Percent"
            type="number"
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ step: 0.1, min: 0 }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.03)',
              },
            }}
          />
          <AiWritingBar
            value={configJson}
            onChange={(v) => { setConfigJson(v); setConfigError(null) }}
            inputLabel="Provider Configuration"
            allowedActions={[AiWritingAction.FIX_GRAMMAR, AiWritingAction.IMPROVE_CLARITY]}
          />
          <TextField
            label="Config JSON"
            multiline
            rows={4}
            value={configJson}
            onChange={(e) => {
              setConfigJson(e.target.value)
              setConfigError(null)
            }}
            error={!!configError}
            helperText={configError || 'Raw configuration object as JSON'}
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.03)',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              },
            }}
          />
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={<Typography sx={{ fontSize: '0.85rem' }}>Enabled</Typography>}
          />
          <FormControlLabel
            control={<Switch checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
            label={<Typography sx={{ fontSize: '0.85rem' }}>Set as default provider</Typography>}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} sx={{ borderRadius: SHAPE.sm }}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  )
}
