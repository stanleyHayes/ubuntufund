import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Skeleton, Box, Typography, TextField, MenuItem, InputAdornment, Button } from '@mui/material'
import { raisedSurface, insetSurface, progressTrack } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import BlockIcon from '@mui/icons-material/Block'
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb'
import CampaignIcon from '@mui/icons-material/Campaign'
import { EmptyState, SHAPE } from '@ubuntu-fund/ui'
import { CampaignStatus, CampaignCategory } from '@ubuntu-fund/types'
import type { Campaign } from '@ubuntu-fund/types'
import { useAdminCampaigns } from '@/hooks/useApiData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'


const statusColors: Record<string, string> = {
  [CampaignStatus.ACTIVE]: '#5E8F72',
  [CampaignStatus.PENDING_REVIEW]: '#D3A95C',
  [CampaignStatus.FUNDED]: '#74909A',
  [CampaignStatus.EXPIRED]: '#78909C',
  [CampaignStatus.BLOCKED]: '#C06B58',
  [CampaignStatus.DRAFT]: '#616161',
}

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
  )
}

function SkeletonCard() {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      ...raisedSurface,
      p: 3,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        <Skel w={60} h={16} />
        <Skel w={50} h={16} />
      </Box>
      <Skel w="80%" h={18} />
      <Box sx={{ mt: 1 }}><Skel w={100} h={12} /></Box>
      <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Skel w={80} h={12} />
          <Skel w={80} h={12} />
        </Box>
        <Skel h={3} />
      </Box>
      <Box sx={{ mt: 1.5 }}><Skel w={90} h={11} /></Box>
    </Box>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate()
  const accent = statusColors[campaign.status] || '#616161'
  const pct = campaign.goalAmount > 0 ? Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100) : 0
  const barColor = pct >= 100 ? '#74909A' : pct >= 60 ? '#5E8F72' : pct >= 30 ? '#D3A95C' : '#C06B58'

  return (
    <Box
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') navigate(`/campaigns/${campaign.id}`) }}
      sx={{
        position: 'relative', overflow: 'hidden',
        ...raisedSurface,
        p: 3, cursor: 'pointer',
        transition: 'box-shadow 160ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&:hover': { boxShadow: 'var(--neu-raised-hover)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 3 },
      }}
    >
      {/* Status + Category */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, position: 'relative', zIndex: 1 }}>
        <Typography sx={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          ...insetSurface, px: 1, py: 0.5, color: accent, letterSpacing: '0.08em',
        }}>
          {campaign.status.replace('_', ' ')}
        </Typography>
        <Typography sx={{
          fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
          color: 'text.secondary', letterSpacing: '0.05em',
        }}>
          {campaign.category}
        </Typography>
      </Box>

      {/* Title */}
      <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', lineHeight: 1.3, mb: 0.5, position: 'relative', zIndex: 1 }}>
        {campaign.title}
      </Typography>

      {/* Creator */}
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', position: 'relative', zIndex: 1 }}>
        {campaign.creatorId}
      </Typography>

      {/* Separator */}
      <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 2, position: 'relative', zIndex: 1 }}>
        {/* Raised / Goal */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
          <Typography sx={{ fontSize: '0.78rem', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
            GH₵ {campaign.raisedAmount.toLocaleString()} <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>raised</Box>
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
            GH₵ {campaign.goalAmount.toLocaleString()} <Box component="span" sx={{ fontSize: '0.7rem' }}>goal</Box>
          </Typography>
        </Box>

        {/* Progress bar */}
        <Box sx={{ ...progressTrack }}>
          <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: barColor, transition: 'width 0.6s ease' }} />
        </Box>
      </Box>

      {/* Date + Updates */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, position: 'relative', zIndex: 1 }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
          {new Date(campaign.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CampaignIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: '"Outfit", monospace' }}>
            {Math.floor(campaign.id.charCodeAt(campaign.id.length - 1) % 8)} updates
          </Typography>
        </Box>
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5, position: 'relative', zIndex: 1 }}>
        {campaign.status === CampaignStatus.PENDING_REVIEW && (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
              onClick={(e) => { e.stopPropagation(); }}
              sx={{
                color: '#5E8F72', borderColor: '#5E8F72',
                fontSize: '0.65rem', textTransform: 'none', minWidth: 'auto',
                fontFamily: '"Outfit", sans-serif',
                '&:hover': { borderColor: '#5E8F72', bgcolor: 'rgba(76,175,80,0.08)' },
              }}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DoNotDisturbIcon sx={{ fontSize: 14 }} />}
              onClick={(e) => { e.stopPropagation(); }}
              sx={{
                color: '#C06B58', borderColor: '#C06B58',
                fontSize: '0.65rem', textTransform: 'none', minWidth: 'auto',
                fontFamily: '"Outfit", sans-serif',
                '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
              }}
            >
              Reject
            </Button>
          </>
        )}
        {campaign.status !== CampaignStatus.BLOCKED && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<BlockIcon sx={{ fontSize: 14 }} />}
            onClick={(e) => { e.stopPropagation(); }}
            sx={{
              color: '#C06B58', borderColor: '#C06B58',
              fontSize: '0.65rem', textTransform: 'none', minWidth: 'auto',
              fontFamily: '"Outfit", sans-serif',
              '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
            }}
          >
            Block
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default function CampaignsPage() {
  const { data: campaigns, isLoading: loading, error } = useAdminCampaigns()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filtered = campaigns.filter(c => {
    if (activeTab === 'pending' && c.status !== CampaignStatus.PENDING_REVIEW) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pagination = usePagination(filtered, 9)

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <Box>
        <PageHeader
          tone="gold"
          eyebrow="Community"
          title="Campaigns"
          lede="Review, approve, and moderate every fundraising campaign live on the platform."
          icon={<RocketLaunchRoundedIcon />}
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, ...raisedSurface, mb: 3 }}>
        <Box
          component="button"
          type="button"
          aria-pressed={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          sx={{
            px: 3, py: 1.5, cursor: 'pointer',
            border: 0, borderRadius: SHAPE.sm, bgcolor: 'background.paper',
            boxShadow: activeTab === 'all' ? 'var(--neu-inset)' : 'var(--neu-subtle)',
            '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main' },
            color: activeTab === 'all' ? '#5E8F72' : 'text.secondary',
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700, fontSize: '0.82rem',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}
        >
          All
        </Box>
        <Box
          component="button"
          type="button"
          aria-pressed={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          sx={{
            px: 3, py: 1.5, cursor: 'pointer',
            border: 0, borderRadius: SHAPE.sm, bgcolor: 'background.paper',
            boxShadow: activeTab === 'pending' ? 'var(--neu-inset)' : 'var(--neu-subtle)',
            '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main' },
            color: activeTab === 'pending' ? '#D3A95C' : 'text.secondary',
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700, fontSize: '0.82rem',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}
        >
          Pending Review
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load campaigns. Refresh the page to try again.</Alert>}

      {/* Filter bar */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, ...raisedSurface, mb: 3 }}>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search campaigns..."
            slotProps={{ htmlInput: { 'aria-label': 'Search campaigns...' } }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            variant="outlined"
            label="Status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            fullWidth
          >
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.values(CampaignStatus).map(s => (
              <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            variant="outlined"
            label="Category"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            fullWidth
          >
            <MenuItem value="all">All Categories</MenuItem>
            {Object.values(CampaignCategory).map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'text.secondary' }}>
            {loading ? <Skeleton width={90} /> : error ? 'Unavailable' : `${filtered.length} campaigns`}
          </Typography>
        </Box>
      </Box>

      {/* Grid */}
      <Box sx={{
        display: 'grid',
        gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : pagination.page.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))
        }
      </Box>

      {/* Pagination */}
      {!loading && <PaginationBar neumorphic pagination={pagination} accentColor="#5E8F72" />}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState variant="search" title="No campaigns found" description="No campaigns match your filters. Try adjusting your search criteria." compact /></Box>
      )}
    </Box>
  )
}
