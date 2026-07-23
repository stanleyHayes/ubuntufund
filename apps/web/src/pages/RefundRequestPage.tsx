import { useState, useEffect } from 'react'
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { formatCurrency, ItemNotFound, SHAPE } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

const REFUND_REASONS = [
  'Campaign not delivering',
  'Changed my mind',
  'Duplicate donation',
  'Other',
]

// ---------------------------------------------------------------------------
// RefundRequestPage
// ---------------------------------------------------------------------------

export function RefundRequestPage() {
  const { donationId } = useParams<{ donationId: string }>()
  const navigate = useNavigate()
  const [donation, setDonation] = useState<{ campaignName: string; amount: number; currency: string; date: string; paymentMethod: string } | null>(null)

  useEffect(() => {
    if (!donationId) return
    api.get<{ campaignName: string; amount: number; currency: string; date: string; paymentMethod: string }>(`/donations/${donationId}`)
      .then(setDonation)
      .catch(() => setDonation(null))
  }, [donationId])

  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [refundId, setRefundId] = useState('')

  if (!donation) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound
          itemType="Donation"
          message="This donation was not found or is not eligible for a refund."
          onBack={() => navigate('/my-donations')}
        />
      </Container>
    )
  }

  async function handleSubmit() {
    setConfirmOpen(false)
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await api.post<{ id: string; status: string }>('/refunds', {
        donationId,
        reason,
        description,
      })
      setRefundId(result.id)
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit refund request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Box sx={{ bgcolor: '#FAFAF5', minHeight: '100vh', py: 8 }}>
        <Container maxWidth="sm">
          <Box
            sx={{
              p: 4,
              borderRadius: SHAPE.card,
              bgcolor: 'background.paper',
              border: '1px solid rgba(0,0,0,0.06)',
              textAlign: 'center',
            }}
          >
            <CheckCircleRoundedIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.3rem', mb: 1 }}>
              Refund Request Submitted
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 3 }}>
              Your refund request has been submitted successfully.
            </Typography>
            <Box sx={{ p: 2.5, borderRadius: SHAPE.card, bgcolor: 'rgba(46,125,50,0.04)', mb: 3 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 1 }}>
                Refund ID: <Box component="span" sx={{ fontFamily: 'monospace' }}>{refundId}</Box>
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                Expected processing time: 5-7 business days
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                Refund amount: {formatCurrency(donation.amount * 0.98, donation.currency)} (after 2% processing fee)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button component={RouterLink} to="/refunds" variant="outlined" sx={{ borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 600 }}>
                View My Refunds
              </Button>
              <Button component={RouterLink} to="/donations" variant="contained" sx={{ borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 600 }}>
                Back to Donations
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: '#FAFAF5', minHeight: '100vh', py: 5 }}>
      <Container maxWidth="sm">
        <Button
          component={RouterLink}
          to="/donations"
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ mb: 3, textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
        >
          Back to Donations
        </Button>

        <Typography
          sx={{
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 900,
            fontSize: '1.5rem',
            mb: 3,
          }}
        >
          Request a Refund
        </Typography>

        {/* Donation Details */}
        <Box
          sx={{
            p: 3,
            borderRadius: SHAPE.card,
            bgcolor: 'background.paper',
            border: '1px solid rgba(0,0,0,0.06)',
            mb: 3,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Donation Details
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>Campaign</Typography>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 600 }}>{donation.campaignName}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>Amount</Typography>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: '"TT Squares", monospace' }}>
                {formatCurrency(donation.amount, donation.currency)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>Date</Typography>
              <Typography sx={{ fontSize: '0.88rem' }}>
                {new Date(donation.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>Payment Method</Typography>
              <Typography sx={{ fontSize: '0.88rem' }}>{donation.paymentMethod}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Refund Policy */}
        <Alert severity="info" sx={{ mb: 3, borderRadius: SHAPE.card }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}>Refund Policy</Typography>
          <Typography sx={{ fontSize: '0.78rem' }}>
            Refunds are subject to a 2% processing fee. Refunds typically process within 5-7 business days.
          </Typography>
        </Alert>

        {/* Submit Error */}
        {submitError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: SHAPE.card }}>
            {submitError}
          </Alert>
        )}

        {/* Refund Form */}
        <Box
          sx={{
            p: 3,
            borderRadius: SHAPE.card,
            bgcolor: 'background.paper',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              select
              label="Reason for Refund"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
            >
              {REFUND_REASONS.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={4}
              fullWidth
              placeholder="Please provide additional details about your refund request..."
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
              <Chip
                label={`Refund amount: ${formatCurrency(donation.amount * 0.98, donation.currency)}`}
                sx={{ fontWeight: 600, fontSize: '0.8rem', bgcolor: 'rgba(0,0,0,0.04)' }}
              />
              <Button
                variant="contained"
                color="primary"
                disabled={!reason || !description || submitting}
                onClick={() => setConfirmOpen(true)}
                sx={{ borderRadius: SHAPE.sm, px: 4, textTransform: 'none', fontWeight: 700 }}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Confirmation Dialog */}
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Confirm Refund Request</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1 }}>
              Are you sure you want to request a refund of{' '}
              <strong>{formatCurrency(donation.amount * 0.98, donation.currency)}</strong> for your donation to{' '}
              <strong>{donation.campaignName}</strong>?
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
              A 2% processing fee will be deducted from the refund amount.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" color="primary" onClick={handleSubmit} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Confirm Refund
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  )
}
