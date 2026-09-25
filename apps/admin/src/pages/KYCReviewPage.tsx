import TextField from '@/components/AdminTextField'
import { KYCRejectDialog } from '@/components/kyc/KYCRejectDialog'
import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useState, useMemo } from 'react'
import { Alert, Skeleton, Box, Typography, MenuItem, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import { type KYCVerification } from '@/types/api'
import { useAdminKYCVerifications, useKYCStats } from '@/hooks/useApiData'
import { api } from '@/lib/api'
import { Resource, Action } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import KYCDetailDialog from '@/components/kyc/KYCDetailDialog'
import { EmptyState } from '@ubuntu-fund/ui'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'

const PAGE_SIZE = 9

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
  )
}

const statusColors: Record<string, string> = {
  pending: '#D3A95C',
  in_review: '#74909A',
  approved: '#8FAE96',
  rejected: '#C06B58',
  expired: '#9E9E9E',
}

const riskColors: Record<string, string> = {
  low: '#8FAE96',
  medium: '#D3A95C',
  high: '#C06B58',
}

const typeLabels: Record<string, string> = {
  identity: 'Identity',
  address: 'Address',
  business: 'Business',
  political: 'Political',
  media: 'Media',
}

export default function KYCReviewPage() {
  const { data: kycVerifications, isLoading: loading, error } = useAdminKYCVerifications()
  // Header counts come from GET /kyc/stats (UTC day, all decisions), not from
  // this queue, which only ever holds pending and in-review applications.
  const { data: stats, isLoading: statsLoading, error: statsError, retry: refreshStats } = useKYCStats()
  const { can } = useAdminPermissions()
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('application') ?? '')
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<KYCVerification | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [rejectTarget, setRejectTarget] = useState<{ id: string; reviewVersion: string } | null>(null)
  const [requestTarget, setRequestTarget] = useState<string | null>(null)
  const [requestPrompt, setRequestPrompt] = useState('')
  const [savedRequests, setSavedRequests] = useState<Record<string, NonNullable<KYCVerification['informationRequests']>>>({})

  const filtered = useMemo(() => {
    return kycVerifications.filter(v => {
      const st = localStatuses[v.id] ?? v.status
      if (statusFilter !== 'all' && st !== statusFilter) return false
      if (typeFilter !== 'all' && v.verificationType !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return v.id.toLowerCase().includes(q) || v.userName.toLowerCase().includes(q) || v.verificationType.toLowerCase().includes(q)
      }
      return true
    })
  }, [kycVerifications, statusFilter, typeFilter, search, localStatuses])

  const pagination = usePagination(filtered, PAGE_SIZE)

  const handleAction = async (id: string, action: string, review?: { evidenceReviewed: true; reviewNotes: string }) => {
    if (saving) return
    setActionError('')
    if (action === 'rejected') {
      const target = selected?.id === id && detailOpen ? selected : kycVerifications.find(v => v.id === id)
      if (target) setRejectTarget({ id, reviewVersion: target.reviewVersion })
      return
    }
    if (action === 'in_review') {
      setRequestPrompt('')
      setRequestTarget(id)
      return
    }
    setSaving(true)
    try {
      await api.put(`/kyc/${id}/${action === 'approved' ? 'approve' : 'reject'}`, { ...review, reviewVersion: (selected?.id === id && detailOpen ? selected : kycVerifications.find(v => v.id === id))?.reviewVersion })
      setLocalStatuses(prev => ({ ...prev, [id]: action }))
      setDetailOpen(false)
      refreshStats()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not save the review. Please try again.')
    } finally { setSaving(false) }
  }

  async function saveInformationRequest() {
    if (!requestTarget || saving || requestPrompt.trim().length < 20) return
    setSaving(true); setActionError('')
    try {
      const item = await api.put<NonNullable<KYCVerification['informationRequests']>[number]>(`/kyc/${requestTarget}/request-info`, { prompt: requestPrompt.trim(), reviewVersion: (selected?.id === requestTarget && detailOpen ? selected : kycVerifications.find(v => v.id === requestTarget))?.reviewVersion })
      const previous = savedRequests[requestTarget] ?? kycVerifications.find(v => v.id === requestTarget)?.informationRequests ?? []
      setSavedRequests(prev => ({ ...prev, [requestTarget]: [...previous, item] }))
      setLocalStatuses(prev => ({ ...prev, [requestTarget]: 'in_review' }))
      refreshStats()
      setSelected(prev => prev?.id === requestTarget ? { ...prev, status: 'in_review', informationRequests: [...previous, item] } : prev)
      setRequestTarget(null); setDetailOpen(false)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not save the information request. Please retry.') }
    finally { setSaving(false) }
  }


  return (
    <Box sx={{ bgcolor: 'background.default', }}>
      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety"
        title="KYC Review"
        lede="Review identity, address, and business KYC submissions with risk scoring, then approve, reject, or request more information."
        icon={<BadgeRoundedIcon />}
        stats={[
          { label: 'Pending', value: statsLoading ? <Skeleton width={60} /> : statsError ? '—' : stats.pending },
          { label: 'Approved today (UTC)', value: statsLoading ? <Skeleton width={60} /> : statsError ? '—' : stats.approvedToday },
          { label: 'Rejected today (UTC)', value: statsLoading ? <Skeleton width={60} /> : statsError ? '—' : stats.rejectedToday },
        ]}
      actions={<ExportMenu title="KYC review" disabled={loading || !!error} getReport={async progress => { const rows = (await loadAll<KYCVerification>('/kyc/pending', progress)).filter(r => (statusFilter === 'all' || r.status === statusFilter) && (typeFilter === 'all' || r.verificationType === typeFilter) && (!search || [r.id, r.userName, r.verificationType].some(value => value.toLowerCase().includes(search.toLowerCase()))));
return { title: 'KYC review queue', filters: [`Status: ${statusFilter}`, `Type: ${typeFilter}`, `Search: ${search || 'All'}`], tables: [exportTable('Verification decisions', rows, { ID: r => r.id, Account: r => r.userId, Name: r => r.userName, Type: r => r.verificationType, Status: r => r.status, Risk: r => r.riskLevel, 'Submitted (UTC)': r => dateCell(r.createdAt), 'Reviewed (UTC)': r => dateCell(r.reviewedAt) })] } }} />}
      />


      {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load verifications. Refresh the page to try again.</Alert>}

      {actionError && <Alert severity="error" sx={{ mb: 3 }}>{actionError}</Alert>}
      {/* Filter bar */}
      <Box sx={{
        display: 'grid',
        mb: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'minmax(210px, 1fr) minmax(210px, 1fr) minmax(240px, 2fr) auto' },
        ...raisedSurface,
      }}>
        <Box sx={{ p: 2, minWidth: 0 }}>
          <TextField optionContext="verification"
            select
            fullWidth
            size="small"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value) }}
            label="Status"
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_review">In Review</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ p: 2, minWidth: 0 }}>
          <TextField optionContext="verification"
            select
            fullWidth
            size="small"
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value) }}
            label="Type"
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="identity">Identity</MenuItem>
            <MenuItem value="address">Address</MenuItem>
            <MenuItem value="business">Business</MenuItem>
            <MenuItem value="political">Political</MenuItem>
            <MenuItem value="media">Media</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ p: 2, minWidth: 0 }}>
          <TextField optionContext="verification"
            fullWidth
            size="small"
            placeholder="Search KYC verifications..."
            slotProps={{ htmlInput: { 'aria-label': 'Search KYC verifications...' } }}
            value={search}
            onChange={e => { setSearch(e.target.value) }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem', fontFamily: '"Outfit", monospace', whiteSpace: 'nowrap' }}>
            {loading ? <Skeleton width={90} /> : error ? 'Unavailable' : `${filtered.length} verifications`}
          </Typography>
        </Box>
      </Box>

      {/* Content grid */}
      <Box sx={{
        display: 'grid',
        gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Box key={i} sx={{

                ...raisedSurface, p: 3,
              }}>
                <Skel w={70} h={18} />
                <Box sx={{ mt: 2 }}><Skel w="60%" h={16} /></Box>
                <Box sx={{ mt: 1.5 }}><Skel w="40%" h={12} /></Box>
                <Box sx={{ mt: 2, ...insetSurface, px: 1.5, pb: 1.5, pt: 2 }}><Skel w={90} h={12} /></Box>
                <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                  <Skel w={70} h={28} />
                  <Skel w={70} h={28} />
                </Box>
              </Box>
            ))
          : pagination.page.map((v) => {
              const st = localStatuses[v.id] ?? v.status
              const color = statusColors[st] || '#74909A'
              const riskColor = riskColors[v.riskLevel] || '#74909A'
              return (
                <Box
                  key={v.id}
                  onClick={() => { setSelected({ ...v, status: st as KYCVerification['status'], informationRequests: savedRequests[v.id] ?? v.informationRequests }); setActionError(''); setDetailOpen(true) }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Review verification for ${v.userName}`}
                  onKeyDown={event => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      setSelected({ ...v, status: st as KYCVerification['status'], informationRequests: savedRequests[v.id] ?? v.informationRequests })
                      setActionError('')
                      setDetailOpen(true)
                    }
                  }}
                  sx={{
                    position: 'relative',

                    ...raisedSurface,

                    p: 3,
                    overflow: 'hidden',
                    transition: 'box-shadow 160ms ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    cursor: 'pointer',
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 3 },
                    '&:hover': {
                      boxShadow: 'var(--neu-raised-hover)',
                    },
                  }}
                >
                  <Box aria-hidden="true" sx={{ ...insetSurface, display: 'grid', placeItems: 'center', width: 40, height: 40, mb: 2, color }}>
                    <VerifiedUserIcon sx={{ fontSize: 22 }} />
                  </Box>

                  {/* Status chip */}
                  <Typography sx={{
                    display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    color: color, letterSpacing: '0.08em',
                    ...insetSurface, px: 1, py: 0.25, mr: 1,
                  }}>
                    {st}
                  </Typography>

                  {/* Risk chip */}
                  <Typography sx={{
                    display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    color: riskColor, letterSpacing: '0.08em',
                    ...insetSurface, px: 1, py: 0.25,
                  }}>
                    {v.riskLevel} risk
                  </Typography>

                  {/* User name */}
                  <Typography sx={{ mt: 1.5, fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', fontFamily: '"Outfit", sans-serif' }}>
                    {v.userName}
                  </Typography>

                  {/* Type + docs */}
                  <Typography sx={{ mt: 0.5, fontSize: '0.78rem', color: 'text.secondary' }}>
                    {typeLabels[v.verificationType] ?? v.verificationType} — {v.documents.length} document{v.documents.length !== 1 ? 's' : ''}
                  </Typography>

                  {/* Personal info preview */}
                  {v.personalInfo && (
                    <Typography sx={{ mt: 0.5, fontSize: '0.72rem', color: 'text.secondary' }}>
                      {v.personalInfo.fullName} • {v.personalInfo.nationality}
                    </Typography>
                  )}

                  {/* Business info preview */}
                  {v.businessInfo && (
                    <Typography sx={{ mt: 0.5, fontSize: '0.72rem', color: 'text.secondary' }}>
                      {v.businessInfo.businessName} • {v.businessInfo.businessType}
                    </Typography>
                  )}

                  {/* Separator */}
                  <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 1.5 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      Submitted: <Box component="span" sx={{ color: 'text.secondary' }}>{new Date(v.createdAt).toLocaleDateString()}</Box>
                    </Typography>
                  </Box>

                  {/* Actions — segmented one-line row; each label stays on a single line */}
                  {st === 'in_review' && <Typography sx={{ mt: 2 }}>Awaiting applicant response. Refresh the queue to check for updates.</Typography>}
                  {st === 'pending' && can(Resource.VERIFICATIONS, Action.UPDATE) && (
                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.75 }} onClick={e => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={saving}
                        onClick={() => { setSelected({ ...v, status: st as KYCVerification['status'], informationRequests: savedRequests[v.id] ?? v.informationRequests }); setActionError(''); setDetailOpen(true) }}
                        sx={{
                          flex: '1 1 0', minWidth: 0, px: 1, whiteSpace: 'nowrap',
                          fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                          color: '#8FAE96', borderColor: 'rgba(76,175,80,0.3)',
                          '&:hover': { borderColor: '#8FAE96', bgcolor: 'rgba(76,175,80,0.08)' },
                        }}
                      >
                        Review evidence
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={saving}
                        onClick={() => void handleAction(v.id, 'rejected')}
                        sx={{
                          flex: '1 1 0', minWidth: 0, px: 1, whiteSpace: 'nowrap',
                          fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                          color: '#C06B58', borderColor: 'rgba(239,83,80,0.3)',
                          '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(239,83,80,0.08)' },
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={saving}
                        onClick={() => void handleAction(v.id, 'in_review')}
                        sx={{
                          flex: '1 1 0', minWidth: 0, px: 1, whiteSpace: 'nowrap',
                          fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                          color: '#74909A', borderColor: 'rgba(66,165,245,0.3)',
                          '&:hover': { borderColor: '#74909A', bgcolor: 'rgba(66,165,245,0.08)' },
                        }}
                      >
                        Request
                      </Button>
                    </Box>
                  )}
                </Box>
              )
            })
        }
      </Box>

      {!loading && !error && <PaginationBar neumorphic pagination={pagination} accentColor="#C06B58" />}

      {!loading && !error && filtered.length === 0 && (
        search || statusFilter !== 'all' || typeFilter !== 'all' ? (
          <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState
            variant="search"
            title="No KYC submissions match your filters"
            description="Try a different search term or clear the status and type filters to see more submissions."
            compact
          /></Box>
        ) : (
          <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState
            variant="noData"
            title="No KYC submissions to review"
            description="When members submit identity documents for verification, they'll appear here for your review."
            compact
          /></Box>
        )
      )}

      <Button disabled={saving || !!requestTarget} onClick={() => window.location.reload()}>Refresh queue</Button>
      <Dialog open={!!requestTarget} onClose={() => { if (!saving) setRequestTarget(null) }} maxWidth="sm" fullWidth aria-labelledby="kyc-request-title">
        <DialogTitle id="kyc-request-title">Request more information</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Explain what the applicant needs to clarify or upload. This request will appear in their verification account.</Typography>
          <TextField optionContext="verification" autoFocus fullWidth multiline minRows={3} label="Information needed" value={requestPrompt} disabled={saving} onChange={event => setRequestPrompt(event.target.value)} inputProps={{ maxLength: 2000 }} helperText={`${requestPrompt.trim().length}/2000 characters (at least 20)`} />
          {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setRequestTarget(null)}>Cancel</Button>
          <Button disabled={saving || requestPrompt.trim().length < 20} onClick={() => void saveInformationRequest()}>{saving ? 'Saving…' : 'Save request'}</Button>
        </DialogActions>
      </Dialog>
      {rejectTarget && <KYCRejectDialog key={rejectTarget.id} {...rejectTarget} onClose={() => setRejectTarget(null)} onSaved={() => {
        setLocalStatuses(previous => ({ ...previous, [rejectTarget.id]: 'rejected' })); setRejectTarget(null); setDetailOpen(false); refreshStats()
      }} />}
      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { ...raisedSurface, color: 'text.primary' } }}>
        {selected && (
          <KYCDetailDialog
            key={`${selected.id}:${selected.reviewVersion}`}
            verification={selected}
            onClose={() => setDetailOpen(false)}
            saving={saving}
            actionError={actionError}
            onApprove={review => void handleAction(selected.id, 'approved', review)}
            onReject={() => void handleAction(selected.id, 'rejected')}
            onRequestMore={() => void handleAction(selected.id, 'in_review')}
          />
        )}
      </Dialog>
    </Box>
  )
}
