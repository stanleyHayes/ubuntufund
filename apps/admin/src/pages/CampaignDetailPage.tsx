import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Chip, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import Button from '@mui/material/Button'
import { keyframes } from '@mui/system'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import BlockIcon from '@mui/icons-material/Block'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange'
import PersonRemoveIcon from '@mui/icons-material/PersonRemove'
import ReplayIcon from '@mui/icons-material/Replay'
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import { useMockCampaign, useMockCampaignDonations } from '@/hooks/useMockData'
import { CampaignStatus, CampaignPriority, CollaboratorRole, CollaborationStatus, type CampaignCollaborator } from '@ubuntu-fund/types'
import { ItemNotFound, EmptyState, AiWritingBar } from '@ubuntu-fund/ui'
import { AiWritingAction } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import PageHeader from '@/components/PageHeader'

const MOCK_COLLABORATORS: CampaignCollaborator[] = [
  {
    id: 'collab-1',
    campaignId: '',
    userId: 'user-partner-1',
    invitedBy: 'creator',
    role: CollaboratorRole.CO_OWNER,
    status: CollaborationStatus.ACCEPTED,
    revenueSharePercent: 20,
    displayName: 'Grace Achieng',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-02'),
  },
  {
    id: 'collab-2',
    campaignId: '',
    userId: 'user-partner-2',
    invitedBy: 'creator',
    role: CollaboratorRole.FEATURED_PARTNER,
    status: CollaborationStatus.ACCEPTED,
    revenueSharePercent: 5,
    displayName: 'Kwame Asante Foundation',
    createdAt: new Date('2026-03-05'),
    updatedAt: new Date('2026-03-06'),
  },
]

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  [CollaboratorRole.CO_OWNER]: 'Co-Owner',
  [CollaboratorRole.EDITOR]: 'Editor',
  [CollaboratorRole.FEATURED_PARTNER]: 'Featured Partner',
}

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

const statusColors: Record<string, string> = {
  [CampaignStatus.ACTIVE]: '#5E8F72',
  [CampaignStatus.PENDING_REVIEW]: '#D3A95C',
  [CampaignStatus.FUNDED]: '#74909A',
  [CampaignStatus.EXPIRED]: '#78909C',
  [CampaignStatus.BLOCKED]: '#C06B58',
  [CampaignStatus.DRAFT]: '#9E9E9E',
}

