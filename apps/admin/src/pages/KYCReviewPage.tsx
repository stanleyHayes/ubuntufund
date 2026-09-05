import { useState, useMemo } from 'react'
import { Alert, Skeleton, Box, Typography, TextField, MenuItem, Button, Dialog } from '@mui/material'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded'
import { type KYCVerification } from '@/hooks/useMockData'
import { useAdminKYCVerifications } from '@/hooks/useApiData'
import { api } from '@/lib/api'
import { Resource, Action } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import KYCDetailDialog from '@/components/kyc/KYCDetailDialog'
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
  const { can } = useAdminPermissions()
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<KYCVerification | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const filtered = useMemo(() => {
    return kycVerifications.filter(v => {
      const st = localStatuses[v.id] ?? v.status
      if (statusFilter !== 'all' && st !== statusFilter) return false
      if (typeFilter !== 'all' && v.verificationType !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return v.userName.toLowerCase().includes(q) || v.verificationType.toLowerCase().includes(q)
      }
      return true
    })
  }, [kycVerifications, statusFilter, typeFilter, search, localStatuses])

  const pagination = usePagination(filtered, PAGE_SIZE)

  const handleAction = (id: string, action: string) => {
    // Optimistically reflect the decision in the queue for a responsive UX.
    setLocalStatuses(prev => ({ ...prev, [id]: action }))
    // Persist to the real KYC review endpoints where they exist.
    // 'in_review' (Request More) has no backend endpoint yet — local-only.
    const path =
      action === 'approved' ? `/kyc/${id}/approve` :
      action === 'rejected' ? `/kyc/${id}/reject` : null
    if (path) {
      api.put(path, {}).catch(() => {
        // Keep the optimistic status; the queue reconciles on next load.
      })
    }
  }

  const pendingCount = kycVerifications.filter(v => v.status === 'pending').length
  const approvedToday = kycVerifications.filter(v => v.status === 'approved' && v.reviewedAt && new Date(v.reviewedAt).toDateString() === new Date().toDateString()).length
  const rejectedToday = kycVerifications.filter(v => v.status === 'rejected' && v.reviewedAt && new Date(v.reviewedAt).toDateString() === new Date().toDateString()).length

  return (
    <Box sx={{ bgcolor: 'background.default', }}>
      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety"
        title="KYC Review"
        lede="Review identity, address, and business KYC submissions with risk scoring, then approve, reject, or request more information."
        icon={<BadgeRoundedIcon />}
        stats={[
          { label: 'Pending', value: loading ? <Skeleton width={60} /> : error ? '—' : pendingCount },
          { label: 'Approved Today', value: loading ? <Skeleton width={60} /> : error ? '—' : approvedToday },
          { label: 'Rejected Today', value: loading ? <Skeleton width={60} /> : error ? '—' : rejectedToday },
        ]}
      />

      {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load verifications. Refresh the page to try again.</Alert>}

      {/* Filter bar */}
      <Box sx={{
        display: 'grid',
        mb: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '160px 160px minmax(0, 1fr) auto' },
        ...raisedSurface,
      }}>
        <Box sx={{ p: 2, minWidth: 0 }}>
          <TextField
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
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ p: 2, minWidth: 0 }}>
          <TextField
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
          <TextField
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
                  onClick={() => { setSelected(v); setDetailOpen(true) }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Review verification for ${v.userName}`}
                  onKeyDown={event => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      setSelected(v)
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
                  {st === 'pending' && can(Resource.VERIFICATIONS, Action.UPDATE) && (
                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.75 }} onClick={e => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleAction(v.id, 'approved')}
                        sx={{
                          flex: '1 1 0', minWidth: 0, px: 1, whiteSpace: 'nowrap',
                          fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                          color: '#8FAE96', borderColor: 'rgba(76,175,80,0.3)',
                          '&:hover': { borderColor: '#8FAE96', bgcolor: 'rgba(76,175,80,0.08)' },
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleAction(v.id, 'rejected')}
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
                        onClick={() => handleAction(v.id, 'in_review')}
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
        <Box sx={{ ...raisedSurface, p: 4 }}>
          <Typography color="text.secondary">
            {search || statusFilter !== 'all' || typeFilter !== 'all' ? 'No KYC submissions match your filters.' : 'No KYC submissions to review.'}
          </Typography>
        </Box>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { ...raisedSurface, color: 'text.primary' } }}>
        {selected && (
          <KYCDetailDialog
            verification={selected}
            onClose={() => setDetailOpen(false)}
            onApprove={() => { handleAction(selected.id, 'approved'); setDetailOpen(false) }}
            onReject={() => { handleAction(selected.id, 'rejected'); setDetailOpen(false) }}
            onRequestMore={() => { handleAction(selected.id, 'in_review'); setDetailOpen(false) }}
          />
        )}
      </Dialog>
    </Box>
  )
}
