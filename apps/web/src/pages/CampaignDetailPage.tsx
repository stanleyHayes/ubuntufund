import { CampaignOrganizer } from '@/components/campaigns/CampaignOrganizer'
import { CampaignCashout } from '@/components/campaigns/CampaignCashout'
import { LoadingDots, sizedImageUrl, breadcrumbList } from '@ubuntu-fund/ui'
import { useState, useEffect } from 'react'
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import { CoverPlaceholder } from '@/components/campaigns/CampaignCard'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import { CurrencyDisplay, PaymentMethods, ErrorState, ItemNotFound, SHAPE, type PaymentMethodData } from '@ubuntu-fund/ui'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import { useAuth } from '@/context/AuthContext'
import { useUser } from '@/hooks/useUser'
import {
  CampaignStatus,
  type CampaignCollaborator,
} from '@ubuntu-fund/types'
import { useCampaign } from '@/hooks/useCampaigns'
import { ReportCampaignDialog } from '@/components/campaigns/ReportCampaignDialog'
import { CollaboratorSection } from '@/components/campaigns/CollaboratorSection'
import { CampaignSplitSetup } from '@/components/campaigns/CampaignSplitSetup'
import { ShareCampaignButton } from '@/components/campaigns/ShareCampaignButton'
import { CampaignQRCode } from '@/components/campaigns/CampaignQRCode'
import { CampaignUpdates } from '@/components/campaigns/CampaignUpdates'
import { CampaignComments } from '@/components/campaigns/CampaignComments'
import { CreateUpdateDialog } from '@/components/campaigns/CreateUpdateDialog'
import { useCreateCampaignUpdate } from '@/hooks/useCampaignUpdates'
import { LiveCampaignProgress } from '@/components/campaigns/LiveCampaignProgress'
import { CampaignDonationHistory } from '@/components/campaigns/CampaignDonationHistory'
import { api } from '@/lib/api'
import { acceptsCampaignDonation, validWalletDonationAmount, walletDonationProviders } from '@/lib/campaignDetailPolicy'
import { useEnabledPaymentProviders } from '@/hooks/useEnabledPaymentProviders'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
}

/** Statuses a campaign page must never be indexed in — it is not public yet, or no longer is. */
const UNINDEXED_STATUSES: CampaignStatus[] = [
  CampaignStatus.DRAFT,
  CampaignStatus.PENDING_REVIEW,
  CampaignStatus.BLOCKED,
]

