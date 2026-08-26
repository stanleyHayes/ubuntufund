import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import CampaignIcon from '@mui/icons-material/Campaign'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { ItemNotFound } from '@ubuntu-fund/ui'
import { keyframes } from '@mui/material/styles'
import PageHeader from '@/components/PageHeader'
import { api } from '@/lib/api'

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed'

interface DisputeDetail {
  id: string
  campaignId: string
  campaignTitle: string
  reporterId: string
  reporterName: string
  assigneeName?: string
  reason: string
  description?: string
  status: DisputeStatus
  resolution?: string
  resolvedBy?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<DisputeStatus, { color: 'warning' | 'info' | 'success' | 'default' }> = {
  open: { color: 'warning' },
  under_review: { color: 'info' },
  resolved: { color: 'success' },
  dismissed: { color: 'default' },
}

const formatStatus = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : 'Not recorded'

export default function DisputeDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [dispute, setDispute] = useState<DisputeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [resolutionType, setResolutionType] = useState<'resolved' | 'dismissed'>('resolved')
  const [submitting, setSubmitting] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  useEffect(() => {
    let cancelled = false
    if (!id) {
      setLoading(false)
      return
    }
    api.get<DisputeDetail>(`/disputes/${id}`)
      .then((result) => {
        if (!cancelled) setDispute(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load dispute.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  async function handleSubmitResolution() {
    if (!id || !resolutionNotes.trim()) {
      setSnackbar({ open: true, message: 'Resolution notes are required.', severity: 'error' })
      return
    }
    setSubmitting(true)
    try {
      const updated = await api.put<DisputeDetail>(`/disputes/${id}/resolve`, {
        status: resolutionType,
        resolution: resolutionNotes.trim(),
      })
      setDispute(updated)
      setResolutionNotes('')
      setSnackbar({ open: true, message: 'Resolution recorded.', severity: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: error instanceof Error ? error.message : 'Unable to resolve dispute.', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
  }

  if (!dispute) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}
        <ItemNotFound itemType="Dispute" onBack={() => navigate('/disputes')} backLabel="Back to Disputes" />
      </Box>
    )
  }

  const isClosed = dispute.status === 'resolved' || dispute.status === 'dismissed'

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto', animation: `${fadeSlide} 0.4s ease both` }}>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
        <Link underline="hover" color="text.secondary" sx={{ cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => navigate('/disputes')}>
          Disputes
        </Link>
        <Typography sx={{ fontSize: '0.85rem' }}>Dispute #{dispute.id}</Typography>
      </Breadcrumbs>

      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety · Dispute"
        title={dispute.reason}
        lede="Review the persisted report and campaign context, then record the decision."
        icon={<GavelRoundedIcon />}
        actions={<Chip label={formatStatus(dispute.status)} color={STATUS_CONFIG[dispute.status].color} size="small" sx={{ fontWeight: 700 }} />}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' }, gap: 3 }}>
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Dispute details</Typography>
              <Typography sx={{ color: 'text.secondary', lineHeight: 1.7, mb: 3 }}>
                {dispute.description || 'No additional description was supplied.'}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Reported by</Typography>
                  <Typography>{dispute.reporterName}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Assigned to</Typography>
                  <Typography>{dispute.assigneeName || 'Unassigned'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Created</Typography>
                  <Typography>{formatDate(dispute.createdAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Last updated</Typography>
                  <Typography>{formatDate(dispute.updatedAt)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {isClosed ? (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircleOutlineIcon color="success" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{formatStatus(dispute.status)}</Typography>
                </Box>
                <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{dispute.resolution || 'No resolution note was recorded.'}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                  Resolved {formatDate(dispute.resolvedAt)}{dispute.resolvedBy ? ` · operator ${dispute.resolvedBy}` : ''}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Record decision</Typography>
                <TextField label="Resolution notes" value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} fullWidth multiline rows={5} sx={{ mb: 2 }} />
                <TextField select label="Decision" value={resolutionType} onChange={(event) => setResolutionType(event.target.value as 'resolved' | 'dismissed')} fullWidth size="small" sx={{ mb: 3 }}>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="dismissed">Dismissed</MenuItem>
                </TextField>
                <Button variant="contained" onClick={handleSubmitResolution} disabled={submitting}>
                  {submitting ? 'Saving…' : 'Record decision'}
                </Button>
              </CardContent>
            </Card>
          )}
        </Box>

        <Card sx={{ alignSelf: 'start' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CampaignIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Related campaign</Typography>
            </Box>
            <Link underline="hover" sx={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => navigate(`/campaigns/${dispute.campaignId}`)}>
              {dispute.campaignTitle}
            </Link>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Open the campaign to review its real goal, raised total, donors, updates, and moderation controls.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((state) => ({ ...state, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((state) => ({ ...state, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
