import { useState, useMemo, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import { keyframes } from '@emotion/react'
import { Link as RouterLink } from 'react-router-dom'
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
import { ProgressBar, EmptyState } from '@ubuntu-fund/ui'
import { CoverPlaceholder } from '@/components/campaigns/CampaignCard'
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

const drawLine = keyframes`
  to { stroke-dashoffset: 0; }
`

const markerSwipe = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`

// Squiggly underline
const SQUIGGLE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='6' viewBox='0 0 60 6'%3E%3Cpath d='M0,3 C5,0 10,6 15,3 C20,0 25,6 30,3 C35,0 40,6 45,3 C50,0 55,6 60,3' fill='none' stroke='%23C7A24A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`

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

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#A5432F',
  urgent: '#C7A24A',
  normal: '#5E8F72',
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
    let result: Campaign[] = [...campaigns]
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
      {/* ═══ HERO — hand-drawn feel ═══ */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          py: { xs: 6, md: 8 },
          px: { xs: 3, md: 6 },
          bgcolor: '#0A0F0A',
          color: '#fff',
        }}
      >
        {/* Doodle decoration — floating leaves */}
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {/* Hand-drawn connecting arcs */}
            {[
              'M50,80 C100,20 200,120 300,60',
              'M400,90 C500,30 600,100 700,50',
              'M800,70 C900,20 1000,90 1100,40',
            ].map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="rgba(76,175,80,0.08)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="600"
                strokeDashoffset="600"
                style={{ animation: `${drawLine} 3s ${i * 0.5}s ease forwards` }}
              />
            ))}
            {/* Scattered dots */}
            {[
              { cx: 120, cy: 30 }, { cx: 350, cy: 70 }, { cx: 550, cy: 25 },
              { cx: 780, cy: 55 }, { cx: 950, cy: 35 }, { cx: 200, cy: 85 },
            ].map((d, i) => (
              <circle
                key={i}
                cx={d.cx} cy={d.cy} r={2}
                fill={i % 2 === 0 ? '#5E8F72' : '#C7A24A'}
                opacity={0}
                style={{ animation: `${fadeIn} 0.5s ${1 + i * 0.15}s ease forwards` }}
              />
            ))}
          </svg>
        </Box>

        <Box sx={{ maxWidth: 1200, mx: 'auto', position: 'relative', zIndex: 1 }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: '"TT Squares", sans-serif',
              fontWeight: 900,
              fontSize: { xs: '2rem', md: '2.8rem' },
              lineHeight: 1.1,
              mb: 1.5,
              animation: `${fadeInUp} 0.6s ease`,
              position: 'relative',
              display: 'inline-block',
            }}
          >
            Explore Campaigns
            <Box
              component="span"
              sx={{
                position: 'absolute',
                bottom: -4,
                left: 0,
                width: '50%',
                height: 6,
                backgroundImage: SQUIGGLE,
                backgroundRepeat: 'repeat-x',
                backgroundSize: '60px 6px',
                animation: `${markerSwipe} 0.8s 0.4s ease both`,
                transformOrigin: 'left',
              }}
            />
          </Typography>
          <Typography
            sx={{
              fontSize: '1.05rem',
              color: 'rgba(255,255,255,0.55)',
              maxWidth: 560,
              lineHeight: 1.6,
              animation: `${fadeInUp} 0.6s 0.1s ease both`,
              fontStyle: 'italic',
            }}
          >
            Discover verified fundraising campaigns across Ghana. Filter by region, category, or search for a cause close to your heart.
          </Typography>
        </Box>
      </Box>

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
              border: '1px solid rgba(0,0,0,0.06)',
              borderBottom: 'none',
              borderRight: 'none',
            }}
          >
            {paginated.map((campaign, index) => {
              const pct = Math.min(Math.round((campaign.raisedAmount / campaign.goalAmount) * 100), 100)
              const catInfo = CATEGORY_LABELS[campaign.category]

              return (
                <Box
                  key={campaign.id}
                  component={RouterLink}
                  to={`/campaigns/${campaign.id}`}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    textDecoration: 'none',
                    color: 'inherit',
                    borderRight: '1px solid rgba(0,0,0,0.06)',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    bgcolor: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    animation: `${fadeInUp} 0.4s ease ${index * 0.06}s both`,
                    // Priority accent top line
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      bgcolor: PRIORITY_COLORS[campaign.priority] || '#5E8F72',
                      opacity: 0.5,
                      transition: 'opacity 0.3s',
                      zIndex: 2,
                    },
                    '&:hover': {
                      bgcolor: '#FEFEFE',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                      zIndex: 1,
                      '&::before': { opacity: 1 },
                      '& .card-img': { transform: 'scale(1.04)' },
                    },
                  }}
                >
                  {/* Image */}
                  <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                    {campaign.imageUrls[0] ? (
                      <>
                        <Box
                          className="card-img"
                          component="img"
                          src={campaign.imageUrls[0]}
                          alt={campaign.title}
                          sx={{
                            width: '100%',
                            height: 190,
                            objectFit: 'cover',
                            display: 'block',
                            transition: 'transform 0.5s ease',
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            bgcolor: 'rgba(0,0,0,0.25)',
                            pointerEvents: 'none',
                          }}
                        />
                      </>
                    ) : (
                      <Box className="card-img" sx={{ transition: 'transform 0.5s ease' }}>
                        <CoverPlaceholder category={campaign.category} height={190} />
                      </Box>
                    )}

                    {/* Category + Country overlay */}
                    <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 0.75 }}>
                      <Box
                        sx={{
                          px: 1,
                          py: 0.3,
                          bgcolor: 'rgba(255,255,255,0.95)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {catInfo?.icon} {catInfo?.label}
                      </Box>
                    </Box>

                    {/* Funded badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        bgcolor: pct >= 100 ? '#5E8F72' : '#1a1a1a',
                        color: '#fff',
                        px: 1.5,
                        py: 0.4,
                        fontFamily: '"TT Squares", monospace',
                        fontWeight: 900,
                        fontSize: '0.82rem',
                      }}
                    >
                      {pct}%
                    </Box>
                  </Box>

                  {/* Content */}
                  <Box sx={{ p: 2.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        lineHeight: 1.35,
                        mb: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        color: '#1a1a1a',
                      }}
                    >
                      {campaign.title}
                    </Typography>

                    <ProgressBar current={campaign.raisedAmount} goal={campaign.goalAmount} currency={campaign.currency} />

                    <Box sx={{ flexGrow: 1 }} />
                  </Box>
                </Box>
              )
            })}
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
                  fontSize: '0.78rem', fontFamily: '"TT Squares", sans-serif',
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
                    fontSize: '0.78rem', fontFamily: '"TT Squares", monospace', fontWeight: i === page ? 700 : 400,
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
                  fontSize: '0.78rem', fontFamily: '"TT Squares", sans-serif',
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