const priorityColors: Record<string, string> = {
  [CampaignPriority.NORMAL]: '#78909C',
  [CampaignPriority.URGENT]: '#D3A95C',
  [CampaignPriority.CRITICAL]: '#C06B58',
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const campaign = useMockCampaign(id ?? '')
  const donations = useMockCampaignDonations(id ?? '')
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const [daysRemaining] = useState(() => {
    if (!campaign) return 0
    return Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  })
  const [reviewNotes, setReviewNotes] = useState('')

  if (loading) {
    return (
      <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' } }}>
          {[0, 1, 2, 3].map(i => (
            <Box key={i} sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
              <Skel w={80} h={10} />
              <Box sx={{ mt: 1.5 }}><Skel w={120} h={28} /></Box>
              <Box sx={{ mt: 1 }}><Skel w={60} h={10} /></Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 1fr' } }}>
          <Box sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
            <Skel w={300} h={24} />
            <Box sx={{ mt: 2 }}><Skel h={60} /></Box>
            <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[0, 1, 2, 3].map(i => <Box key={i}><Skel w={90} h={10} /><Box sx={{ mt: 0.5 }}><Skel w={140} h={14} /></Box></Box>)}
            </Box>
            <Box sx={{ mt: 2 }}><Skel h={4} /></Box>
          </Box>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            {[0, 1, 2].map(i => <Box key={i} sx={{ mb: 1.5 }}><Skel h={40} /></Box>)}
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' } }}>
          {[0, 1, 2, 3].map(i => (
            <Box key={i} sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
              <Skel w={60} h={20} />
              <Box sx={{ mt: 1 }}><Skel w={100} h={10} /></Box>
              <Box sx={{ mt: 0.5 }}><Skel w={80} h={10} /></Box>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  if (!campaign) {
    return (
      <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ItemNotFound itemType="Campaign" onBack={() => navigate('/campaigns')} backLabel="Back to Campaigns" />
      </Box>
    )
  }

  const progress = Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100)
  const statusColor = statusColors[campaign.status] || '#78909C'
  const priorityColor = priorityColors[campaign.priority] || '#78909C'

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.4s ease` }}>
      <Box sx={{ px: 2.5, pt: 2.5 }}>
        <PageHeader
          tone="gold"
          eyebrow="Community · Campaign"
          title={campaign.title}
          lede="Review this campaign's progress, moderate its status, and manage collaborators and refunds."
          icon={<RocketLaunchRoundedIcon />}
          stats={[
            { label: 'Status / Priority', value: `${campaign.status.replace('_', ' ').toUpperCase()} / ${campaign.priority.toUpperCase()}` },
            { label: 'Raised / Goal', value: `$${campaign.raisedAmount.toLocaleString()} / $${campaign.goalAmount.toLocaleString()}` },
            { label: 'Donors', value: donations.length },
            { label: 'Days Remaining', value: campaign.status === CampaignStatus.EXPIRED ? 'Expired' : daysRemaining },
          ]}
        />
      </Box>

      {/* Main content */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '3fr 1fr' } }}>
        {/* Left: Campaign info */}
        <Box sx={{
          p: 2.5,
          borderRight: `1px solid ${B}`,
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.25s both`,
        }}>
          <Typography sx={{ fontSize: '0.88rem', color: '#A0A0B0', lineHeight: 1.7, mb: 2 }}>
            {campaign.description}
          </Typography>

          {/* Separator */}
          <Box sx={{ borderBottom: `1px solid ${B}`, mb: 2 }} />

          {/* Info grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', mb: 2.5 }}>
            {[
              { label: 'Creator ID', value: campaign.creatorId },
              { label: 'Category', value: campaign.category.toUpperCase() },
              { label: 'Currency', value: campaign.currency },
              { label: 'Start / End', value: `${new Date(campaign.startDate).toLocaleDateString()} - ${new Date(campaign.endDate).toLocaleDateString()}` },
            ].map((item, i) => (
              <Box key={i}>
                <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 0.8, mb: 0.3 }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', color: '#E0E0E8' }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Progress bar */}
          <Box sx={{ position: 'relative', width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.04)' }}>
            <Box sx={{
              position: 'absolute', top: 0, left: 0, height: '100%',
              width: `${progress}%`,
              bgcolor: '#5E8F72',
              transition: 'width 0.6s ease',
            }} />
          </Box>
          <Typography sx={{ fontSize: '0.7rem', color: '#6B6B80', mt: 0.8 }}>
            {progress}% funded
          </Typography>
        </Box>

        {/* Right: Actions */}
        <Box sx={{
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.3s both`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Status chip */}
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 1, mb: 1, fontFamily: '"TT Squares", sans-serif' }}>
              Current Status
            </Typography>
            <Chip
              label={campaign.status.replace('_', ' ').toUpperCase()}
              sx={{
                bgcolor: `${statusColor}20`,
                color: statusColor,
                fontWeight: 700,
                fontFamily: '"TT Squares", sans-serif',
                fontSize: '0.75rem',
              }}
            />
          </Box>

          {/* Approve / Reject */}
          {campaign.status === CampaignStatus.PENDING_REVIEW && (
            <>
              <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<CheckCircleOutlineIcon />}
                  disabled={actionLoading === 'approve'}
                  onClick={async () => {
                    setActionLoading('approve')
                    try {
                      await api.put(`/campaigns/${id}/approve`, { action: 'approve' })
                      window.location.reload()
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Approve failed')
                    } finally {
                      setActionLoading(null)
                    }
                  }}
                  sx={{
                    color: '#5E8F72', borderColor: '#5E8F72',
                    fontFamily: '"TT Squares", sans-serif', textTransform: 'none',
                    '&:hover': { borderColor: '#5E8F72', bgcolor: 'rgba(76,175,80,0.08)' },
                  }}
                >
                  {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
                </Button>
              </Box>
              <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DoNotDisturbIcon />}
                  disabled={actionLoading === 'reject'}
                  onClick={async () => {
                    setActionLoading('reject')
                    try {
                      await api.put(`/campaigns/${id}/approve`, { action: 'reject' })
                      window.location.reload()
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Reject failed')
                    } finally {
                      setActionLoading(null)
                    }
                  }}
                  sx={{
                    color: '#C06B58', borderColor: '#C06B58',
                    fontFamily: '"TT Squares", sans-serif', textTransform: 'none',
                    '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
                  }}
                >
                  {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
                </Button>
              </Box>
            </>
          )}

          {/* Block / Unblock */}
          {campaign.status !== CampaignStatus.BLOCKED ? (
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<BlockIcon />}
                disabled={actionLoading === 'block'}
                onClick={async () => {
                  setActionLoading('block')
                  try {
                    await api.put(`/campaigns/${id}/approve`, { action: 'block' })
                    window.location.reload()
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Block failed')
                  } finally {
                    setActionLoading(null)
                  }
                }}
                sx={{
                  color: '#C06B58', borderColor: '#C06B58',
                  fontFamily: '"TT Squares", sans-serif', textTransform: 'none',
                  '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
                }}
              >
                {actionLoading === 'block' ? 'Blocking...' : 'Block'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<ReplayIcon />}
                disabled={actionLoading === 'unblock'}
                onClick={async () => {
                  setActionLoading('unblock')
                  try {
                    await api.put(`/campaigns/${id}/review`, { action: 'unblock' })
                    window.location.reload()
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Unblock failed')
                  } finally {
                    setActionLoading(null)
                  }
                }}
                sx={{
                  color: '#5E8F72', borderColor: '#5E8F72',
                  fontFamily: '"TT Squares", sans-serif', textTransform: 'none',
                  '&:hover': { borderColor: '#5E8F72', bgcolor: 'rgba(76,175,80,0.08)' },
                }}
              >
                {actionLoading === 'unblock' ? 'Unblocking...' : 'Unblock'}
              </Button>
            </Box>
          )}

          {/* Review notes */}
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <AiWritingBar
              value={reviewNotes}
              onChange={setReviewNotes}
              inputLabel="Review Notes"
              allowedActions={[AiWritingAction.FORMALIZE, AiWritingAction.SUMMARIZE, AiWritingAction.FIX_GRAMMAR, AiWritingAction.IMPROVE_CLARITY]}
            />
            <TextField
              multiline
              rows={3}
              fullWidth
              placeholder="Add review notes..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              sx={{
                '& .MuiInputBase-root': {
                  bgcolor: 'rgba(255,255,255,0.03)',
                  color: 'text.primary',
                  fontSize: '0.82rem',
                  fontFamily: '"TT Squares", sans-serif',
                },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: B },
              }}
            />
          </Box>

          {/* Review history */}
          {(campaign.reviewNotes || campaign.reviewedBy) && (
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
              <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 1, mb: 1, fontFamily: '"TT Squares", sans-serif' }}>
                Review History
              </Typography>
              {campaign.reviewNotes && (
                <Typography sx={{ fontSize: '0.82rem', color: '#A0A0B0', mb: 1, lineHeight: 1.5 }}>
                  {campaign.reviewNotes}
                </Typography>
              )}
              {campaign.reviewedBy && (
                <Typography sx={{ fontSize: '0.72rem', color: '#6B6B80' }}>
                  By {campaign.reviewedBy}
                  {campaign.reviewedAt && ` · ${new Date(campaign.reviewedAt).toLocaleDateString()}`}
                </Typography>
              )}
            </Box>
          )}

          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<CurrencyExchangeIcon />}
              sx={{
                color: '#D3A95C', borderColor: '#D3A95C',
                fontFamily: '"TT Squares", sans-serif', textTransform: 'none',
                '&:hover': { borderColor: '#D3A95C', bgcolor: 'rgba(211,169,92,0.08)' },
              }}
            >
              Force Refund
            </Button>
          </Box>
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Button
              variant="outlined"
              fullWidth
              sx={{
                color: '#A0A0B0', borderColor: '#A0A0B0',
                fontFamily: '"TT Squares", sans-serif', textTransform: 'none',
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
              }}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          </Box>
          <Box sx={{ p: 2.5 }}>
            <Button
              variant="outlined"
              fullWidth
              color="error"
              sx={{
                color: '#C06B58', borderColor: '#C06B58',
                fontFamily: '"TT Squares", sans-serif', textTransform: 'none',
                '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
              }}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Collaborators */}
      <Box sx={{ borderBottom: `1px solid ${B}`, p: 2.5 }}>
        <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 1, mb: 1.5, fontFamily: '"TT Squares", sans-serif' }}>
          Collaborators
        </Typography>
      </Box>
      {MOCK_COLLABORATORS.length === 0 ? (
        <EmptyState variant="noData" title="No collaborators" description="This campaign has no collaborators yet." compact />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
          {MOCK_COLLABORATORS.map((c, i) => (
            <Box
              key={c.id}
              sx={{
                p: 2,
                borderRight: `1px solid ${B}`,
                borderBottom: `1px solid ${B}`,
                borderTop: '2px solid rgba(220,192,126,0.25)',
                borderLeft: '2px solid rgba(220,192,126,0.25)',
                animation: `${slideIn} 0.4s ease ${0.35 + i * 0.04}s both`,
                transition: 'background 0.2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', fontFamily: '"TT Squares", monospace' }}>
                    {c.displayName}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: '#A0A0B0', mt: 0.5 }}>
                    {ROLE_LABELS[c.role]}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: '#6B6B80', mt: 0.3 }}>
                    Revenue share: {c.revenueSharePercent}%
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#6B6B80', mt: 0.3, textTransform: 'uppercase' }}>
                    {c.status}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<PersonRemoveIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    color: '#C06B58',
                    fontSize: '0.65rem',
                    textTransform: 'none',
                    minWidth: 'auto',
                    fontFamily: '"TT Squares", sans-serif',
                    '&:hover': { bgcolor: 'rgba(192,107,88,0.08)' },
                  }}
                >
                  Remove
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Bottom: Recent donations */}
      <Box sx={{ borderBottom: `1px solid ${B}`, p: 2.5 }}>
        <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6B6B80', letterSpacing: 1, mb: 1.5, fontFamily: '"TT Squares", sans-serif' }}>
          Recent Donations
        </Typography>
      </Box>
      {donations.length === 0 ? (
        <EmptyState variant="noData" title="No donations yet" description="This campaign hasn't received any donations." compact />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
          {donations.slice(0, 8).map((d, i) => (
            <Box
              key={d.id}
              sx={{
                p: 2,
                borderRight: `1px solid ${B}`,
                borderBottom: `1px solid ${B}`,
                borderTop: '2px solid rgba(116,144,154,0.25)',
                borderLeft: '2px solid rgba(116,144,154,0.25)',
                animation: `${slideIn} 0.4s ease ${0.35 + i * 0.04}s both`,
                transition: 'background 0.2s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
              }}
            >
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', fontFamily: '"TT Squares", monospace' }}>
                ${d.amount.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#A0A0B0', mt: 0.5 }}>
                {d.isAnonymous ? 'Anonymous' : d.donorId}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: '#6B6B80', mt: 0.3 }}>
                {new Date(d.createdAt).toLocaleDateString()}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#6B6B80', mt: 0.3, textTransform: 'uppercase' }}>
                {d.paymentMethod.replace('_', ' ')}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#0c0c14', color: '#fff' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: '"TT Squares", sans-serif' }}>Edit Campaign</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title" defaultValue={campaign?.title} id="admin-edit-title" fullWidth sx={{ '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Description" defaultValue={campaign?.description} id="admin-edit-description" multiline rows={3} fullWidth sx={{ '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Goal Amount" type="number" defaultValue={campaign?.goalAmount} id="admin-edit-goal" fullWidth sx={{ '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Category" defaultValue={campaign?.category} id="admin-edit-category" fullWidth sx={{ '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Priority" defaultValue={campaign?.priority} id="admin-edit-priority" fullWidth sx={{ '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Beneficiaries (comma separated)" defaultValue={campaign?.beneficiaries?.join(', ')} id="admin-edit-beneficiaries" fullWidth sx={{ '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="End Date" type="datetime-local" defaultValue={campaign?.endDate ? new Date(campaign.endDate).toISOString().slice(0, 16) : ''} id="admin-edit-endDate" fullWidth sx={{ '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.03)' } }} InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: '#A0A0B0' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={editLoading}
            onClick={async () => {
              setEditLoading(true)
              try {
                const title = (document.getElementById('admin-edit-title') as HTMLInputElement)?.value
                const description = (document.getElementById('admin-edit-description') as HTMLInputElement)?.value
                const goalAmount = (document.getElementById('admin-edit-goal') as HTMLInputElement)?.value
                const category = (document.getElementById('admin-edit-category') as HTMLInputElement)?.value
                const priority = (document.getElementById('admin-edit-priority') as HTMLInputElement)?.value
                const beneficiaries = (document.getElementById('admin-edit-beneficiaries') as HTMLInputElement)?.value
                const endDate = (document.getElementById('admin-edit-endDate') as HTMLInputElement)?.value
                const body: Record<string, unknown> = {}
                if (title) body.title = title
                if (description) body.description = description
                if (goalAmount) body.goalAmount = Number(goalAmount)
                if (category) body.category = category
                if (priority) body.priority = priority
                if (beneficiaries) body.beneficiaries = beneficiaries.split(',').map((b) => b.trim()).filter(Boolean)
                if (endDate) body.endDate = new Date(endDate).toISOString()
                await api.put(`/campaigns/${id}`, body)
                setEditOpen(false)
                window.location.reload()
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Update failed')
              } finally {
                setEditLoading(false)
              }
            }}
          >
            {editLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: '#0c0c14', color: '#fff' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: '"TT Squares", sans-serif' }}>Delete Campaign</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#A0A0B0' }}>Are you sure you want to delete this campaign? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: '#A0A0B0' }}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteLoading}
            onClick={async () => {
              setDeleteLoading(true)
              try {
                await api.delete(`/campaigns/${id}`)
                navigate('/campaigns')
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Delete failed')
              } finally {
                setDeleteLoading(false)
              }
            }}
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
