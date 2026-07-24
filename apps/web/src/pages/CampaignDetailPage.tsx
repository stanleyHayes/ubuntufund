import { useState, useEffect } from 'react'
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import { CurrencyDisplay, PaymentMethods, ErrorState, ItemNotFound, TrustBadge, SHAPE, type PaymentMethodData, AiWritingBar } from '@ubuntu-fund/ui'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Avatar from '@mui/material/Avatar'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import { useAuth } from '@/context/AuthContext'
import { useUser } from '@/hooks/useUser'
import {
  CampaignStatus,
  CampaignCategory,
  CampaignPriority,
  CollaboratorRole,
  CollaborationStatus,
  type CampaignCollaborator,
  AiWritingAction,
} from '@ubuntu-fund/types'
import { useCampaign } from '@/hooks/useCampaigns'
import { ReportCampaignDialog } from '@/components/campaigns/ReportCampaignDialog'
import { CollaboratorSection } from '@/components/campaigns/CollaboratorSection'
import { ShareCampaignButton } from '@/components/campaigns/ShareCampaignButton'
import { CampaignQRCode } from '@/components/campaigns/CampaignQRCode'
import { EmbedCampaign } from '@/components/campaigns/EmbedCampaign'
import { CampaignUpdates } from '@/components/campaigns/CampaignUpdates'
import { CreateUpdateDialog } from '@/components/campaigns/CreateUpdateDialog'
import { useCreateCampaignUpdate } from '@/hooks/useCampaignUpdates'
import { LiveCampaignProgress } from '@/components/campaigns/LiveCampaignProgress'
import { LiveDonationFeed } from '@/components/LiveDonationFeed'
import { api } from '@/lib/api'
import { useEnabledPaymentProviders } from '@/hooks/useEnabledPaymentProviders'

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { campaign, isLoading, error } = useCampaign(id ?? '')
  const [collaborators, setCollaborators] = useState<CampaignCollaborator[]>([])

  const {
    providers: enabledProviders,
    isLoading: providersLoading,
    error: providersError,
  } = useEnabledPaymentProviders()

  useEffect(() => {
    if (!id) return
    api.get<CampaignCollaborator[]>(`/campaigns/${id}/collaborators`)
      .then(setCollaborators)
      .catch(() => setCollaborators([]))
  }, [id])

  const [donateOpen, setDonateOpen] = useState(false)
  const [donateAmount, setDonateAmount] = useState('')
  const [donateMessage, setDonateMessage] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<PaymentMethodData | null>(null)
  const [snackOpen, setSnackOpen] = useState(false)
  const [donating, setDonating] = useState(false)
  const [donateError, setDonateError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const { user: currentUser } = useAuth()
  const { user: creator } = useUser(campaign?.creatorId ?? '')
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editGoalAmount, setEditGoalAmount] = useState('')
  const [editCategory, setEditCategory] = useState<CampaignCategory | ''>('')
  const [editPriority, setEditPriority] = useState<CampaignPriority | ''>('')
  const [editBeneficiaries, setEditBeneficiaries] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const [activeTab, setActiveTab] = useState(0)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const { create: createUpdate, isLoading: creatingUpdate } = useCreateCampaignUpdate()

  function handleOpenDonate() {
    setDonateOpen(true)
    setDonateAmount('')
    setDonateMessage('')
    setSelectedProvider(null)
    setDonateError('')
  }

  function handleOpenEdit() {
    if (!campaign) return
    setEditTitle(campaign.title)
    setEditDescription(campaign.description)
    setEditGoalAmount(String(campaign.goalAmount))
    setEditCategory(campaign.category)
    setEditPriority(campaign.priority)
    setEditBeneficiaries(campaign.beneficiaries.join(', '))
    setEditEndDate(new Date(campaign.endDate).toISOString().slice(0, 16))
    setEditError('')
    setEditOpen(true)
  }

  function handleCloseDonate() {
    setDonateOpen(false)
    setDonateError('')
  }

  const canSubmit =
    donateAmount &&
    Number(donateAmount) > 0 &&
    !donating &&
    selectedProvider != null &&
    selectedProvider.type === 'wallet'

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Skeleton variant="rectangular" height={350} sx={{ borderRadius: SHAPE.card, mb: 4 }} />
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Skeleton variant="rounded" width={80} height={28} />
          <Skeleton variant="rounded" width={60} height={28} />
        </Box>
        <Skeleton width="70%" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={10} sx={{ borderRadius: SHAPE.bar, mb: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
          <Skeleton width="25%" height={18} />
          <Skeleton width="20%" height={18} />
        </Box>
        <Skeleton variant="rounded" width={140} height={44} sx={{ mb: 4 }} />
        <Skeleton width="30%" height={28} sx={{ mb: 1 }} />
        <Skeleton width="100%" height={16} sx={{ mb: 0.5 }} />
        <Skeleton width="100%" height={16} sx={{ mb: 0.5 }} />
        <Skeleton width="80%" height={16} sx={{ mb: 0.5 }} />
        <Skeleton width="60%" height={16} />
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ErrorState
          title="Failed to load campaign"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </Container>
    )
  }

  if (!campaign) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <ItemNotFound
          itemType="Campaign"
          onBack={() => navigate(-1)}
        />
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      {/* Campaign Image */}
      {campaign.imageUrls[0] && (
        <Box
          component="img"
          src={campaign.imageUrls[0]}
          alt={campaign.title}
          sx={{
            width: '100%',
            height: { xs: 250, md: 400 },
            objectFit: 'cover',
            borderRadius: SHAPE.card,
            mb: 4,
          }}
        />
      )}

      {/* Category & Priority */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip label={formatCategory(campaign.category)} color="primary" variant="outlined" />
        {campaign.priority === 'critical' && <Chip label="Critical" color="error" />}
        {campaign.priority === 'urgent' && <Chip label="Urgent" color="warning" />}
        <Chip
          label={campaign.status.replace(/_/g, ' ').toUpperCase()}
          variant="outlined"
          size="small"
          color={campaign.status === CampaignStatus.PENDING_REVIEW ? 'warning' : campaign.status === CampaignStatus.BLOCKED ? 'error' : 'default'}
        />
      </Box>

      {/* Title */}
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        {campaign.title}
      </Typography>

      {/* Progress */}
      <Box sx={{ mb: 4 }}>
        <LiveCampaignProgress
          campaignId={campaign.id}
          initialProgress={{
            raisedAmount: campaign.raisedAmount,
            goalAmount: campaign.goalAmount,
            currency: campaign.currency,
          }}
        />
      </Box>

      {/* Donation CTA */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 4, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          sx={{ px: 4 }}
          onClick={handleOpenDonate}
          disabled={campaign.status !== CampaignStatus.ACTIVE}
        >
          {campaign.status === CampaignStatus.ACTIVE ? 'Donate Now' : 'Donations Unavailable'}
        </Button>
        {campaign.status === CampaignStatus.ACTIVE && (
          <CurrencyDisplay
            amount={campaign.goalAmount - campaign.raisedAmount}
            currency={campaign.currency}
            variant="body1"
            color="text.secondary"
            sx={{ '&::before': { content: '"Still needed: "' } }}
          />
        )}
        {campaign.status !== CampaignStatus.ACTIVE && (
          <Chip
            label={campaign.status === CampaignStatus.PENDING_REVIEW ? 'Pending Review' : 'Campaign Inactive'}
            color={campaign.status === CampaignStatus.PENDING_REVIEW ? 'warning' : 'error'}
            size="small"
          />
        )}
        <ShareCampaignButton
          campaignId={campaign.id}
          title={campaign.title}
          url={`${window.location.origin}/campaigns/${campaign.id}`}
        />
        {currentUser?.id === campaign.creatorId && (
          <>
            <Button
              variant="outlined"
              size="small"
              onClick={handleOpenEdit}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete
            </Button>
          </>
        )}
      </Box>

      {/* Donate Dialog */}
      <Dialog open={donateOpen} onClose={handleCloseDonate} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Donate to "{campaign.title}"
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField
            label="Amount"
            type="number"
            value={donateAmount}
            onChange={(e) => setDonateAmount(e.target.value)}
            InputProps={{ startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>{campaign.currency}</Typography> }}
            fullWidth
          />

          {/* Payment method selection */}
          <Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 1,
                mb: 1,
                display: 'block',
              }}
            >
              Select Payment Method
            </Typography>

            {providersLoading ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" width={80} height={72} sx={{ borderRadius: SHAPE.sm }} />
                ))}
              </Box>
            ) : providersError || enabledProviders.length === 0 ? (
              <>
                {providersError && (
                  <Alert severity="warning" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
                    Could not load payment providers. Showing fallback options.
                  </Alert>
                )}
                {enabledProviders.length === 0 && !providersError && (
                  <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
                    No payment methods available.
                  </Alert>
                )}
                <PaymentMethods
                  compact
                  providers={[
                    { id: 'wallet', name: 'UbuntuFund Wallet', slug: 'wallet', type: 'wallet' },
                  ]}
                  onSelect={setSelectedProvider}
                  selectedSlug={selectedProvider?.slug}
                />
              </>
            ) : (
              <PaymentMethods
                compact
                providers={enabledProviders.map((p) => ({
                  id: p.id,
                  name: p.name,
                  slug: p.slug,
                  type: p.type as PaymentMethodData['type'],
                }))}
                onSelect={setSelectedProvider}
                selectedSlug={selectedProvider?.slug}
              />
            )}
          </Box>

          {selectedProvider && selectedProvider.type !== 'wallet' && (
            <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
              This payment method will be available soon. Please use UbuntuFund Wallet for now.
            </Alert>
          )}

          <Box>
            <Box sx={{ mb: 1 }}>
              <AiWritingBar
                value={donateMessage}
                onChange={setDonateMessage}
                inputLabel="Donation Message"
                allowedActions={[
                  AiWritingAction.FORMALIZE,
                  AiWritingAction.CASUAL,
                  AiWritingAction.FIX_GRAMMAR,
                  AiWritingAction.IMPROVE_CLARITY,
                ]}
              />
            </Box>
            <TextField
              label="Message (optional)"
              value={donateMessage}
              onChange={(e) => setDonateMessage(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
          {donateError && <Alert severity="error">{donateError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDonate}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!canSubmit}
            onClick={async () => {
              setDonating(true)
              setDonateError('')
              try {
                await api.post(`/campaigns/${id}/donate`, {
                  amount: Number(donateAmount),
                  currency: campaign.currency,
                  message: donateMessage || undefined,
                  isAnonymous: false,
                })
                handleCloseDonate()
                setDonateAmount('')
                setDonateMessage('')
                setSelectedProvider(null)
                setSnackOpen(true)
              } catch (err) {
                setDonateError(err instanceof Error ? err.message : 'Donation failed. Please try again.')
              } finally {
                setDonating(false)
              }
            }}
          >
            {donating ? 'Submitting...' : 'Confirm Donation'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackOpen}
        autoHideDuration={4000}
        onClose={() => setSnackOpen(false)}
        message="Donation submitted successfully!"
      />

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Campaign</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} fullWidth />
          <Box>
            <Box sx={{ mb: 1 }}>
              <AiWritingBar
                value={editDescription}
                onChange={setEditDescription}
                inputLabel="Campaign Description"
                allowedActions={[
                  AiWritingAction.FORMALIZE,
                  AiWritingAction.SUMMARIZE,
                  AiWritingAction.EXPAND,
                  AiWritingAction.FIX_GRAMMAR,
                  AiWritingAction.IMPROVE_CLARITY,
                  AiWritingAction.GENERATE_TITLE,
                ]}
              />
            </Box>
            <TextField label="Description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} multiline rows={3} fullWidth />
          </Box>
          <TextField label="Goal Amount" type="number" value={editGoalAmount} onChange={(e) => setEditGoalAmount(e.target.value)} fullWidth />
          <TextField select label="Category" value={editCategory} onChange={(e) => setEditCategory(e.target.value as CampaignCategory)} fullWidth SelectProps={{ native: true }}>
            <option value="" disabled>Select category</option>
            {Object.values(CampaignCategory).map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ')}</option>
            ))}
          </TextField>
          <TextField select label="Priority" value={editPriority} onChange={(e) => setEditPriority(e.target.value as CampaignPriority)} fullWidth SelectProps={{ native: true }}>
            <option value="" disabled>Select priority</option>
            {Object.values(CampaignPriority).map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </TextField>
          <TextField label="Beneficiaries (comma separated)" value={editBeneficiaries} onChange={(e) => setEditBeneficiaries(e.target.value)} fullWidth />
          <TextField label="End Date" type="datetime-local" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
          {editError && <Alert severity="error">{editError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={editLoading}
            onClick={async () => {
              setEditLoading(true)
              setEditError('')
              try {
                await api.put(`/campaigns/${id}`, {
                  ...(editTitle && { title: editTitle }),
                  ...(editDescription && { description: editDescription }),
                  ...(editGoalAmount && { goalAmount: Number(editGoalAmount) }),
                  ...(editCategory && { category: editCategory }),
                  ...(editPriority && { priority: editPriority }),
                  ...(editBeneficiaries && { beneficiaries: editBeneficiaries.split(',').map((b) => b.trim()).filter(Boolean) }),
                  ...(editEndDate && { endDate: new Date(editEndDate).toISOString() }),
                })
                setEditOpen(false)
                window.location.reload()
              } catch (err) {
                setEditError(err instanceof Error ? err.message : 'Update failed')
              } finally {
                setEditLoading(false)
              }
            }}
          >
            {editLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Campaign</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this campaign? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, mt: 4 }}>
        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab label="Overview" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab label="Updates" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab label="Donations" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab label="Comments" sx={{ fontWeight: 700, textTransform: 'none' }} />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          {/* Description */}
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            About this Campaign
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, whiteSpace: 'pre-line' }}>
            {campaign.description}
          </Typography>

          {/* Collaborators */}
          <CollaboratorSection
            campaignId={campaign.id}
            isOwner={currentUser?.id === campaign.creatorId}
            collaborators={collaborators}
          />

          {/* Accepted Payment Methods */}
          <Box sx={{ mb: 4, p: 3, bgcolor: 'grey.50', borderRadius: SHAPE.card }}>
            <PaymentMethods compact title="Accepted Payment Methods" />
          </Box>

          {/* Creator Info */}
          <Box sx={{ p: 3, bgcolor: 'grey.50', borderRadius: SHAPE.card }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Campaign Creator
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={creator?.avatarUrl}
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: 'primary.main',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                }}
              >
                {creator?.name?.charAt(0).toUpperCase() ?? '?'}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {creator?.name ?? 'Loading...'}
                  </Typography>
                  {creator && creator.verificationLevel >= 2 && (
                    <VerifiedUserIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  )}
                </Box>
                {creator?.country && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
                    {creator.country}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Started on {new Date(campaign.startDate).toLocaleDateString()} &middot; Ends{' '}
                  {new Date(campaign.endDate).toLocaleDateString()}
                </Typography>
              </Box>
              {creator && (
                <TrustBadge level={creator.verificationLevel} />
              )}
            </Box>
          </Box>

          {/* Share & Embed */}
          <Box sx={{ mt: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
            <Box sx={{ flex: 1, p: 3, bgcolor: 'grey.50', borderRadius: SHAPE.card }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Campaign QR Code
              </Typography>
              <CampaignQRCode
                url={`${window.location.origin}/campaigns/${campaign.id}`}
                title="Scan to view campaign"
              />
            </Box>
            <Box sx={{ flex: 1, p: 3, bgcolor: 'grey.50', borderRadius: SHAPE.card }}>
              <EmbedCampaign campaignId={campaign.id} title={campaign.title} />
            </Box>
          </Box>
        </>
      )}

      {activeTab === 1 && (
        <>
          {currentUser?.id === campaign.creatorId && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" onClick={() => setUpdateDialogOpen(true)}>
                Post Update
              </Button>
            </Box>
          )}
          <CampaignUpdates campaignId={campaign.id} isCreator={currentUser?.id === campaign.creatorId} />
          <CreateUpdateDialog
            open={updateDialogOpen}
            onClose={() => setUpdateDialogOpen(false)}
            isLoading={creatingUpdate}
            onSubmit={async (data) => {
              const result = await createUpdate(campaign.id, data)
              if (result) {
                setUpdateDialogOpen(false)
                window.location.reload()
              }
            }}
          />
        </>
      )}

      {activeTab === 2 && (
        <>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            Live Donations
          </Typography>
          <LiveDonationFeed campaignId={campaign.id} maxItems={8} />
          {campaign.donations && campaign.donations.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                All Donations ({campaign.donorCount})
              </Typography>
              {campaign.donations.map((donation) => (
                <Box
                  key={donation.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    mb: 1,
                    bgcolor: 'grey.50',
                    borderRadius: SHAPE.card,
                  }}
                >
                  <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                    {donation.isAnonymous ? '?' : donation.donorName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {donation.isAnonymous ? 'Anonymous' : donation.donorName}
                    </Typography>
                    {donation.message && (
                      <Typography variant="caption" color="text.secondary">
                        {donation.message}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {donation.currency} {donation.amount.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(donation.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      {activeTab === 3 && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Comments coming soon.
          </Typography>
        </Box>
      )}

      {/* Report Campaign */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FlagRoundedIcon />}
          onClick={() => setReportOpen(true)}
          sx={{
            borderColor: 'rgba(239,83,80,0.4)',
            color: '#E53935',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.82rem',
            '&:hover': {
              borderColor: '#E53935',
              bgcolor: 'rgba(239,83,80,0.04)',
            },
          }}
        >
          Report Campaign
        </Button>
      </Box>

      <ReportCampaignDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        campaignId={campaign.id}
        campaignTitle={campaign.title}
      />
    </Container>
  )
}
