import TextField from '@/components/AdminTextField'
import { Link as RouterLink } from 'react-router-dom'
import { KYCRejectDialog } from '@/components/kyc/KYCRejectDialog'
import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useState, useMemo } from 'react'
import { Alert, Skeleton, Box, Typography, MenuItem } from '@mui/material'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import Button from '@mui/material/Button'
import { EmptyState } from '@ubuntu-fund/ui'
import { useAdminKYCVerifications } from '@/hooks/useApiData'
import { VerificationLevel, Resource, Action } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
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

const typeLabels: Record<string, string> = {
  identity: 'Identity',
  address: 'Address',
  business: 'Business',
  political: 'Political',
  media: 'Media',
}

const levelLabels: Record<number, string> = {
  [VerificationLevel.EMAIL_PHONE]: 'Email / Phone',
  [VerificationLevel.NATIONAL_ID]: 'National ID',
  [VerificationLevel.INSTITUTIONAL]: 'Institutional',
  [VerificationLevel.COMMUNITY]: 'Community',
}

type VerificationStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired'

interface Verification {
  id: string
  userId: string
  userName: string
  level: VerificationLevel
  type: string
  status: VerificationStatus
  submittedAt: Date
}

export default function VerificationsPage() {
  const { data: kycVerifications, isLoading: loading, error } = useAdminKYCVerifications()
  const { can } = useAdminPermissions()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [rejectTarget, setRejectTarget] = useState<{ id: string; reviewVersion: string } | null>(null)
  const [localStatuses, setLocalStatuses] = useState<Record<string, VerificationStatus>>({})

  // Project the real KYC review queue onto this page's flatter Verification row.
  const verifications = useMemo<Verification[]>(() => {
    const typeToLevel: Record<string, VerificationLevel> = {
      identity: VerificationLevel.NATIONAL_ID,
      address: VerificationLevel.NATIONAL_ID,
      business: VerificationLevel.INSTITUTIONAL,
      political: VerificationLevel.COMMUNITY,
      media: VerificationLevel.COMMUNITY,
    }
    return kycVerifications.map(v => ({
      id: v.id,
      userId: v.userId,
      userName: v.userName,
      level: typeToLevel[v.verificationType] ?? VerificationLevel.EMAIL_PHONE,
      type: typeLabels[v.verificationType] ?? v.verificationType,
      status: v.status,
      submittedAt: new Date(v.createdAt),
    }))
  }, [kycVerifications])

  const getStatus = (v: Verification): VerificationStatus => localStatuses[v.id] ?? v.status

  const filtered = verifications.filter(v => {
    const st = getStatus(v)
    if (statusFilter !== 'all' && st !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return v.userName.toLowerCase().includes(q) || v.type.toLowerCase().includes(q)
    }
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  const handleReject = (id: string) => {
    const target = kycVerifications.find(v => v.id === id)
    if (target) setRejectTarget({ id, reviewVersion: target.reviewVersion })
  }

  return (
    <Box sx={{ bgcolor: 'background.default', }}>
      {rejectTarget && <KYCRejectDialog key={rejectTarget.id} {...rejectTarget} onClose={() => setRejectTarget(null)} onSaved={() => { setLocalStatuses(previous => ({ ...previous, [rejectTarget.id]: 'rejected' })); setRejectTarget(null) }} />}
      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety"
        title="Verifications"
        lede="Review identity, phone, institutional, and community verification submissions and approve or reject them."
        icon={<VerifiedUserRoundedIcon />}
      actions={<ExportMenu title="Verifications" disabled={loading || !!error} getReport={async progress => { const rows = (await loadAll<import('@/types/api').KYCVerification>('/kyc/pending', progress)).filter(r => (statusFilter === 'all' || r.status === statusFilter) && (!search || [r.userName, typeLabels[r.verificationType] ?? r.verificationType].some(value => value.toLowerCase().includes(search.toLowerCase()))));
return { title: 'Verifications', filters: [`Status: ${statusFilter}`, `Search: ${search || 'All'}`], tables: [exportTable('Verifications', rows, { ID: r => r.id, Account: r => r.userId, Name: r => r.userName, Type: r => r.verificationType, Status: r => r.status, 'Submitted (UTC)': r => dateCell(r.createdAt) })] } }} />}
      />


      {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load verifications. Refresh the page to try again.</Alert>}

      {/* Filter bar */}
      <Box sx={{
        display: 'grid',
        mb: 3, gridTemplateColumns: { xs: '1fr', md: '200px minmax(0, 1fr) auto' },
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
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ p: 2, minWidth: 0 }}>
          <TextField optionContext="verification"
            fullWidth
            size="small"
            placeholder="Search verifications..."
            slotProps={{ htmlInput: { 'aria-label': 'Search verifications...' } }}
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
              const st = getStatus(v)
              const color = statusColors[st] || '#74909A'
              return (
                <Box
                  key={v.id}
                  sx={{
                    position: 'relative',

                    ...raisedSurface,

                    p: 3,
                    overflow: 'hidden',
                    transition: 'box-shadow 160ms ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
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
                    ...insetSurface, px: 1, py: 0.25,
                  }}>
                    {st}
                  </Typography>

                  {/* User name */}
                  <Typography sx={{ mt: 1.5, fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', fontFamily: '"Outfit", sans-serif' }}>
                    {v.userName}
                  </Typography>

                  {/* Level + type */}
                  <Typography sx={{ mt: 0.5, fontSize: '0.78rem', color: 'text.secondary' }}>
                    {levelLabels[v.level] ?? 'Unknown'} — {v.type}
                  </Typography>

                  {/* Separator */}
                  <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 1.5 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      Submitted: <Box component="span" sx={{ color: 'text.secondary' }}>{v.submittedAt.toLocaleDateString()}</Box>
                    </Typography>
                  </Box>

                  {/* Actions */}
                  {st === 'pending' && can(Resource.VERIFICATIONS, Action.UPDATE) && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        component={RouterLink}
                        to={`/kyc-review?application=${encodeURIComponent(v.id)}`}
                        sx={{
                          fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: '#8FAE96', borderColor: 'rgba(47,107,70,0.3)',
                          '&:hover': { borderColor: '#8FAE96', bgcolor: 'rgba(47,107,70,0.08)' },
                        }}
                      >
                        Review evidence
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleReject(v.id)}
                        sx={{
                          fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: '#C06B58', borderColor: 'rgba(192,107,88,0.3)',
                          '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
                        }}
                      >
                        Reject
                      </Button>
                    </Box>
                  )}
                </Box>
              )
            })
        }
      </Box>

      {!loading && !error && filtered.length === 0 && (
        search || statusFilter !== 'all' ? (
          <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState
            variant="search"
            title="No verifications match your filters"
            description="Try a different search term or clear the status filter."
            compact
          /></Box>
        ) : (
          <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState
            variant="noData"
            title="No verifications pending"
            description="Identity and organization verification requests will appear here as members submit them."
            compact
          /></Box>
        )
      )}

      {!loading && !error && <PaginationBar neumorphic pagination={pagination} accentColor="#C06B58" />}

    </Box>
  )
}
