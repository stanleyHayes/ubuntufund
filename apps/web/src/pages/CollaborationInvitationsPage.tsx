import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Snackbar from '@mui/material/Snackbar'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import {
  CollaboratorRole,
  CollaborationStatus,
  type CampaignCollaborator,
} from '@ubuntu-fund/types'
import { SHAPE } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  [CollaboratorRole.CO_OWNER]: 'Co-Owner',
  [CollaboratorRole.EDITOR]: 'Editor',
  [CollaboratorRole.FEATURED_PARTNER]: 'Featured Partner',
}

const ROLE_COLORS: Record<CollaboratorRole, 'primary' | 'secondary' | 'info'> = {
  [CollaboratorRole.CO_OWNER]: 'primary',
  [CollaboratorRole.EDITOR]: 'secondary',
  [CollaboratorRole.FEATURED_PARTNER]: 'info',
}

export function CollaborationInvitationsPage() {
  const [invitations, setInvitations] = useState<CampaignCollaborator[]>([])
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>({})
  const [snackMessage, setSnackMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<CampaignCollaborator[]>('/collaborations/invitations')
      .then((data) => {
        setInvitations(data)
        // Build campaign name map from response data if available
        const names: Record<string, string> = {}
        for (const inv of data) {
          const collaborator = inv as unknown as Record<string, unknown>
          if (inv.campaignId && collaborator.campaignName) {
            names[inv.campaignId] = collaborator.campaignName as string
          }
        }
        setCampaignNames(names)
      })
      .catch(() => setInvitations([]))
      .finally(() => setIsLoading(false))
  }, [])

  const [respondingId, setRespondingId] = useState<string | null>(null)

  async function handleAccept(id: string) {
    setRespondingId(id)
    try {
      await api.put(`/collaborations/${id}/respond`, { accept: true })
      setInvitations((prev) => prev.filter((inv) => inv.id !== id))
      setSnackMessage('Invitation accepted!')
    } catch (err) {
      setSnackMessage(err instanceof Error ? err.message : 'Failed to accept invitation.')
    } finally {
      setRespondingId(null)
    }
  }

  async function handleDecline(id: string) {
    setRespondingId(id)
    try {
      await api.put(`/collaborations/${id}/respond`, { accept: false })
      setInvitations((prev) => prev.filter((inv) => inv.id !== id))
      setSnackMessage('Invitation declined.')
    } catch (err) {
      setSnackMessage(err instanceof Error ? err.message : 'Failed to decline invitation.')
    } finally {
      setRespondingId(null)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        Collaboration Invitations
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage your pending collaboration invitations from other campaign creators.
      </Typography>

      {invitations.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <MailOutlineRoundedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No pending invitations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            When someone invites you to collaborate on a campaign, it will appear here.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {invitations.map((inv) => (
            <Card key={inv.id} variant="outlined" sx={{ borderRadius: SHAPE.card }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                  <Avatar src={inv.logoUrl} sx={{ width: 44, height: 44 }}>
                    {inv.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {campaignNames[inv.campaignId] ?? inv.campaignId}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Invited by <strong>{inv.displayName}</strong>
                    </Typography>
                  </Box>
                  <Chip
                    label={ROLE_LABELS[inv.role]}
                    size="small"
                    color={ROLE_COLORS[inv.role]}
                    sx={{ fontWeight: 600 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">
                    Revenue share: <strong>{inv.revenueSharePercent}%</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Invited: {new Date(inv.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>

                {inv.inviteMessage && (
                  <Typography
                    variant="body2"
                    sx={{
                      mb: 2,
                      p: 2,
                      bgcolor: 'grey.50',
                      borderRadius: SHAPE.sm,
                      fontStyle: 'italic',
                      color: 'text.secondary',
                    }}
                  >
                    "{inv.inviteMessage}"
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    color="primary"
                    startIcon={<CheckCircleOutlineIcon />}
                    onClick={() => handleAccept(inv.id)}
                    disabled={respondingId === inv.id}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    {respondingId === inv.id ? 'Accepting...' : 'Accept'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<CancelOutlinedIcon />}
                    onClick={() => handleDecline(inv.id)}
                    disabled={respondingId === inv.id}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    {respondingId === inv.id ? 'Declining...' : 'Decline'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Snackbar
        open={!!snackMessage}
        autoHideDuration={3000}
        onClose={() => setSnackMessage('')}
        message={snackMessage}
      />
    </Container>
  )
}
