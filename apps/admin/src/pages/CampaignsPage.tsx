import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, TextField, MenuItem, InputAdornment, Button } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import BlockIcon from '@mui/icons-material/Block'
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb'
import CampaignIcon from '@mui/icons-material/Campaign'
import { EmptyState } from '@ubuntu-fund/ui'
import { CampaignStatus, CampaignCategory } from '@ubuntu-fund/types'
import type { Campaign } from '@ubuntu-fund/types'
import { useMockData } from '@/hooks/useMockData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'

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
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}`,
      p: 3,
      animation: `${fadeIn} 0.4s ease ${index * 0.05}s both`,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        <Skel w={60} h={16} />
        <Skel w={50} h={16} />
      </Box>
      <Skel w="80%" h={18} />
      <Box sx={{ mt: 1 }}><Skel w={100} h={12} /></Box>
      <Box sx={{ borderTop: `1px solid ${B}`, mt: 2, pt: 2 }}>
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

function CampaignCard({ campaign, index }: { campaign: Campaign; index: number }) {
  const navigate = useNavigate()
  const accent = statusColors[campaign.status] || '#616161'
  const pct = campaign.goalAmount > 0 ? Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100) : 0
  const barColor = pct >= 100 ? '#74909A' : pct >= 60 ? '#5E8F72' : pct >= 30 ? '#D3A95C' : '#C06B58'

  return (
    <Box
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      sx={{
        position: 'relative', overflow: 'hidden',
        borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}`,
        p: 3, cursor: 'pointer',
        transition: 'all 0.3s ease',
        animation: `${slideIn} 0.4s ease ${index * 0.04}s both`,
        '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: accent, opacity: 0.35, transition: 'opacity 0.3s' },
        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', '&::before': { opacity: 1 } },
      }}
    >
      {/* Watermark */}
      <Typography sx={{
        position: 'absolute', right: 12, bottom: 8,
        fontSize: '3.5rem', fontFamily: '"TT Squares", monospace', fontWeight: 900,
        color: 'rgba(255,255,255,0.03)', lineHeight: 1, pointerEvents: 'none',
        userSelect: 'none',
      }}>
        ${campaign.raisedAmount.toLocaleString()}
      </Typography>

      {/* Status + Category */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, position: 'relative', zIndex: 1 }}>
        <Typography sx={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          color: accent, letterSpacing: '0.08em',
        }}>
          {campaign.status.replace('_', ' ')}
        </Typography>
        <Typography sx={{
          fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em',
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
      <Box sx={{ borderTop: `1px solid ${B}`, mt: 2, pt: 2, position: 'relative', zIndex: 1 }}>
        {/* Raised / Goal */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
          <Typography sx={{ fontSize: '0.78rem', fontFamily: '"TT Squares", monospace', color: 'text.primary' }}>
            ${campaign.raisedAmount.toLocaleString()} <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>raised</Box>
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', fontFamily: '"TT Squares", monospace', color: 'text.secondary' }}>
            ${campaign.goalAmount.toLocaleString()} <Box component="span" sx={{ fontSize: '0.7rem' }}>goal</Box>
          </Typography>
        </Box>

        {/* Progress bar */}
        <Box sx={{ width: '100%', height: 3, bgcolor: 'rgba(255,255,255,0.06)' }}>
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
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: '"TT Squares", monospace' }}>
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
                fontFamily: '"TT Squares", sans-serif',
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
                fontFamily: '"TT Squares", sans-serif',
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
              fontFamily: '"TT Squares", sans-serif',
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
  const { campaigns } = useMockData()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const filtered = campaigns.filter(c => {
    if (activeTab === 'pending' && c.status !== CampaignStatus.PENDING_REVIEW) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pagination = usePagination(filtered, 9)

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.3s ease` }}>
      <Box sx={{ px: 3, pt: 3 }}>
        <PageHeader
          tone="gold"
          eyebrow="Community"
          title="Campaigns"
          lede="Review, approve, and moderate every fundraising campaign live on the platform."
          icon={<RocketLaunchRoundedIcon />}
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ display: 'flex', borderBottom: `1px solid ${B}` }}>
        <Box
          onClick={() => setActiveTab('all')}
          sx={{
            px: 3, py: 1.5, cursor: 'pointer',
            borderBottom: activeTab === 'all' ? '2px solid #5E8F72' : '2px solid transparent',
            color: activeTab === 'all' ? '#5E8F72' : 'text.secondary',
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 700, fontSize: '0.82rem',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}
        >
          All
        </Box>
        <Box
          onClick={() => setActiveTab('pending')}
          sx={{
            px: 3, py: 1.5, cursor: 'pointer',
            borderBottom: activeTab === 'pending' ? '2px solid #D3A95C' : '2px solid transparent',
            color: activeTab === 'pending' ? '#D3A95C' : 'text.secondary',
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 700, fontSize: '0.82rem',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}
        >
          Pending Review
        </Box>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, borderBottom: `1px solid ${B}` }}>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="standard"
            placeholder="Search campaigns..."
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
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#5E8F72' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            variant="standard"
            label="Status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            fullWidth
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#5E8F72' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.values(CampaignStatus).map(s => (
              <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            variant="standard"
            label="Category"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            fullWidth
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#5E8F72' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          >
            <MenuItem value="all">All Categories</MenuItem>
            {Object.values(CampaignCategory).map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"TT Squares", monospace', fontSize: '0.82rem', color: 'text.secondary' }}>
            {filtered.length} campaigns
          </Typography>
        </Box>
      </Box>

      {/* Grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} index={i} />)
          : pagination.page.map((campaign, i) => (
              <CampaignCard key={campaign.id} campaign={campaign} index={i} />
            ))
        }
      </Box>

      {/* Pagination */}
      {!loading && <PaginationBar pagination={pagination} accentColor="#5E8F72" />}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <EmptyState variant="search" title="No campaigns found" description="No campaigns match your filters. Try adjusting your search criteria." compact />
      )}
    </Box>
  )
}
