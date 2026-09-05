import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { useState } from 'react'
import { Alert, Skeleton, Box, Typography, MenuItem, InputAdornment } from '@mui/material'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import { useAdminDonations, type AdminDonation } from '@/hooks/useApiData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'



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
        <Skel w={100} h={24} />
        <Skel w={35} h={16} />
      </Box>
      <Skel w="50%" h={12} />
      <Box sx={{ mt: 0.8 }}><Skel w="70%" h={12} /></Box>
      <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 2 }}>
        <Skel w={80} h={11} />
        <Box sx={{ mt: 0.8 }}><Skel w={90} h={11} /></Box>
      </Box>
      <Box sx={{ mt: 1.5 }}><Skel w="90%" h={24} /></Box>
    </Box>
  )
}

interface DonationCardProps {
  donation: AdminDonation
  donorName: string
  campaignTitle: string
}

function DonationCard({ donation, donorName, campaignTitle }: DonationCardProps) {
  return (
    <Box
      sx={{
        position: 'relative', overflow: 'hidden',
        ...raisedSurface,
        p: 3,
        transition: 'box-shadow 160ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&:hover': { boxShadow: 'var(--neu-raised-hover)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 3 },
      }}
    >
      {/* Amount + Currency + Anon badge */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1, mb: 0.5, position: 'relative', zIndex: 1 }}>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', color: 'text.primary', lineHeight: 1.2 }}>
          GH₵ {donation.amount.toLocaleString()}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em' }}>
          {donation.currency}
        </Typography>
        {donation.isAnonymous && (
          <Typography sx={{
            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
            color: '#C06B58', letterSpacing: '0.08em',
            ...insetSurface, px: 0.8, py: 0.15, lineHeight: 1.4,
          }}>
            ANON
          </Typography>
        )}
      </Box>

      {/* Donor name */}
      <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'text.primary', position: 'relative', zIndex: 1 }}>
        {donation.isAnonymous ? 'Anonymous' : donorName}
      </Typography>

      {/* Campaign title */}
      <Typography sx={{
        fontSize: '0.75rem', color: 'text.secondary', mt: 0.3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        position: 'relative', zIndex: 1,
      }}>
        {campaignTitle}
      </Typography>

      {/* Separator */}
      <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 1.5, position: 'relative', zIndex: 1 }}>
        {/* Payment method — omitted by the real donations feed (PublicDonationDTO) */}
        {donation.paymentMethod && (
          <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.06em', fontWeight: 600 }}>
            {donation.paymentMethod.replace('_', ' ')}
          </Typography>
        )}

        {/* Date */}
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.5 }}>
          {new Date(donation.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </Typography>
      </Box>

      {/* Message */}
      {donation.message && (
        <Typography sx={{
          fontSize: '0.75rem', fontStyle: 'italic', color: 'text.secondary',
          ...insetSurface, p: 1.5, mt: 1.5, lineHeight: 1.4, position: 'relative', zIndex: 1,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          &ldquo;{donation.message}&rdquo;
        </Typography>
      )}
    </Box>
  )
}

export default function DonationsPage() {
  const { data: donations, isLoading: loading, error } = useAdminDonations()
  const PAGE_SIZE = 12
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filtered = donations.filter(d => {
    if (typeFilter === 'named' && d.isAnonymous) return false
    if (typeFilter === 'anonymous' && !d.isAnonymous) return false
    if (search) {
      const s = search.toLowerCase()
      // Real donations embed donorName/campaignTitle; mock rows only have ids.
      const donorName = d.isAnonymous ? 'anonymous' : (d.donorName ?? d.donorId)
      const campaignTitle = d.campaignTitle ?? d.campaignId
      if (!donorName.toLowerCase().includes(s) && !campaignTitle.toLowerCase().includes(s)) return false
    }
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  const totalAmount = filtered.reduce((sum, d) => sum + d.amount, 0)

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="gold"
        eyebrow="Community"
        title="Donations"
        lede="Track every contribution moving through the platform, from named supporters to anonymous gifts."
        icon={<VolunteerActivismRoundedIcon />}
      />

      {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load donations. Refresh the page to try again.</Alert>}

      {/* Filter bar */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, ...raisedSurface, mb: 3 }}>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search by donor or campaign..."
            slotProps={{ htmlInput: { 'aria-label': 'Search by donor or campaign...' } }}
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
            label="Type"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            fullWidth
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="named">Named</MenuItem>
            <MenuItem value="anonymous">Anonymous</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: 'text.secondary' }}>
            {loading ? <Skeleton width={160} /> : error ? 'Unavailable' : `${filtered.length} donations · GH₵ ${totalAmount.toLocaleString()} total`}
          </Typography>
        </Box>
      </Box>

      {/* Grid */}
      <Box sx={{
        display: 'grid',
        gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
      }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : pagination.page.map((donation) => (
              <DonationCard
                key={donation.id}
                donation={donation}
                donorName={donation.donorName ?? donation.donorId}
                campaignTitle={donation.campaignTitle ?? donation.campaignId}

              />
            ))
        }
      </Box>

      {!loading && <PaginationBar neumorphic pagination={pagination} accentColor="#C7A24A" />}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState variant="search" title="No donations found" description="No donations match your filters. Try adjusting your search criteria." compact /></Box>
      )}
    </Box>
  )
}
