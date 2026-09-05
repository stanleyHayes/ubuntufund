import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Skeleton, Box, Typography, TextField, MenuItem } from '@mui/material'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import GavelIcon from '@mui/icons-material/Gavel'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import Button from '@mui/material/Button'
import { Resource, Action } from '@ubuntu-fund/types'
import { EmptyState } from '@ubuntu-fund/ui'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { useAdminDisputes } from '@/hooks/useApiData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'

const PAGE_SIZE = 8

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
  )
}

const statusColors: Record<string, string> = {
  open: '#C06B58',
  under_review: '#D3A95C',
  resolved: '#8FAE96',
}

export default function DisputesPage() {
  const navigate = useNavigate()
  const { data: disputes, isLoading: loading, error } = useAdminDisputes()
  const { can } = useAdminPermissions()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = disputes.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return d.reason.toLowerCase().includes(q) || d.campaignTitle.toLowerCase().includes(q) || d.reporterName.toLowerCase().includes(q)
    }
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  return (
    <Box sx={{ bgcolor: 'background.default', }}>
      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety"
        title="Disputes"
        lede="Review flagged campaigns and donor complaints, then track each case through to resolution."
        icon={<GavelRoundedIcon />}
      />

      {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load disputes. Refresh the page to try again.</Alert>}

      {/* Filter bar */}
      <Box sx={{
        display: 'grid',
        mb: 3, gridTemplateColumns: { xs: '1fr', md: '200px minmax(0, 1fr) auto' },
        ...raisedSurface,
      }}>
        <Box sx={{ p: 2, minWidth: 0 }}>
          <TextField
            select
            fullWidth
            size="small"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="under_review">Under Review</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ p: 2, minWidth: 0 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search disputes..."
            slotProps={{ htmlInput: { 'aria-label': 'Search disputes...' } }}
            value={search}
            onChange={e => setSearch(e.target.value)}
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
            {loading ? <Skeleton width={90} /> : error ? 'Unavailable' : `${filtered.length} disputes`}
          </Typography>
        </Box>
      </Box>

      {/* Content grid */}
      <Box sx={{
        display: 'grid',
        gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
      }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Box key={i} sx={{  ...raisedSurface, p: 3 }}>
                <Skel w={60} h={18} />
                <Box sx={{ mt: 2 }}><Skel w="80%" h={16} /></Box>
                <Box sx={{ mt: 1.5 }}><Skel w="50%" h={12} /></Box>
                <Box sx={{ mt: 2, ...insetSurface, px: 1.5, pb: 1.5, pt: 2, display: 'flex', gap: 4 }}>
                  <Skel w={100} h={12} />
                  <Skel w={100} h={12} />
                </Box>
              </Box>
            ))
          : pagination.page.map((dispute) => {
              const color = statusColors[dispute.status] || '#74909A'
              return (
                <Box
                  key={dispute.id}
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
                    <GavelIcon sx={{ fontSize: 22 }} />
                  </Box>

                  {/* Status chip */}
                  <Typography sx={{
                    display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    color: color, letterSpacing: '0.08em',
                    ...insetSurface, px: 1, py: 0.25,
                  }}>
                    {dispute.status.replace('_', ' ')}
                  </Typography>

                  {/* Reason */}
                  <Typography sx={{ mt: 1.5, fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', fontFamily: '"Outfit", sans-serif' }}>
                    {dispute.reason}
                  </Typography>

                  {/* Campaign title */}
                  <Typography sx={{ mt: 0.5, fontSize: '0.78rem', color: 'text.secondary' }}>
                    {dispute.campaignTitle}
                  </Typography>

                  {/* Separator */}
                  <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                        Reporter: <Box component="span" sx={{ color: 'text.secondary' }}>{dispute.reporterName}</Box>
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                        Opened: <Box component="span" sx={{ color: 'text.secondary' }}>{new Date(dispute.createdAt).toLocaleDateString()}</Box>
                      </Typography>
                    </Box>
                  </Box>

                  {dispute.assigneeName && (
                    <Typography sx={{ mt: 0.75, fontSize: '0.72rem', color: 'text.secondary' }}>
                      Assignee: <Box component="span" sx={{ color: 'text.secondary' }}>{dispute.assigneeName}</Box>
                    </Typography>
                  )}

                  {dispute.resolution && (
                    <Box sx={{
                      mt: 1.5, p: 1.5, ...insetSurface,
                    }}>
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontStyle: 'italic' }}>
                        {dispute.resolution}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/disputes/${dispute.id}`)}
                      sx={{
                        fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'text.secondary', borderColor: 'rgba(255,255,255,0.15)',
                        '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' },
                      }}
                    >
                      View
                    </Button>
                    {dispute.status !== 'resolved' && can(Resource.DISPUTES, Action.UPDATE) && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/disputes/${dispute.id}`)}
                        sx={{
                          fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: '#8FAE96', borderColor: 'rgba(76,175,80,0.3)',
                          '&:hover': { borderColor: '#8FAE96', bgcolor: 'rgba(76,175,80,0.08)' },
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                  </Box>
                </Box>
              )
            })
        }
      </Box>

      {!loading && !error && filtered.length === 0 && (
        search || statusFilter !== 'all' ? (
          <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState
            variant="search"
            title="No disputes match your filters"
            description="Try a different search term or clear the status filter."
            compact
          /></Box>
        ) : (
          <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState
            variant="noData"
            title="No disputes to review"
            description="When donors or organizers raise a dispute, it will appear here for your team to resolve."
            compact
          /></Box>
        )
      )}

      {!loading && filtered.length > 0 && <PaginationBar neumorphic pagination={pagination} accentColor="#C06B58" />}

    </Box>
  )
}
