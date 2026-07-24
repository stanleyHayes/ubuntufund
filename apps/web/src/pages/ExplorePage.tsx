import { useState, useMemo, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import { keyframes } from '@emotion/react'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import { CampaignCategory, CampaignStatus } from '@ubuntu-fund/types'
import type { Campaign } from '@ubuntu-fund/types'
import { EmptyState } from '@ubuntu-fund/ui'
import { CampaignCard } from '@/components/campaigns/CampaignCard'
import { PageBanner } from '@/components/layout/PageBanner'
import { useCampaigns } from '@/hooks/useCampaigns'

// ─── Animations ─────────────────────────────────────────────

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`


// ─── Constants ──────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  medical: { icon: <LocalHospitalRoundedIcon sx={{ fontSize: 14 }} />, label: 'Medical' },
  education: { icon: <SchoolRoundedIcon sx={{ fontSize: 14 }} />, label: 'Education' },
  emergency: { icon: <WarningAmberRoundedIcon sx={{ fontSize: 14 }} />, label: 'Emergency' },
  business: { icon: <BusinessCenterRoundedIcon sx={{ fontSize: 14 }} />, label: 'Business' },
  community: { icon: <GroupsRoundedIcon sx={{ fontSize: 14 }} />, label: 'Community' },
  religious: { icon: <AccountBalanceRoundedIcon sx={{ fontSize: 14 }} />, label: 'Religious' },
  creative: { icon: <PaletteRoundedIcon sx={{ fontSize: 14 }} />, label: 'Creative' },
}

const STATUS_LABELS: Record<string, string> = {
  [CampaignStatus.ACTIVE]: 'Active',
  [CampaignStatus.FUNDED]: 'Funded',
  [CampaignStatus.PENDING_REVIEW]: 'Pending Review',
  [CampaignStatus.EXPIRED]: 'Expired',
}

type SortOption = 'most_funded' | 'newest'

const PER_PAGE = 6

// ─── Skeleton ──────────────────────────────────────────────

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(0,0,0,0.06)',
    }} />
  )
}

function CardSkeleton({ index }: { index: number }) {
  return (
    <Box
      sx={{
        animation: `${fadeIn} 0.3s ${index * 0.05}s ease both`,
        border: '1px solid rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      <Skel h={200} />
      <Box sx={{ p: 2.5 }}>
        <Skel w="85%" h={18} />
        <Box sx={{ mt: 1.5 }}><Skel w="60%" h={14} /></Box>
        <Box sx={{ mt: 2 }}><Skel h={4} /></Box>
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between' }}>
          <Skel w={80} h={14} />
          <Skel w={60} h={14} />
        </Box>
        <Box sx={{ mt: 2.5, display: 'flex', gap: 2 }}>
          <Skel w={40} h={14} />
          <Skel w={40} h={14} />
          <Skel w={40} h={14} />
        </Box>
      </Box>
    </Box>
  )
}

// ─── Component ──────────────────────────────────────────────

export function ExplorePage() {
  const { campaigns, isLoading: campaignsLoading } = useCampaigns()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CampaignCategory | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<CampaignStatus | null>(null)
  const [sort, setSort] = useState<SortOption>('most_funded')
  const [page, setPage] = useState(0)

  // Reset page on filter change
  useEffect(() => {
    const id = setTimeout(() => setPage(0), 0)
    return () => clearTimeout(id)
  }, [search, selectedCategory, selectedStatus, sort])

  const filtered = useMemo(() => {
    // Defensive: never spread/filter a non-array. If a hook ever hands back a
    // non-array (error/unexpected response), fall back to an empty list instead
    // of throwing "campaigns.filter is not a function".
    let result: Campaign[] = Array.isArray(campaigns) ? [...campaigns] : []
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((c) => c.title.toLowerCase().includes(q))
    }
    if (selectedCategory) result = result.filter((c) => c.category === selectedCategory)
    if (selectedStatus) result = result.filter((c) => c.status === selectedStatus)
    switch (sort) {
      case 'most_funded': result.sort((a, b) => b.raisedAmount / b.goalAmount - a.raisedAmount / a.goalAmount); break
      case 'newest': result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break
    }
    return result
  }, [campaigns, search, selectedCategory, selectedStatus, sort])

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const hasFilters = !!(selectedCategory || selectedStatus || search)

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FAF8F0' }}>
      <PageBanner
        eyebrow="Discover"
        title="Explore Campaigns"
        subtitle="Verified fundraising campaigns across Ghana — filter by category or search for a cause close to your heart."
      />

      {/* ═══ FILTERS ═══ */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
            animation: `${fadeIn} 0.4s 0.2s ease both`,
          }}
        >
          {/* Search */}
          <TextField
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            variant="outlined"
            sx={{
              flex: 1,
              minWidth: 220,
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
                bgcolor: '#fff',
                '& fieldset': { borderColor: 'rgba(0,0,0,0.08)' },
                '&:hover fieldset': { borderColor: 'rgba(46, 61, 47,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#2E3D2F', borderWidth: '1.5px' },
              },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: 'rgba(0,0,0,0.3)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Sort */}
          <TextField
            select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            size="small"
            label="Sort by"
            sx={{
              minWidth: 160,
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
                bgcolor: '#fff',
                '& fieldset': { borderColor: 'rgba(0,0,0,0.08)' },
                '&.Mui-focused fieldset': { borderColor: '#2E3D2F' },
              },
              '& .MuiInputLabel-root': { fontSize: '0.82rem' },
            }}
          >
            <MenuItem value="most_funded">Most Funded %</MenuItem>
            <MenuItem value="newest">Newest</MenuItem>
          </TextField>
        </Box>

        {/* Category tags */}
        <Box sx={{ mb: 3, overflow: 'visible', animation: `${fadeIn} 0.4s 0.3s ease both` }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1, fontWeight: 600 }}>
            Category
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, overflow: 'visible' }}>
            {/* "All" chip */}
            <Box
              component="button"
              onClick={() => setSelectedCategory(null)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 2,
                py: 0.75,
                border: '1px solid',
                borderRadius: 5,
                borderColor: !selectedCategory ? '#2E3D2F' : 'rgba(0,0,0,0.08)',
                bgcolor: !selectedCategory ? '#2E3D2F' : 'transparent',
                color: !selectedCategory ? '#fff' : 'rgba(0,0,0,0.6)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                '&:hover': {
                  borderColor: !selectedCategory ? '#1C261D' : 'rgba(46, 61, 47,0.3)',
                  bgcolor: !selectedCategory ? '#1C261D' : 'rgba(46, 61, 47,0.04)',
                },
              }}
            >
              All
            </Box>
            {Object.values(CampaignCategory).map((cat) => {
              const active = selectedCategory === cat
              const info = CATEGORY_LABELS[cat]
              return (
                <Box
                  key={cat}
                  component="button"
                  onClick={() => setSelectedCategory(active ? null : cat)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 2,
                    py: 1,
                    border: '1px solid',
                    borderRadius: 5,
                    borderColor: active ? '#2E3D2F' : 'rgba(0,0,0,0.08)',
                    bgcolor: active ? '#2E3D2F' : 'transparent',
                    color: active ? '#fff' : 'rgba(0,0,0,0.6)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    '&:hover': {
                      borderColor: active ? '#1C261D' : 'rgba(46, 61, 47,0.3)',
                      bgcolor: active ? '#1C261D' : 'rgba(46, 61, 47,0.04)',
                    },
                  }}
                >
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', '& svg': { fontSize: '16px !important' } }}>
                    {info?.icon}
                  </Box>
                  {info?.label ?? cat}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Status tags */}
        <Box sx={{ mb: 3, animation: `${fadeIn} 0.4s 0.35s ease both` }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1, fontWeight: 600 }}>
            Status
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => {
              const active = selectedStatus === value
              return (
                <Box
                  key={value}
                  component="button"
                  onClick={() => setSelectedStatus(active ? null : value as CampaignStatus)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    border: '1px solid',
                    borderColor: active ? '#2E3D2F' : 'rgba(0,0,0,0.08)',
                    bgcolor: active ? '#2E3D2F' : 'transparent',
                    color: active ? '#fff' : 'rgba(0,0,0,0.6)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    '&:hover': {
                      borderColor: active ? '#1C261D' : 'rgba(46, 61, 47,0.3)',
                      bgcolor: active ? '#1C261D' : 'rgba(46, 61, 47,0.04)',
                    },
                  }}
                >
                  {label}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Results count + clear */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
            pb: 2,
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <Typography sx={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.5)' }}>
            Showing <Box component="strong" sx={{ color: '#1a1a1a' }}>{filtered.length}</Box> campaign{filtered.length !== 1 ? 's' : ''}
            {selectedCategory && <> &middot; <strong>{CATEGORY_LABELS[selectedCategory]?.label}</strong></>}
            {selectedStatus && <> &middot; <strong>{STATUS_LABELS[selectedStatus]}</strong></>}
          </Typography>
          {hasFilters && (
            <Box
              component="button"
              onClick={() => { setSelectedCategory(null); setSelectedStatus(null); setSearch('') }}
              sx={{
                px: 1.5, py: 0.5,
                border: '1px solid rgba(0,0,0,0.1)',
                bgcolor: 'transparent',
                color: 'rgba(0,0,0,0.5)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover': { borderColor: '#A5432F', color: '#A5432F' },
              }}
            >
              <CloseRoundedIcon sx={{ fontSize: 14 }} /> Clear filters
            </Box>
          )}
        </Box>

        {/* ═══ CAMPAIGN GRID ═══ */}
        {campaignsLoading ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 0,
            }}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} index={i} />
            ))}
          </Box>
        ) : filtered.length === 0 ? (
          <EmptyState
            variant="search"
            title="No campaigns found"
            description="Try adjusting your search or filters to find what you're looking for."
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2.5,
            }}
          >
            {paginated.map((campaign, index) => (
              <Box key={campaign.id} sx={{ animation: `${fadeInUp} 0.4s ease ${index * 0.06}s both` }}>
                <CampaignCard campaign={campaign} />
              </Box>
            ))}
          </Box>
        )}

        {/* ═══ PAGINATION ═══ */}
        {!campaignsLoading && totalPages > 1 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 2,
              mt: 0,
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.4)' }}>
              Showing {page * PER_PAGE + 1}&ndash;{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Box
                component="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                sx={{
                  px: 2, py: 0.75, bgcolor: 'transparent',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: page === 0 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)',
                  cursor: page === 0 ? 'default' : 'pointer',
                  fontSize: '0.78rem', fontFamily: '"Outfit", sans-serif',
                  transition: 'all 0.2s',
                  '&:hover:not(:disabled)': { borderColor: 'rgba(0,0,0,0.2)', color: '#1a1a1a' },
                }}
              >
                Prev
              </Box>
              {Array.from({ length: totalPages }, (_, i) => (
                <Box
                  key={i}
                  component="button"
                  onClick={() => setPage(i)}
                  sx={{
                    px: 1.5, py: 0.75,
                    bgcolor: i === page ? '#1a1a1a' : 'transparent',
                    border: `1px solid ${i === page ? '#1a1a1a' : 'rgba(0,0,0,0.08)'}`,
                    color: i === page ? '#fff' : 'rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    fontSize: '0.78rem', fontFamily: '"Outfit", monospace', fontWeight: i === page ? 700 : 400,
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'rgba(0,0,0,0.2)' },
                  }}
                >
                  {i + 1}
                </Box>
              ))}
              <Box
                component="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                sx={{
                  px: 2, py: 0.75, bgcolor: 'transparent',
                  border: '1px solid rgba(0,0,0,0.08)',
                  color: page >= totalPages - 1 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)',
                  cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                  fontSize: '0.78rem', fontFamily: '"Outfit", sans-serif',
                  transition: 'all 0.2s',
                  '&:hover:not(:disabled)': { borderColor: 'rgba(0,0,0,0.2)', color: '#1a1a1a' },
                }}
              >
                Next
              </Box>
            </Box>
          </Box>
        )}

      </Box>
    </Box>
  )
}
