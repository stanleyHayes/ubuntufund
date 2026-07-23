import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { api } from '@/lib/api'

interface ReportCampaignDialogProps {
  open: boolean
  onClose: () => void
  campaignId: string
  campaignTitle: string
}

export function ReportCampaignDialog({
  open,
  onClose,
  campaignId,
  campaignTitle,
}: ReportCampaignDialogProps) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleClose() {
    setReason('')
    setDescription('')
    setError('')
    setSuccess(false)
    onClose()
  }

  async function handleSubmit() {
    if (!reason.trim()) {
      setError('Please select a reason for reporting')
      return
    }

    setLoading(true)
    setError('')

    try {
      await api.post(`/campaigns/${campaignId}/report`, {
        reason: reason.trim(),
        description: description.trim() || undefined,
      })
      setSuccess(true)
      setTimeout(handleClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Report Campaign
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Campaign: <strong>{campaignTitle}</strong>
        </Typography>

        {success ? (
          <Alert severity="success">
            Thank you for reporting this campaign. Our team will review it shortly.
          </Alert>
        ) : (
          <>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Reason for Report
              </Typography>
              <TextField
                select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (error) setError('')
                }}
                error={!!error && !reason}
                helperText={error && !reason ? error : ''}
                fullWidth
                size="small"
                SelectProps={{ native: true }}
              >
                <option value="">Select a reason</option>
                <option value="fraudulent">Fraudulent Activity</option>
                <option value="misleading">Misleading Information</option>
                <option value="inappropriate_content">Inappropriate Content</option>
                <option value="spam">Spam</option>
                <option value="illegal_activity">Illegal Activity</option>
                <option value="other">Other</option>
              </TextField>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Additional Details (Optional)
              </Typography>
              <TextField
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  if (error) setError('')
                }}
                placeholder="Provide any additional information about this report..."
                multiline
                rows={3}
                fullWidth
                size="small"
              />
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              Reports are reviewed by our moderation team. We appreciate your help in keeping our community safe.
            </Alert>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          {success ? 'Close' : 'Cancel'}
        </Button>
        {!success && (
          <Button
            variant="contained"
            color="error"
            onClick={handleSubmit}
            disabled={loading || !reason}
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