/** Collapse whitespace and trim to `max` characters at a word boundary. */
function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:\u2014-]+$/, '')}\u2026`
}

/** Meta description built from the organizer's own story, topped up when it is very short. */
function campaignDescription(story: string): string {
  const blurb = clip(story || '', 155)
  if (blurb.length >= 100) return blurb
  return `${blurb ? `${blurb} ` : ''}Donate by mobile money or card on Ujimora.`
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <CampaignDetailContent key={id} />
}

function CampaignDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { campaign, isLoading, error, refresh } = useCampaign(id ?? '')
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null)
  useEffect(() => {
    if (!campaign?.id) return
    let stopped = false
    const load = () => api.get<{ id: string } | null>(`/campaigns/${campaign.id}/active-live`).then(value => { if (!stopped) setLiveSessionId(value?.id ?? null) }).catch(() => {})
    void load(); const timer = setInterval(load, 15000)
    return () => { stopped = true; clearInterval(timer) }
  }, [campaign?.id])
  const [collaborators, setCollaborators] = useState<CampaignCollaborator[]>([])
  const [collaboratorError, setCollaboratorError] = useState(false)

  const {
    providers: enabledProviders,
    isLoading: providersLoading,
    error: providersError,
  } = useEnabledPaymentProviders()

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api.get<CampaignCollaborator[]>(`/campaigns/${id}/collaborators`)
      .then((data) => { if (!cancelled) { setCollaborators(data); setCollaboratorError(false) } })
      .catch(() => { if (!cancelled) { setCollaborators([]); setCollaboratorError(true) } })
    return () => { cancelled = true }
  }, [id])

  const [donateOpen, setDonateOpen] = useState(false)
  const [donationRevision, setDonationRevision] = useState(0)
  const [donateAmount, setDonateAmount] = useState('')
  const [donateMessage, setDonateMessage] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<PaymentMethodData | null>(null)
  const [snackOpen, setSnackOpen] = useState(false)
  const [donating, setDonating] = useState(false)
  const [donateError, setDonateError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const { user: currentUser } = useAuth()
  const { user: creator, isLoading: creatorLoading } = useUser(campaign?.creatorId ?? '')
  const [activeTab, setActiveTab] = useState(0)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const { create: createUpdate, isLoading: creatingUpdate } = useCreateCampaignUpdate()

  // /campaigns/:id, /c/:slug and /c/:id all resolve to this same campaign, so
  // every one of them declares the slug form canonical — one public URL rather
  // than three competing for the same ranking signals.
  const cover = campaign?.imageUrls?.[0]
  useSeo({
    title: campaign ? `${clip(campaign.title, 46)} | Ujimora` : 'Campaign | Ujimora',
    description: campaign
      ? campaignDescription(campaign.description)
      : 'Read the story behind this fundraiser on Ujimora, see how close it is to its cedi goal, and donate securely by mobile money or card in seconds.',
    path: campaign
      ? `/c/${encodeURIComponent(campaign.slug || campaign.id)}`
      : `/campaigns/${encodeURIComponent(id ?? '')}`,
    type: 'article',
    image: cover && /^https?:\/\//i.test(cover) ? cover : undefined,
    robots: campaign && UNINDEXED_STATUSES.includes(campaign.status) ? 'noindex, follow' : undefined,
    // The trail replaces the bare URL under the search result, so a campaign
    // shows its path through the site rather than `app.ujimora.com/c/...`.
    jsonLd: campaign
      ? breadcrumbList(SITE_ORIGIN, [
          { name: 'Home', path: '/' },
          { name: 'Explore', path: '/explore' },
          { name: campaign.title },
        ])
      : undefined,
  })

  const walletProviders = walletDonationProviders(enabledProviders)
  function handleOpenDonate() {
    if (!acceptsCampaignDonation(campaign) || providersLoading || providersError || !walletProviders.length) return
    if (!currentUser) { navigate('/login', { state: { from: { pathname: `/campaigns/${id}` } } }); return }
    setDonateOpen(true)
    setDonateAmount('')
    setDonateMessage('')
    setSelectedProvider(null)
    setDonateError('')
  }

  function handleCloseDonate() {
    if (donating) return
    setDonateOpen(false)
    setDonateError('')
  }

  const canSubmit =
    donateAmount &&
    validWalletDonationAmount(donateAmount) &&
    donateMessage.length <= 500 &&
    !!currentUser && acceptsCampaignDonation(campaign) &&
    !providersLoading && !providersError && walletProviders.some((p) => p.slug === selectedProvider?.slug) &&
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
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Button component={RouterLink} to="/explore" startIcon={<ArrowBackRoundedIcon />} sx={{ mb: 3, color: 'text.secondary' }}>Explore campaigns</Button>
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
      <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 800, maxWidth: 940, fontSize: { xs: '2rem', md: '3rem' }, lineHeight: 1.12, mb: 4 }}>
        {campaign.title}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.6fr) minmax(0, 1fr)' }, gap: { xs: 3, md: 4 }, alignItems: 'stretch' }}>
        <Box sx={{ borderRadius: SHAPE.card, overflow: 'hidden', boxShadow: 'var(--neu-raised)', minWidth: 0, bgcolor: 'background.paper' }}>
          {campaign.imageUrls[0] ? (
            <Box component="img" src={sizedImageUrl(campaign.imageUrls[0], { width: 900 })} alt={campaign.title} sx={{ width: '100%', height: { xs: 260, md: '100%' }, minHeight: { md: 400 }, objectFit: 'cover', display: 'block' }} />
          ) : <CoverPlaceholder category={campaign.category} height={400} />}
        </Box>
        <Box component="aside" aria-label="Support this campaign" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)', minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">Make a difference</Typography>
          <Typography component="h2" variant="h5" sx={{ fontWeight: 800, mt: 0.5, mb: 3 }}>Help move this cause forward</Typography>
      {/* Progress */}
      <Box sx={{ mb: 3 }}>
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
      <Box sx={{ display: 'flex', gap: 1.5, flexDirection: 'column', alignItems: 'stretch' }}>
        {liveSessionId && <Button component={RouterLink} to={`/live/${liveSessionId}`} variant="outlined" color="primary">Watch live broadcast</Button>}
        <Button
          variant="contained"
          color="secondary"
          size="large"
          sx={{ px: 4 }}
          component={RouterLink}
          to={`/c/${encodeURIComponent(campaign.slug || campaign.id)}/donate`}
          disabled={!acceptsCampaignDonation(campaign)}
        >
          {!acceptsCampaignDonation(campaign) ? 'Donations closed' : 'Donate now'}
        </Button>
        {campaign.status === CampaignStatus.ACTIVE && (
          <CurrencyDisplay
            amount={Math.max(0, campaign.goalAmount - campaign.raisedAmount)}
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
              variant="contained"
              size="small"
              onClick={() => navigate(`/campaigns/${campaign.id}/live`)}
              sx={{ fontWeight: 700 }}
            >
              Go LIVE
            </Button>
          </>
        )}
      </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 3, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box><PeopleOutlineRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} /><Typography sx={{ fontWeight: 700, mt: 0.5 }}>{campaign.donorCount ?? 0} {(campaign.donorCount ?? 0) === 1 ? 'donor' : 'donors'}</Typography><Typography variant="caption" color="text.secondary">Distinct supporters</Typography></Box>
            <Box><CalendarTodayRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} /><Typography sx={{ fontWeight: 700, mt: 0.5 }}>{new Date(campaign.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</Typography><Typography variant="caption" color="text.secondary">Campaign end date</Typography></Box>
          </Box>
        </Box>
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
            inputProps={{ min: 0.01, step: 0.01 }}
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
            ) : providersError ? (
              <Alert severity="warning">Payment methods could not be loaded. Refresh the page to try again.</Alert>
            ) : walletProviders.length > 0 ? (
              <PaymentMethods compact providers={walletProviders.map((p) => ({ ...p, type: 'wallet' as const }))} onSelect={setSelectedProvider} selectedSlug={selectedProvider?.slug} />
            ) : <Alert severity="info">Wallet donations are not currently available.</Alert>}
          </Box>

          <Box>
            <TextField
              label="Message (optional)"
              inputProps={{ maxLength: 500 }}
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
          <Button disabled={donating} onClick={handleCloseDonate}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!canSubmit}
            onClick={async () => {
              if (!canSubmit) return
              setDonating(true)
              setDonateError('')
              try {
                await api.post(`/campaigns/${id}/donate`, {
                  amount: Number(donateAmount),
                  currency: campaign.currency,
                  paymentMethod: 'wallet',
                  message: donateMessage || undefined,
                  isAnonymous: false,
                })
                setDonateOpen(false)
                refresh()
                setDonationRevision((value) => value + 1)
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
            {donating ? <><LoadingDots size={6} /> <span>Submitting...</span></> : 'Confirm Donation'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackOpen}
        autoHideDuration={4000}
        onClose={() => setSnackOpen(false)}
        message="Your wallet donation was completed."
      />

      {/* Tabs */}
      <Box sx={{ borderRadius: SHAPE.sm, boxShadow: 'var(--neu-inset)', p: 0.75, mb: 4, mt: 5 }}>
        <Tabs
          aria-label="Campaign information"
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab id="campaign-tab-0" aria-controls="campaign-panel" label="Overview" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab id="campaign-tab-1" aria-controls="campaign-panel" label="Updates" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab id="campaign-tab-2" aria-controls="campaign-panel" label="Donations" sx={{ fontWeight: 700, textTransform: 'none' }} />
          <Tab id="campaign-tab-3" aria-controls="campaign-panel" label="Comments" sx={{ fontWeight: 700, textTransform: 'none' }} />
        </Tabs>
      </Box>

      <Box role="tabpanel" id="campaign-panel" aria-labelledby={`campaign-tab-${activeTab}`} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: SHAPE.card, boxShadow: 'var(--neu-raised)', bgcolor: 'background.paper', minWidth: 0 }}>
      {activeTab === 0 && (
        <>
          {/* Description */}
          <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
            About this campaign
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, whiteSpace: 'pre-line', lineHeight: 1.9, fontSize: '1.05rem', maxWidth: 820, overflowWrap: 'anywhere' }}>
            {campaign.description}
          </Typography>

          {campaign.beneficiaries.length > 0 && <Box sx={{ mb: 4 }}><Typography component="h2" variant="h6" sx={{ mb: 1 }}>Who this supports</Typography><Box component="ul" sx={{ pl: 2.5, color: 'text.secondary' }}>{campaign.beneficiaries.map((name, index) => <li key={index}>{name}</li>)}</Box></Box>}
          {/* Collaborators */}
          {collaboratorError && <Alert severity="warning" sx={{ mb: 2 }}>Collaborator details could not be loaded.</Alert>}
          <CollaboratorSection
            campaignId={campaign.id}
            isOwner={currentUser?.id === campaign.creatorId}
            collaborators={collaborators}
          />

          <Box id="campaign-details" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3, mt: 3, scrollMarginTop: 100 }}>
            <CampaignOrganizer creator={creator} loading={creatorLoading} startDate={campaign.startDate} endDate={campaign.endDate} />

            <Box component="section" aria-labelledby="payment-heading" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-inset)', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="overline" color="text.secondary">Your contribution</Typography>
              <Typography id="payment-heading" component="h2" variant="h6" sx={{ fontWeight: 800, mb: 2.5 }}>How to donate</Typography>
              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Card or Mobile Money</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>Continue to secure checkout to pay by card or MoMo. Crypto appears there when available. You do not need to fund a Ujimora wallet first.</Typography>
                <Button component={RouterLink} to={`/c/${encodeURIComponent(campaign.slug || campaign.id)}/donate`} fullWidth variant="contained" disabled={!acceptsCampaignDonation(campaign)}>Continue to checkout</Button>
              </Box>
              {providersLoading ? <Skeleton height={90} /> : providersError ? <Alert severity="warning">Payment methods could not be loaded. Refresh the page to try again.</Alert> : walletProviders.length > 0 ? <>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{ width: 48, height: 48, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: SHAPE.sm, color: 'var(--text-warning)', bgcolor: 'background.paper', boxShadow: 'var(--neu-subtle)' }}><AccountBalanceWalletOutlinedIcon /></Box>
                  <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800, fontSize: '1.05rem', overflowWrap: 'anywhere' }}>{walletProviders[0].name}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.7 }}>Use your wallet balance, or add funds from the Wallet page.</Typography></Box>
                </Box>
                <Box sx={{ mt: 'auto', pt: 3 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{!acceptsCampaignDonation(campaign) ? 'This campaign is not accepting donations.' : currentUser ? 'Choose an amount to support this campaign.' : 'Sign in to use your Ujimora wallet.'}</Typography>
                  <Button fullWidth variant="outlined" onClick={handleOpenDonate} disabled={!acceptsCampaignDonation(campaign)} sx={{ justifyContent: 'space-between' }}>{currentUser ? 'Donate with wallet' : 'Sign in to donate'}<Box component="span" aria-hidden="true">→</Box></Button>
                </Box>
              </> : <Alert severity="info">Wallet donations are not currently available.</Alert>}
            </Box>
          </Box>

          {currentUser?.id === campaign.creatorId && <><CampaignCashout campaignId={campaign.id} /><CampaignSplitSetup campaignId={campaign.id} /></>}
          {/* Share & Embed */}
          <Box component="details" sx={{ mt: 4, p: 3, borderRadius: SHAPE.card, boxShadow: 'var(--neu-inset)', '& > summary': { cursor: 'pointer', fontWeight: 700 }, '& > div': { mt: 2 } }}><Box component="summary">Share this campaign · QR code</Box>
            <Box sx={{ flex: 1, p: 3, bgcolor: 'action.hover', borderRadius: SHAPE.card }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Campaign QR Code
              </Typography>
              <CampaignQRCode
                url={`${window.location.origin}/campaigns/${campaign.id}`}
                title="Scan to view campaign"
              />
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
              } else {
                throw new Error('Could not publish the update. Please try again.')
              }
            }}
          />
        </>
      )}

      {activeTab === 2 && <CampaignDonationHistory key={`${campaign.id}:${donationRevision}`} campaignId={campaign.id} />}

      {activeTab === 3 && (
        <CampaignComments campaignId={campaign.id} creatorId={campaign.creatorId} />
      )}

      </Box>

      {/* Report Campaign */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FlagRoundedIcon />}
          onClick={() => currentUser ? setReportOpen(true) : navigate('/login', { state: { from: { pathname: `/campaigns/${id}` } } })}
          sx={{
            borderColor: 'rgba(239,83,80,0.4)',
            color: 'var(--text-error)',
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
