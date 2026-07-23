import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, TextField, MenuItem, InputAdornment } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import { EmptyState } from '@ubuntu-fund/ui'
import type { Donation } from '@ubuntu-fund/types'
import { useMockData } from '@/hooks/useMockData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'

const ACCENT = '#4CAF50'

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
        <Skel w={100} h={24} />
        <Skel w={35} h={16} />
      </Box>
      <Skel w="50%" h={12} />
      <Box sx={{ mt: 0.8 }}><Skel w="70%" h={12} /></Box>
      <Box sx={{ borderTop: `1px solid ${B}`, mt: 2, pt: 2 }}>
        <Skel w={80} h={11} />
        <Box sx={{ mt: 0.8 }}><Skel w={90} h={11} /></Box>
      </Box>
      <Box sx={{ mt: 1.5 }}><Skel w="90%" h={24} /></Box>
    </Box>
  )
}

interface DonationCardProps {
  donation: Donation
  donorName: string
  campaignTitle: string
  index: number
}

function DonationCard({ donation, donorName, campaignTitle, index }: DonationCardProps) {
  return (
    <Box
      sx={{
        position: 'relative', overflow: 'hidden',
        borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}`,
        p: 3,
        transition: 'all 0.3s ease',
        animation: `${slideIn} 0.4s ease ${index * 0.03}s both`,
        '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: ACCENT, opacity: 0.35, transition: 'opacity 0.3s' },
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
        ${donation.amount}
      </Typography>

      {/* Amount + Currency + Anon badge */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5, position: 'relative', zIndex: 1 }}>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: '"TT Squares", monospace', color: 'text.primary', lineHeight: 1.2 }}>
          ${donation.amount.toLocaleString()}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
          {donation.currency}
        </Typography>
        {donation.isAnonymous && (
          <Typography sx={{
            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
            color: '#EF5350', letterSpacing: '0.08em',
            border: '1px solid rgba(239,83,80,0.15)', px: 0.8, py: 0.15, lineHeight: 1.4,
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
      <Box sx={{ borderTop: `1px solid ${B}`, mt: 2, pt: 1.5, position: 'relative', zIndex: 1 }}>
        {/* Payment method */}
        <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', fontWeight: 600 }}>
          {donation.paymentMethod.replace('_', ' ')}
        </Typography>

        {/* Date */}
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.5 }}>
          {new Date(donation.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </Typography>
      </Box>

      {/* Message */}
      {donation.message && (
        <Typography sx={{
          fontSize: '0.75rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.3)',
          mt: 1.5, lineHeight: 1.4, position: 'relative', zIndex: 1,
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
  const navigate = useNavigate()
  const { donations, users, campaigns } = useMockData()
  const PAGE_SIZE = 12
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const filtered = donations.filter(d => {
    if (typeFilter === 'named' && d.isAnonymous) return false
    if (typeFilter === 'anonymous' && !d.isAnonymous) return false
    if (search) {
      const donor = users.find(u => u.id === d.donorId)
      const campaign = campaigns.find(c => c.id === d.campaignId)
      const s = search.toLowerCase()
      if (!(donor?.name.toLowerCase().includes(s)) && !(campaign?.title.toLowerCase().includes(s))) return false
    }
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  const totalAmount = filtered.reduce((sum, d) => sum + d.amount, 0)

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.3s ease` }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2.5, borderBottom: `1px solid ${B}`, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <VolunteerActivismIcon sx={{ color: ACCENT, fontSize: 20 }} />
        <Typography sx={{ fontFamily: '"TT Squares", sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'text.primary' }}>
          Donations
        </Typography>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, borderBottom: `1px solid ${B}` }}>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="standard"
            placeholder="Search by donor or campaign..."
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
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#4CAF50' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: `1px solid ${B}`, display: 'flex', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            variant="standard"
            label="Type"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            fullWidth
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: '#4CAF50' } },
              '& .MuiInputLabel-root': { color: 'text.secondary', fontSize: '0.8rem' },
            }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="named">Named</MenuItem>
            <MenuItem value="anonymous">Anonymous</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"TT Squares", monospace', fontSize: '0.82rem', color: 'text.secondary' }}>
            {filtered.length} donations &middot; ${totalAmount.toLocaleString()} total
          </Typography>
        </Box>
      </Box>

      {/* Grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
      }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} index={i} />)
          : pagination.page.map((donation, i) => {
              const donor = users.find(u => u.id === donation.donorId)
              const campaign = campaigns.find(c => c.id === donation.campaignId)
              return (
                <DonationCard
                  key={donation.id}
                  donation={donation}
                  donorName={donor?.name ?? donation.donorId}
                  campaignTitle={campaign?.title ?? donation.campaignId}
                  index={i}
                />
              )
            })
        }
      </Box>

      {!loading && <PaginationBar pagination={pagination} accentColor="#F9A825" />}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <EmptyState variant="search" title="No donations found" description="No donations match your filters. Try adjusting your search criteria." compact />
      )}
    </Box>
  )
}
