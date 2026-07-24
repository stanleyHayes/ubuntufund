import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import TimelineIcon from '@mui/icons-material/Timeline'
import CampaignIcon from '@mui/icons-material/Campaign'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { ItemNotFound, AiWritingBar } from '@ubuntu-fund/ui'
import { AiWritingAction } from '@ubuntu-fund/types'
import { keyframes } from '@mui/material/styles'
import PageHeader from '@/components/PageHeader'

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface MockDispute {
  id: string
  title: string
  description: string
  campaignId: string
  campaignTitle: string
  reportedBy: string
  reporterName: string
  assignedTo: string
  status: 'open' | 'under_review' | 'resolved' | 'dismissed'
  priority: string
  createdAt: Date
  updatedAt: Date
  resolution?: string
  resolutionType?: string
}

const MOCK_DISPUTES: MockDispute[] = [
  {
    id: '1',
    title: 'Misleading campaign images',
    description:
      'The campaign "Clean Water for Tamale" appears to be using stock photos instead of actual project images. Multiple donors have flagged this.',
    campaignId: '1',
    campaignTitle: 'Clean Water for Tamale Community',
    reportedBy: 'user-5',
    reporterName: 'Yaw Darko',
    assignedTo: 'admin-1',
    status: 'under_review',
    priority: 'high',
    createdAt: new Date('2026-03-25'),
    updatedAt: new Date('2026-03-28'),
  },
  {
    id: '2',
    title: 'Suspected fraudulent campaign',
    description:
      'This campaign appears to have fabricated beneficiary information. The listed organization does not exist in public records.',
    campaignId: '2',
    campaignTitle: 'Build a School in Kumasi',
    reportedBy: 'user-3',
    reporterName: 'Abena Sarpong',
    assignedTo: 'admin-1',
    status: 'open',
    priority: 'critical',
    createdAt: new Date('2026-03-26'),
    updatedAt: new Date('2026-03-26'),
  },
  {
    id: '3',
    title: 'Funds misuse reported',
    description:
      'A donor has reported that campaign funds were used for purposes other than what was stated. Evidence of purchases unrelated to the campaign goal.',
    campaignId: '3',
    campaignTitle: 'Medical Fund for Abena',
    reportedBy: 'user-8',
    reporterName: 'Kojo Antwi',
    assignedTo: 'admin-2',
    status: 'resolved',
    priority: 'high',
    createdAt: new Date('2026-03-20'),
    updatedAt: new Date('2026-03-27'),
    resolution:
      'Investigation complete. The campaign creator provided receipts confirming funds were used for medical expenses as stated. The reported purchases were medical supplies bought from a general store, which caused confusion. Case dismissed with no further action.',
    resolutionType: 'resolved',
  },
]

const MOCK_TIMELINE = [
  { label: 'Dispute created', date: '2026-03-25', color: '#C06B58' },
  { label: 'Assigned to admin', date: '2026-03-25', color: '#D3A95C' },
  { label: 'Under review', date: '2026-03-26', color: '#74909A' },
  { label: 'Evidence requested from reporter', date: '2026-03-27', color: '#74909A' },
  { label: 'Campaign creator contacted', date: '2026-03-28', color: '#D3A95C' },
]

