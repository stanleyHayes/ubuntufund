import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import PhoneAndroidRoundedIcon from '@mui/icons-material/PhoneAndroidRounded'
import CurrencyBitcoinRoundedIcon from '@mui/icons-material/CurrencyBitcoinRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
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
  return <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
}

function SkeletonCard() {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        ...raisedSurface,
        p: 3,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        <Skel w={100} h={24} />
        <Skel w={35} h={16} />
      </Box>
      <Skel w="50%" h={12} />
      <Box sx={{ mt: 0.8 }}>
        <Skel w="70%" h={12} />
      </Box>
      <Box sx={{ ...insetSurface, px: 1.5, pb: 1.5, mt: 2, pt: 2 }}>
        <Skel w={80} h={11} />
        <Box sx={{ mt: 0.8 }}>
          <Skel w={90} h={11} />
        </Box>
      </Box>
      <Box sx={{ mt: 1.5 }}>
        <Skel w="90%" h={24} />
      </Box>
    </Box>
  )
}

interface DonationCardProps {
  donation: AdminDonation
  donorName: string
  campaignTitle: string
}

export function DonationCard({ donation, donorName, campaignTitle }: DonationCardProps) {
  const methods = {
    wallet: { label: 'Ujimora Wallet', Icon: AccountBalanceWalletRoundedIcon },
    mobile_money: { label: 'Mobile money', Icon: PhoneAndroidRoundedIcon },
    card: { label: 'Card payment', Icon: CreditCardRoundedIcon },
    crypto: { label: 'Cryptocurrency', Icon: CurrencyBitcoinRoundedIcon },
    bank_transfer: { label: 'Bank transfer', Icon: AccountBalanceRoundedIcon },
  }
  const { label, Icon } = methods[donation.paymentMethod as keyof typeof methods] ?? {
    label: 'Payment method unavailable',
    Icon: PaymentsRoundedIcon,
  }
  return (
    <Box
      component="article"
      sx={{
        ...raisedSurface,
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2.5, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        minWidth: 0,
      }}
    >
      <Icon
        aria-hidden
        sx={{
          position: 'absolute',
          right: -20,
          top: 52,
          fontSize: 175,
          opacity: 0.045,
          color: 'primary.main',
          transform: 'rotate(-18deg)',
          pointerEvents: 'none',
        }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative' }}>
        <Box
          sx={{
            ...insetSurface,
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <Icon aria-hidden />
        </Box>
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ position: 'relative' }}>
        <Typography variant="caption" color="text.secondary">
          CONTRIBUTION
        </Typography>
        <Typography
          sx={{
            fontSize: 'clamp(1.6rem, 2.2vw, 2.1rem)',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.3,
          }}
        >
          {new Intl.NumberFormat('en-GH', {
            style: 'currency',
            currency: donation.currency,
            maximumFractionDigits: 2,
          }).format(donation.amount)}
        </Typography>
      </Box>
      <Box sx={{ position: 'relative', flex: 1 }}>
        <Typography fontWeight={700}>
          {donation.isAnonymous ? 'Anonymous donor' : donorName}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.75, lineHeight: 1.6, overflowWrap: 'anywhere' }}
        >
          {campaignTitle}
        </Typography>
      </Box>
      {donation.message && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontStyle: 'italic', overflowWrap: 'anywhere' }}
        >
          “{donation.message}”
        </Typography>
      )}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5, position: 'relative' }}>
        <Typography component="time" variant="caption" color="text.secondary">
          {new Date(donation.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Typography>
      </Box>
    </Box>
  )
}

export default function DonationsPage() {
  const { data: donations, isLoading: loading, error } = useAdminDonations()
  const PAGE_SIZE = 12
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filtered = donations.filter((d) => {
    if (typeFilter === 'named' && d.isAnonymous) return false
    if (typeFilter === 'anonymous' && !d.isAnonymous) return false
    if (search) {
      const s = search.toLowerCase()
      // Real donations embed donorName/campaignTitle; mock rows only have ids.
      const donorName = d.isAnonymous ? 'anonymous' : (d.donorName ?? d.donorId)
      const campaignTitle = d.campaignTitle ?? d.campaignId
      if (!donorName.toLowerCase().includes(s) && !campaignTitle.toLowerCase().includes(s))
        return false
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Could not load donations. Refresh the page to try again.
        </Alert>
      )}

      {/* Filter bar */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
          ...raisedSurface,
          mb: 3,
        }}
      >
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search by donor or campaign..."
            slotProps={{ htmlInput: { 'aria-label': 'Search by donor or campaign...' } }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            onChange={(e) => setTypeFilter(e.target.value)}
            fullWidth
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="named">Named</MenuItem>
            <MenuItem value="anonymous">Anonymous</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography
            sx={{
              fontFamily: '"Outfit", monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: '0.82rem',
              color: 'text.secondary',
            }}
          >
            {loading ? (
              <Skeleton width={160} />
            ) : error ? (
              'Unavailable'
            ) : (
              `${filtered.length} donations · GH₵ ${totalAmount.toLocaleString()} total`
            )}
          </Typography>
        </Box>
      </Box>

      {/* Grid */}
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
        }}
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : pagination.page.map((donation) => (
              <DonationCard
                key={donation.id}
                donation={donation}
                donorName={donation.donorName ?? 'Guest donor'}
                campaignTitle={donation.campaignTitle ?? 'Unavailable campaign'}
              />
            ))}
      </Box>

      {!loading && <PaginationBar neumorphic pagination={pagination} accentColor="#C7A24A" />}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Box sx={{ ...raisedSurface, p: 3 }}>
          <EmptyState
            variant="search"
            title="No donations found"
            description="No donations match your filters. Try adjusting your search criteria."
            compact
          />
        </Box>
      )}
    </Box>
  )
}
