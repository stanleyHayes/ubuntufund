import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import DeleteIcon from '@mui/icons-material/Delete'
import { SHAPE } from '@ubuntu-fund/ui'
import type { CampaignCollaborator } from '@ubuntu-fund/types'
import { CollaboratorRole, CollaborationStatus } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

interface CollaboratorSectionProps {
  campaignId: string
  isOwner: boolean
  collaborators: CampaignCollaborator[]
}

function getRoleLabel(role: CollaboratorRole): string {
  switch (role) {
    case CollaboratorRole.CO_OWNER:
      return 'Co-Owner'
    case CollaboratorRole.EDITOR:
      return 'Editor'
    case CollaboratorRole.FEATURED_PARTNER:
      return 'Featured Partner'
    default:
      return role
  }
}

function getStatusColor(status: string): 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' {
  switch (status) {
    case CollaborationStatus.ACCEPTED:
      return 'success'
    case CollaborationStatus.PENDING:
      return 'warning'
    case CollaborationStatus.DECLINED:
      return 'error'
    case CollaborationStatus.REMOVED:
      return 'default'
    default:
      return 'default'
  }
}

export function CollaboratorSection({
  campaignId,
  isOwner,
  collaborators,
}: CollaboratorSectionProps) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>(CollaboratorRole.EDITOR)
  const [revenueShare, setRevenueShare] = useState('0')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [selectedCollaborator, setSelectedCollaborator] = useState<CampaignCollaborator | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const acceptedCollaborators = collaborators.filter(
    (c) => c.status === CollaborationStatus.ACCEPTED,
  )
  const pendingCollaborators = collaborators.filter(
    (c) => c.status === CollaborationStatus.PENDING,
  )

  const handleInviteOpen = () => {
    setInviteEmail('')
    setInviteRole(CollaboratorRole.EDITOR)
    setRevenueShare('0')
    setInviteMessage('')
    setInviteError('')
    setInviteOpen(true)
  }

  const handleInviteSubmit = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }

    setInviteLoading(true)
    setInviteError('')
    try {
      await api.post(`/campaigns/${campaignId}/collaborators/invite`, {
        userEmail: inviteEmail,
        role: inviteRole,
        revenueSharePercent: Number(revenueShare),
        inviteMessage: inviteMessage || undefined,
      })
      setInviteOpen(false)
      window.location.reload()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleDeleteClick = (collaborator: CampaignCollaborator) => {
    setSelectedCollaborator(collaborator)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedCollaborator) return

    setDeleteLoading(true)
    try {
      await api.delete(
        `/campaigns/${campaignId}/collaborators/${selectedCollaborator.id}`,
      )
      setDeleteConfirmOpen(false)
      window.location.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove collaborator')
      setDeleteConfirmOpen(false)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (acceptedCollaborators.length === 0 && pendingCollaborators.length === 0 && !isOwner) {
    return null
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Collaborators
        </Typography>
        {isOwner && (
          <Button variant="outlined" size="small" onClick={handleInviteOpen}>
            Invite Collaborator
          </Button>
        )}
      </Box>

      {acceptedCollaborators.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
            Active Collaborators
          </Typography>
          <Box sx={{ mb: 3 }}>
            {acceptedCollaborators.map((collaborator) => (
              <Box
                key={collaborator.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  mb: 1.5,
                  bgcolor: 'grey.50',
                  borderRadius: SHAPE.card,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <Avatar
                    src={collaborator.logoUrl}
                    sx={{
                      width: 44,
                      height: 44,
                      bgcolor: 'primary.main',
                      fontSize: '1rem',
                      fontWeight: 600,
                    }}
                  >
                    {collaborator.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                      {collaborator.displayName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip
                        label={getRoleLabel(collaborator.role)}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {collaborator.revenueSharePercent}% revenue share
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                {isOwner && (
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteClick(collaborator)}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        </>
      )}

      {pendingCollaborators.length > 0 && (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
            Pending Invitations
          </Typography>
          <Box sx={{ mb: 3 }}>
            {pendingCollaborators.map((collaborator) => (
              <Box
                key={collaborator.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  mb: 1.5,
                  bgcolor: 'grey.50',
                  borderRadius: SHAPE.card,
                  opacity: 0.7,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <Avatar
                    src={collaborator.logoUrl}
                    sx={{
                      width: 44,
                      height: 44,
                      bgcolor: 'action.disabled',
                      fontSize: '1rem',
                      fontWeight: 600,
                    }}
                  >
                    {collaborator.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                      {collaborator.displayName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip
                        label={getRoleLabel(collaborator.role)}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label="Pending"
                        size="small"
                        color={getStatusColor(collaborator.status)}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {collaborator.revenueSharePercent}% revenue share
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                {isOwner && (
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteClick(collaborator)}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        </>
      )}

      {acceptedCollaborators.length === 0 && pendingCollaborators.length === 0 && isOwner && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No collaborators yet. Invite collaborators to share responsibilities and revenue.
        </Alert>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Invite Collaborator</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            fullWidth
            placeholder="collaborator@example.com"
          />
          <TextField
            select
            label="Role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
            fullWidth
            SelectProps={{ native: true }}
          >
            <option value={CollaboratorRole.EDITOR}>{getRoleLabel(CollaboratorRole.EDITOR)}</option>
            <option value={CollaboratorRole.CO_OWNER}>{getRoleLabel(CollaboratorRole.CO_OWNER)}</option>
            <option value={CollaboratorRole.FEATURED_PARTNER}>
              {getRoleLabel(CollaboratorRole.FEATURED_PARTNER)}
            </option>
          </TextField>
          <TextField
            label="Revenue Share %"
            type="number"
            value={revenueShare}
            onChange={(e) => setRevenueShare(e.target.value)}
            fullWidth
            inputProps={{ min: 0, max: 100 }}
          />
          <TextField
            label="Invitation Message (optional)"
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
          {inviteError && <Alert severity="error">{inviteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={inviteLoading || !inviteEmail.trim()}
            onClick={handleInviteSubmit}
          >
            {inviteLoading ? 'Sending...' : 'Send Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Remove Collaborator</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove {selectedCollaborator?.displayName} from this campaign?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteLoading}
            onClick={handleDeleteConfirm}
          >
            {deleteLoading ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
