import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import DeleteIcon from '@mui/icons-material/Delete'
import { SHAPE } from '@ubuntu-fund/ui'
import type { CampaignUpdate, CampaignUpdateType } from '@ubuntu-fund/types'
import { useCampaignUpdates, useDeleteCampaignUpdate, usePinCampaignUpdate } from '@/hooks/useCampaignUpdates'

interface CampaignUpdatesProps {
  campaignId: string
  isCreator: boolean
}

function getUpdateTypeColor(type: CampaignUpdateType): 'primary' | 'success' | 'warning' | 'error' {
  switch (type) {
    case 'milestone':
      return 'success'
    case 'thank_you':
      return 'primary'
    case 'urgent':
      return 'error'
    case 'general':
    default:
      return 'primary'
  }
}

function getUpdateTypeLabel(type: CampaignUpdateType): string {
  switch (type) {
    case 'milestone':
      return 'Milestone'
    case 'thank_you':
      return 'Thank You'
    case 'urgent':
      return 'Urgent'
    case 'general':
    default:
      return 'General'
  }
}

export function CampaignUpdates({ campaignId, isCreator }: CampaignUpdatesProps) {
  const { updates, isLoading, error } = useCampaignUpdates(campaignId)
  const { deleteUpdate, isLoading: isDeleting } = useDeleteCampaignUpdate()
  const { pin, isLoading: isPinning } = usePinCampaignUpdate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null)

  const handleDeleteClick = (updateId: string) => {
    setSelectedUpdateId(updateId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedUpdateId) return
    const success = await deleteUpdate(campaignId, selectedUpdateId)
    if (success) {
      setDeleteDialogOpen(false)
      setSelectedUpdateId(null)
      window.location.reload()
    }
  }

  const handlePin = async (updateId: string, currentlyPinned: boolean) => {
    if (currentlyPinned) {
      // Unpin not implemented in the hook, so we'd need to update the API to support it
      return
    }
    const success = await pin(campaignId, updateId)
    if (success) {
      window.location.reload()
    }
  }

  if (isLoading) {
    return (
      <Stack spacing={2}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              p: 3,
              bgcolor: 'grey.50',
              borderRadius: SHAPE.card,
            }}
          >
            <Skeleton width="40%" height={24} sx={{ mb: 1 }} />
            <Skeleton width="100%" height={16} sx={{ mb: 1 }} />
            <Skeleton width="90%" height={16} sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
              <Skeleton width={100} height={24} />
              <Skeleton width={60} height={24} />
            </Box>
          </Box>
        ))}
      </Stack>
    )
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load updates: {error}
      </Alert>
    )
  }

  if (updates.length === 0) {
    return (
      <Box
        sx={{
          py: 6,
          textAlign: 'center',
          bgcolor: 'grey.50',
          borderRadius: SHAPE.card,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          No updates yet. {isCreator && 'Post an update to share progress with your supporters!'}
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <Stack spacing={2}>
        {updates.map((update) => (
          <Box
            key={update.id}
            sx={{
              p: 3,
              bgcolor: 'grey.50',
              borderRadius: SHAPE.card,
              borderLeft: update.isPinned ? '4px solid' : 'none',
              borderLeftColor: 'primary.main',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'grey.100',
              },
            }}
          >
            {/* Header with title and badge */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                {update.isPinned && (
                  <Chip
                    label="Pinned"
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mr: 1, mb: 1 }}
                  />
                )}
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {update.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip
                    label={getUpdateTypeLabel(update.type)}
                    size="small"
                    color={getUpdateTypeColor(update.type)}
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(update.createdAt).toLocaleDateString()} at{' '}
                    {new Date(update.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </Box>
              </Box>

              {/* Action buttons - only show for creator */}
              {isCreator && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => handlePin(update.id, update.isPinned)}
                    disabled={isPinning}
                    title={update.isPinned ? 'Pinned' : 'Pin this update'}
                    sx={{
                      color: update.isPinned ? 'primary.main' : 'text.secondary',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    {update.isPinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteClick(update.id)}
                    disabled={isDeleting}
                    title="Delete this update"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'error.main',
                        bgcolor: 'rgba(244,67,54,0.08)',
                      },
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              )}
            </Box>

            {/* Content */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {update.content}
            </Typography>

            {/* Media URLs */}
            {update.mediaUrls && update.mediaUrls.length > 0 && (
              <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1 }}>
                {update.mediaUrls.map((url, idx) => (
                  <Box
                    key={idx}
                    component="img"
                    src={url}
                    alt={`Update media ${idx + 1}`}
                    sx={{
                      width: '100%',
                      height: 150,
                      objectFit: 'cover',
                      borderRadius: SHAPE.sm,
                      cursor: 'pointer',
                      '&:hover': {
                        opacity: 0.8,
                      },
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Stack>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Update</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this update? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={isDeleting}
            onClick={handleDeleteConfirm}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
