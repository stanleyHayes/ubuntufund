import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, TextField, MenuItem, InputAdornment, Chip } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import { EmptyState } from '@ubuntu-fund/ui'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import type { NewsletterSubscriber } from '@ubuntu-fund/types'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'
const ACCENT = '#5E8F72'

interface Stats {
  active: number
  unsubscribed: number
  total: number
}

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([])
  const [stats, setStats] = useState<Stats>({ active: 0, unsubscribed: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [totalItems, setTotalItems] = useState(0)

  const pagination = usePagination({ totalItems, pageSize: 20 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
        ?? (() => { try { return JSON.parse(localStorage.getItem('uf_tokens') ?? 'null')?.accessToken } catch { return null } })()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const params = new URLSearchParams({ page: String(pagination.currentPage), pageSize: '20' })
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const [subsRes, statsRes] = await Promise.all([
        fetch(`/api/v1/newsletter?${params}`, { headers }),
        fetch('/api/v1/newsletter/stats', { headers }),
      ])

      const subsData = await subsRes.json()
      const statsData = await statsRes.json()

      if (subsRes.ok) {
        setSubscribers(subsData.data.items)
        setTotalItems(subsData.data.total)
      }
      if (statsRes.ok) setStats(statsData.data)
    } catch {
      // API unavailable — keep empty state
    } finally {
      setLoading(false)
    }
  }, [pagination.currentPage, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = search
    ? subscribers.filter((s) => s.email.toLowerCase().includes(search.toLowerCase()))
    : subscribers

  return (
    <Box sx={{ animation: `${fadeIn} 0.3s ease` }}>
      <PageHeader
        tone="teal"
        eyebrow="Growth"
        title="Newsletter Subscribers"
        lede="See who's subscribed to the newsletter and manage active and unsubscribed contacts."
        icon={<CampaignRoundedIcon />}
        stats={[
          { label: 'Total Subscribers', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: 'Unsubscribed', value: stats.unsubscribed },
        ]}
      />

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search by email..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} /></InputAdornment> }}
          sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
        />
        <TextField
          select size="small" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="unsubscribed">Unsubscribed</MenuItem>
        </TextField>
      </Box>

      {/* Table */}
      <Box sx={{
        border: `1px solid ${B}`, borderRadius: 2, overflow: 'hidden',
        bgcolor: 'rgba(255,255,255,0.015)',
      }}>
        {/* Header row */}
        <Box sx={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
          p: 2, borderBottom: `1px solid ${B}`,
          bgcolor: 'rgba(255,255,255,0.02)',
        }}>
          {['Email', 'Status', 'Subscribed'].map((h) => (
            <Typography key={h} sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {h}
            </Typography>
          ))}
        </Box>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', p: 2, borderBottom: `1px solid ${B}` }}>
              <Skel w="60%" h={14} />
              <Skel w={70} h={22} />
              <Skel w={80} h={14} />
            </Box>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState variant="search" title="No subscribers found" description="No newsletter subscribers match your filters." compact />
        ) : (
          filtered.map((sub, i) => (
            <Box
              key={sub.id}
              sx={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                alignItems: 'center', p: 2,
                borderBottom: `1px solid ${B}`,
                animation: `${slideIn} 0.3s ease ${i * 0.03}s both`,
                transition: 'background-color 0.15s ease',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                position: 'relative', overflow: 'hidden',
                '&:hover::after': {
                  content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: `${ACCENT}40`,
                },
              }}
            >
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: '#fff' }}>{sub.email}</Typography>
              <Chip
                label={sub.status}
                size="small"
                sx={{
                  width: 'fit-content',
                  fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase',
                  bgcolor: sub.status === 'active' ? 'rgba(76,175,80,0.12)' : 'rgba(120,144,156,0.12)',
                  color: sub.status === 'active' ? '#5E8F72' : '#78909C',
                  border: '1px solid',
                  borderColor: sub.status === 'active' ? 'rgba(76,175,80,0.2)' : 'rgba(120,144,156,0.2)',
                }}
              />
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                {new Date(sub.subscribedAt).toLocaleDateString()}
              </Typography>
            </Box>
          ))
        )}
      </Box>

      {totalItems > 20 && (
        <Box sx={{ mt: 2 }}>
          <PaginationBar pagination={pagination} />
        </Box>
      )}
    </Box>
  )
}

export default NewsletterPage
