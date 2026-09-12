import { insetSurface, progressTrack, raisedSurface } from '@/lib/surfaces'
import { DonationCard } from './DonationsPage'
import Skeleton from '@mui/material/Skeleton'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { BrandedDatePicker } from '@ubuntu-fund/ui'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Chip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import Button from '@mui/material/Button'
import { keyframes } from '@mui/system'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import BlockIcon from '@mui/icons-material/Block'
import ReplayIcon from '@mui/icons-material/Replay'
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import { useAdminCampaign, useAdminCampaignDonations } from '@/hooks/useApiData'
import { CampaignStatus, CollaboratorRole, type CampaignCollaborator } from '@ubuntu-fund/types'
import { ItemNotFound, EmptyState } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'
import PageHeader from '@/components/PageHeader'
import SplitProceedsSection from '@/components/SplitProceedsSection'

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  [CollaboratorRole.CO_OWNER]: 'Co-Owner',
  [CollaboratorRole.EDITOR]: 'Editor',
  [CollaboratorRole.FEATURED_PARTNER]: 'Featured Partner',
}

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'var(--mui-palette-divider, rgba(128,140,126,0.18))'

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Skeleton variant="rounded" width={w || '100%'} height={h || 14} sx={{ maxWidth: '100%' }} />
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

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: campaign, isLoading: loading, error: campaignError } = useAdminCampaign(id ?? '')
  const { data: donations } = useAdminCampaignDonations(id ?? '')
  const navigate = useNavigate()
  const [collaborators, setCollaborators] = useState<CampaignCollaborator[]>([])
  const [collaboratorsError, setCollaboratorsError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!id) return
    api.get<CampaignCollaborator[]>(`/campaigns/${id}/collaborators`)
      .then((result) => {
        if (!cancelled) {
          setCollaborators(result)
          setCollaboratorsError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCollaborators([])
          setCollaboratorsError(error instanceof Error ? error.message : 'Unable to load collaborators.')
        }
      })
    return () => { cancelled = true }
  }, [id])
  const [editLoading, setEditLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')

  if (loading) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' } }}>
          {[0, 1, 2, 3].map(i => (
            <Box key={i} sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
              <Skel w={80} h={10} />
              <Box sx={{ mt: 1.5 }}><Skel w={120} h={28} /></Box>
              <Box sx={{ mt: 1 }}><Skel w={60} h={10} /></Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 3 }}>
          <Box sx={{ p: 2.5, borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}` }}>
            <Skel w={300} h={24} />
            <Box sx={{ mt: 2 }}><Skel h={60} /></Box>
            <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: '16px' }}>
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

  if (campaignError) return <EmptyState variant="error" title="Campaign couldn’t load" description="We couldn’t retrieve this campaign. Please try again." action={<Button onClick={() => window.location.reload()}>Try again</Button>} />

  if (!campaign) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ItemNotFound itemType="Campaign" onBack={() => navigate('/campaigns')} backLabel="Back to Campaigns" />
      </Box>
    )
  }

  const progress = campaign.goalAmount > 0 ? Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100) : 0
  const daysRemaining = Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  const statusColor = statusColors[campaign.status] || '#78909C'

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', animation: `${fadeIn} 0.4s ease`, '& *': { '@media (prefers-reduced-motion: reduce)': { animation: 'none !important', transition: 'none !important' } } }}>
      <Box sx={{ pt: { xs: 0, sm: 2.5 } }}>
        <PageHeader
          tone="gold"
          eyebrow="Community · Campaign"
          title={campaign.title}
          lede="Review this campaign's progress, moderate its status, and manage collaborators and refunds."
          icon={<RocketLaunchRoundedIcon />}
          stats={[
            { label: 'Status / Priority', value: `${campaign.status.replace('_', ' ').toUpperCase()} / ${campaign.priority.toUpperCase()}` },
            { label: 'Raised / Goal', value: `GH₵ ${campaign.raisedAmount.toLocaleString()} / GH₵ ${campaign.goalAmount.toLocaleString()}` },
            { label: 'Donors', value: donations.length },
            { label: 'Days Remaining', value: campaign.status === CampaignStatus.EXPIRED ? 'Expired' : daysRemaining },
          ]}
        />
      </Box>

      {/* Main content */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' }, gap: 3 }}>
        {/* Left: Campaign info */}
        <Box sx={{
          ...raisedSurface, p: { xs: 2.5, sm: 3 }, overflowWrap: 'anywhere',
          borderRight: `1px solid ${B}`,
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.25s both`,
        }}>
          {campaign.imageUrls?.[0] && <Box component="img" src={campaign.imageUrls[0]} alt={campaign.title} onError={e => { e.currentTarget.style.display = 'none' }} sx={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 3, mb: 3 }} />}
          <Typography component="h2" variant="h6" fontWeight={800} sx={{ mb: 2 }}>About this campaign</Typography>
          <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', lineHeight: 1.8, mb: 3, whiteSpace: 'pre-line' }}>
            {campaign.description}
          </Typography>

          <Box component="section" aria-label="Campaign details" sx={{ borderTop: `1px solid ${B}`, pt: 2.5 }}>
            <Button
              onClick={() => navigate(`/users/${campaign.creatorId}`)}
              fullWidth
              startIcon={<PersonOutlineRoundedIcon />}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ ...insetSurface, justifyContent: 'flex-start', gap: 1, p: 2, mb: 2.5, textAlign: 'left', textTransform: 'none', '& .MuiButton-endIcon': { ml: 'auto', flexShrink: 0 } }}
            >
              <Box component="span" sx={{ minWidth: 0 }}>
                <Typography component="span" sx={{ display: 'block', fontSize: '.72rem', color: 'text.secondary', mb: 0.5 }}>Campaign owner</Typography>
                <Typography component="span" sx={{ display: 'block', fontSize: '.9rem', fontWeight: 700 }}>View organizer profile</Typography>
              </Box>
            </Button>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, m: 0, mb: 3 }}>
              {[
                { label: 'Category', value: campaign.category.replace(/_/g, ' ') },
                { label: 'Currency', value: campaign.currency },
                { label: 'Start date', value: new Date(campaign.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) },
                { label: 'End date', value: new Date(campaign.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) },
              ].map(item => (
                <Box key={item.label} sx={{ minWidth: 0, ...insetSurface, p: 2 }}>
                  <Typography component="dt" sx={{ fontSize: '.72rem', color: 'text.secondary', mb: 0.75 }}>{item.label}</Typography>
                  <Typography component="dd" sx={{ m: 0, fontSize: '.95rem', fontWeight: 600, color: 'text.primary', textTransform: item.label === 'Category' ? 'capitalize' : 'none' }}>{item.value}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: '.78rem', color: 'text.secondary' }}>Funding progress</Typography>
              <Typography sx={{ fontSize: '.78rem', fontWeight: 700 }}>{progress}% funded</Typography>
            </Box>
            <Box role="progressbar" aria-label="Campaign funding" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} sx={progressTrack}>
              <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: 'primary.main', transition: 'width 0.6s ease' }} />
            </Box>
          </Box>
        </Box>

        {/* Right: Actions */}
        <Box sx={{
          ...raisedSurface,
          borderBottom: `1px solid ${B}`,
          animation: `${slideIn} 0.4s ease 0.3s both`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Status chip */}
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1, mb: 1, fontFamily: '"Outfit", sans-serif' }}>
              Current Status
            </Typography>
            <Chip
              label={campaign.status.replace('_', ' ').toUpperCase()}
              sx={{
                bgcolor: `${statusColor}20`,
                color: statusColor,
                fontWeight: 700,
                fontFamily: '"Outfit", sans-serif',
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
                    fontFamily: '"Outfit", sans-serif', textTransform: 'none',
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
                    fontFamily: '"Outfit", sans-serif', textTransform: 'none',
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
                  fontFamily: '"Outfit", sans-serif', textTransform: 'none',
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
                  fontFamily: '"Outfit", sans-serif', textTransform: 'none',
                  '&:hover': { borderColor: '#5E8F72', bgcolor: 'rgba(76,175,80,0.08)' },
                }}
              >
                {actionLoading === 'unblock' ? 'Unblocking...' : 'Unblock'}
              </Button>
            </Box>
          )}

          {/* Review notes */}
          <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
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
                  fontFamily: '"Outfit", sans-serif',
                },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: B },
              }}
            />
          </Box>

          {/* Review history */}
          {(campaign.reviewNotes || campaign.reviewedBy) && (
            <Box sx={{ p: 2.5, borderBottom: `1px solid ${B}` }}>
              <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1, mb: 1, fontFamily: '"Outfit", sans-serif' }}>
                Review History
              </Typography>
              {campaign.reviewNotes && (
                <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 1, lineHeight: 1.5 }}>
                  {campaign.reviewNotes}
                </Typography>
              )}
              {campaign.reviewedBy && (
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
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
              sx={{
                color: 'text.secondary', borderColor: 'divider',
                fontFamily: '"Outfit", sans-serif', textTransform: 'none',
                '&:hover': { borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.05)' },
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
                fontFamily: '"Outfit", sans-serif', textTransform: 'none',
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
      <Box sx={{ mt: 3, p: 2.5 }}>
        <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1, mb: 1.5, fontFamily: '"Outfit", sans-serif' }}>
          Collaborators
        </Typography>
      </Box>
      {collaboratorsError ? (
        <EmptyState variant="error" title="Collaborators unavailable" description={collaboratorsError} compact />
      ) : collaborators.length === 0 ? (
        <EmptyState variant="noData" title="No collaborators" description="This campaign has no collaborators yet." compact />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
          {collaborators.map((c, i) => (
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
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'text.primary', fontFamily: '"Outfit", monospace' }}>
                    {c.displayName}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.5 }}>
                    {ROLE_LABELS[c.role]}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.3 }}>
                    Revenue share: {c.revenueSharePercent}%
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.3, textTransform: 'uppercase' }}>
                    {c.status}
                  </Typography>
                </Box>
                <Chip label={c.status} size="small" />
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Split-proceeds (read-only) */}
      <SplitProceedsSection key={id} campaignId={id ?? ''} />

      {/* Bottom: Recent donations */}
      <Box sx={{ mt: 3, p: 2.5 }}>
        <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 1, mb: 1.5, fontFamily: '"Outfit", sans-serif' }}>
          Recent Donations
        </Typography>
      </Box>
      {donations.length === 0 ? (
        <EmptyState variant="noData" title="No donations yet" description="This campaign hasn't received any donations." compact />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          {donations.slice(0, 8).map((d) => (
            <DonationCard key={d.id} donation={d} donorName={d.donorName ?? 'Guest donor'} campaignTitle={campaign.title} />
          ))}
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: 'background.default', color: 'text.primary' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>Edit Campaign</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title" defaultValue={campaign?.title} id="admin-edit-title" fullWidth sx={{ '& .MuiInputBase-root': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Description" defaultValue={campaign?.description} id="admin-edit-description" multiline rows={3} fullWidth sx={{ '& .MuiInputBase-root': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Goal Amount" type="number" defaultValue={campaign?.goalAmount} id="admin-edit-goal" fullWidth sx={{ '& .MuiInputBase-root': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Category" defaultValue={campaign?.category} id="admin-edit-category" fullWidth sx={{ '& .MuiInputBase-root': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Priority" defaultValue={campaign?.priority} id="admin-edit-priority" fullWidth sx={{ '& .MuiInputBase-root': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <TextField label="Beneficiaries (comma separated)" defaultValue={campaign?.beneficiaries?.join(', ')} id="admin-edit-beneficiaries" fullWidth sx={{ '& .MuiInputBase-root': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' } }} />
          <BrandedDatePicker label="End Date" mode="datetime" defaultValue={campaign?.endDate ? new Date(campaign.endDate).toISOString() : ''} id="admin-edit-endDate" fullWidth sx={{ '& .MuiInputBase-root': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.03)' } }}  />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
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
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: 'background.default', color: 'text.primary' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>Delete Campaign</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>Are you sure you want to delete this campaign? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
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
