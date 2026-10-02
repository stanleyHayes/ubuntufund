import { PublicationConsent } from '@/components/safety/PublicationConsent'
import { PublicationHeldNotice } from '@/components/safety/PublicationHeldNotice'
import { publicationHold, type PublicationHold } from '@/lib/publicationDrafts'
import { LoadingDots } from '@ubuntu-fund/ui'
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import type { CreateCampaignUpdateInput, CampaignUpdateType } from '@ubuntu-fund/types'

interface CreateUpdateDialogProps {
  open: boolean
  onClose: () => void
  isLoading: boolean
  onSubmit: (data: CreateCampaignUpdateInput) => Promise<void>
}

export function CreateUpdateDialog({
  open,
  onClose,
  isLoading,
  onSubmit,
}: CreateUpdateDialogProps) {
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<CampaignUpdateType>('general')
  const [isPinned, setIsPinned] = useState(false)
  const [error, setError] = useState('')
  // Held for safety review: shown as a notice. The fields are kept for posting it
  // again after approval, unless its approval posts it by itself.
  const [held, setHeld] = useState<PublicationHold | null>(null)
  const [success, setSuccess] = useState(false)
  // Nothing more to post: it was posted, or its approval will post it.
  const done = success || !!held?.publishesOnApproval

  function clearFields() {
    setTitle('')
    setAutomatedReviewConsent(false)
    setContent('')
    setType('general')
    setIsPinned(false)
  }

  function handleClose() {
    clearFields()
    setError('')
    setHeld(null)
    setSuccess(false)
    onClose()
  }

  async function handleSubmit() {
    if (title.trim().length < 3 || title.trim().length > 200) {
      setError('Use a title between 3 and 200 characters')
      return
    }

    if (!content.trim() || content.trim().length > 5000) {
      setError('Enter an update of up to 5,000 characters')
      return
    }

    setError('')
    setHeld(null)

    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        type,
        isPinned,
        automatedReviewConsent,
      })
      setSuccess(true)
      setTimeout(handleClose, 1000)
    } catch (err) {
      const hold = publicationHold(err)
      if (!hold) setError(err instanceof Error ? err.message : 'Failed to create update. Please try again.')
      else {
        setHeld(hold)
        if (hold.publishesOnApproval) clearFields()
      }
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Post an Update
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {success ? (
          <Alert severity="success">
            Update posted successfully!
          </Alert>
        ) : held?.publishesOnApproval ? (
          <PublicationHeldNotice {...held} />
        ) : (
          <>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Update Type
              </Typography>
              <TextField
                select
                value={type}
                onChange={(e) => setType(e.target.value as CampaignUpdateType)}
                fullWidth
                size="small"
                SelectProps={{ native: true }}
              >
                <option value="general">General Update</option>
                <option value="milestone">Milestone</option>
                <option value="thank_you">Thank You</option>
                <option value="urgent">Urgent</option>
              </TextField>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Title
              </Typography>
              <TextField
                value={title}
                inputProps={{ maxLength: 200 }}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (error) setError('')
                }}
                error={!!error && !title.trim()}
                helperText={error && !title.trim() ? error : ''}
                placeholder="Enter update title"
                fullWidth
                size="small"
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
                Content
              </Typography>
              <TextField
                value={content}
                inputProps={{ maxLength: 5000 }}
                onChange={(e) => {
                  setContent(e.target.value)
                  if (error) setError('')
                }}
                error={!!error && !content.trim()}
                helperText={error && !content.trim() ? error : ''}
                placeholder="Write your update here..."
                multiline
                rows={4}
                fullWidth
                size="small"
              />
            </Box>

            <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />
            <FormControlLabel
              control={
                <Checkbox
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
              }
              label="Pin this update to the top"
            />

            {error && <Alert severity="error">{error}</Alert>}
            {held && <PublicationHeldNotice {...held} retry="post it again unchanged" />}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          {done ? 'Close' : 'Cancel'}
        </Button>
        {!done && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || !title.trim() || !content.trim()}
          >
            {isLoading ? <><LoadingDots size={6} /> <span>Posting...</span></> : 'Post Update'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