const MOCK_CAMPAIGN_STATS = {
  raised: 12500,
  goal: 25000,
  donors: 84,
  daysLeft: 23,
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { color: string; muiColor: 'warning' | 'info' | 'success' | 'default' }> = {
  open: { color: '#D3A95C', muiColor: 'warning' },
  under_review: { color: '#74909A', muiColor: 'info' },
  resolved: { color: '#5E8F72', muiColor: 'success' },
  dismissed: { color: '#9E9E9E', muiColor: 'default' },
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// DisputeDetailPage
// ---------------------------------------------------------------------------

export default function DisputeDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const dispute = MOCK_DISPUTES.find((d) => d.id === id)

  const [resolutionNotes, setResolutionNotes] = useState('')
  const [resolutionType, setResolutionType] = useState('resolved')
  const [currentStatus, setCurrentStatus] = useState(dispute?.status ?? 'open')
  const [currentResolution, setCurrentResolution] = useState(dispute?.resolution)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  if (!dispute) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <ItemNotFound itemType="Dispute" onBack={() => navigate('/disputes')} backLabel="Back to Disputes" />
      </Box>
    )
  }

  const statusConfig = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.open

  function handleSubmitResolution() {
    if (!resolutionNotes.trim()) {
      setSnackbar({ open: true, message: 'Resolution notes are required.', severity: 'error' })
      return
    }

    setCurrentStatus(resolutionType as MockDispute['status'])
    setCurrentResolution(resolutionNotes)
    setSnackbar({ open: true, message: 'Resolution submitted successfully.', severity: 'success' })
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto', animation: `${fadeSlide} 0.4s ease both` }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
        <Link
          underline="hover"
          color="text.secondary"
          sx={{ cursor: 'pointer', fontSize: '0.85rem' }}
          onClick={() => navigate('/disputes')}
        >
          Disputes
        </Link>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
          Dispute #{dispute.id}
        </Typography>
      </Breadcrumbs>

      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety · Dispute"
        title={dispute.title}
        lede="Review the report, evidence, and campaign context, then record how the dispute was resolved."
        icon={<GavelRoundedIcon />}
        actions={
          <>
            <Chip
              label={formatStatus(currentStatus)}
              color={statusConfig.muiColor}
              size="small"
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
            <Chip
              label={dispute.priority.toUpperCase()}
              size="small"
              sx={{
                bgcolor: dispute.priority === 'critical' ? 'rgba(192,107,88,0.15)' : 'rgba(211,169,92,0.15)',
                color: dispute.priority === 'critical' ? '#C06B58' : '#D3A95C',
                fontWeight: 700,
                fontSize: '0.68rem',
              }}
            />
          </>
        }
      />

      {/* Two-column layout */}
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Left column (wider) */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Dispute Details Card */}
          <Card sx={{ bgcolor: '#1E1E2D', mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Dispute Details
              </Typography>

              <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', lineHeight: 1.7, mb: 3 }}>
                {dispute.description}
              </Typography>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.25 }}>
                    Campaign
                  </Typography>
                  <Link
                    underline="hover"
                    sx={{ fontSize: '0.85rem', color: '#5E8F72', cursor: 'pointer' }}
                    onClick={() => navigate(`/campaigns/${dispute.campaignId}`)}
                  >
                    {dispute.campaignTitle}
                  </Link>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.25 }}>
                    Reported By
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                    {dispute.reporterName}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.25 }}>
                    Created
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                    {dispute.createdAt.toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.25 }}>
                    Last Updated
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                    {dispute.updatedAt.toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Resolution section */}
          {currentStatus === 'resolved' || currentStatus === 'dismissed' ? (
            /* Already resolved - show resolution */
            <Card
              sx={{
                bgcolor: '#1E1E2D',
                border: '1px solid rgba(76,175,80,0.15)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckCircleOutlineIcon sx={{ color: '#5E8F72', fontSize: 22 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Resolution
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', lineHeight: 1.7 }}>
                  {currentResolution}
                </Typography>
              </CardContent>
            </Card>
          ) : (
            /* Resolution form */
            <Card sx={{ bgcolor: '#1E1E2D' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                  Submit Resolution
                </Typography>

                <AiWritingBar
                  value={resolutionNotes}
                  onChange={setResolutionNotes}
                  inputLabel="Resolution Notes"
                  allowedActions={[AiWritingAction.FORMALIZE, AiWritingAction.SUMMARIZE, AiWritingAction.FIX_GRAMMAR, AiWritingAction.IMPROVE_CLARITY]}
                />
                <TextField
                  label="Resolution Notes"
                  placeholder="Describe the resolution, actions taken, and outcome..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    },
                  }}
                />

                <TextField
                  select
                  label="Resolution Type"
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    },
                  }}
                >
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="dismissed">Dismissed</MenuItem>
                  <MenuItem value="under_review">Escalated</MenuItem>
                </TextField>

                <Button
                  variant="contained"
                  onClick={handleSubmitResolution}
                  sx={{ bgcolor: '#5E8F72', '&:hover': { bgcolor: '#2F6B46' } }}
                >
                  Submit Resolution
                </Button>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Right column (narrower) */}
        <Box sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
          {/* Timeline Card */}
          <Card sx={{ bgcolor: '#1E1E2D', mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TimelineIcon sx={{ color: '#74909A', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Timeline
                </Typography>
              </Box>

              {MOCK_TIMELINE.map((event, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1.5, mb: idx < MOCK_TIMELINE.length - 1 ? 0 : 0 }}>
                  {/* Dot + line */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      pt: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: event.color,
                        flexShrink: 0,
                      }}
                    />
                    {idx < MOCK_TIMELINE.length - 1 && (
                      <Box
                        sx={{
                          width: 2,
                          flex: 1,
                          bgcolor: 'rgba(255,255,255,0.06)',
                          my: 0.5,
                        }}
                      />
                    )}
                  </Box>
                  {/* Content */}
                  <Box sx={{ pb: 2 }}>
                    <Typography sx={{ fontSize: '0.82rem', color: 'text.primary', fontWeight: 500 }}>
                      {event.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      {event.date}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Related Campaign Card */}
          <Card sx={{ bgcolor: '#1E1E2D' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CampaignIcon sx={{ color: '#5E8F72', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Related Campaign
                </Typography>
              </Box>

              <Link
                underline="hover"
                sx={{ fontSize: '0.88rem', color: '#5E8F72', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => navigate(`/campaigns/${dispute.campaignId}`)}
              >
                {dispute.campaignTitle}
              </Link>

              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 2 }} />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Raised
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#5E8F72' }}>
                    GH₵ {MOCK_CAMPAIGN_STATS.raised.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Goal
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
                    GH₵ {MOCK_CAMPAIGN_STATS.goal.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Donors
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
                    {MOCK_CAMPAIGN_STATS.donors}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Days Left
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
                    {MOCK_CAMPAIGN_STATS.daysLeft}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
