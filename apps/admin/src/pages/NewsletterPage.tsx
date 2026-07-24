import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, TextField, InputAdornment } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import type { NewsletterSubscriberSummary } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'
const ACCENT = '#5E8F72'
const PAGE_SIZE = 12

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

function formatDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriberSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Real API: the admin client unwraps `json.data`, so this resolves to
        // the `{ id, email, createdAt }[]` array (newest-first from the server).
        const data = await api.get<NewsletterSubscriberSummary[]>('/newsletter/subscribers')
        if (!cancelled) setSubscribers(Array.isArray(data) ? data : [])
      } catch {
        // API unavailable — fall back to an empty list and let the empty state show.
        if (!cancelled) setSubscribers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q
      ? subscribers.filter((s) => s.email.toLowerCase().includes(q))
      : subscribers
  }, [subscribers, search])

  const pagination = usePagination(filtered, PAGE_SIZE)

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.3s ease` }}>
      <PageHeader
        tone="green"
        eyebrow="Growth"
        title="Newsletter Subscribers"
        lede="Everyone who signed up for UbuntuFund updates from the marketing site, newest first."
        icon={<MarkEmailReadRoundedIcon />}
        stats={[{ label: 'Total Subscribers', value: loading ? '—' : subscribers.length }]}
      />

      {/* Filter bar */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
        borderBottom: `1px solid ${B}`,
      }}>
        <Box sx={{ px: 2.5, py: 1.5, borderRight: { sm: `1px solid ${B}` }, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="standard"
            placeholder="Search by email..."
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
            sx={{
              '& .MuiInput-root': { color: 'text.primary', '&::before': { borderColor: B }, '&::after': { borderColor: ACCENT } },
            }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"Outfit", monospace', fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {loading ? '...' : `${filtered.length} subscriber${filtered.length === 1 ? '' : 's'}`}
          </Typography>
        </Box>
      </Box>

      {/* Table header */}
      <Box sx={{
        display: 'grid', gridTemplateColumns: '2fr 1fr',
        px: 3, py: 1.5, borderBottom: `1px solid ${B}`,
        bgcolor: 'rgba(255,255,255,0.02)',
      }}>
        {['Email', 'Subscribed'].map((h) => (
          <Typography key={h} sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {h}
          </Typography>
        ))}
      </Box>

      {/* Rows */}
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', px: 3, py: 2, borderBottom: `1px solid ${B}` }}>
            <Skel w="55%" h={14} />
            <Skel w={90} h={14} />
          </Box>
        ))
      ) : filtered.length === 0 ? (
        <EmptyState
          variant={search ? 'search' : 'empty'}
          title={search ? 'No subscribers found' : 'No subscribers yet'}
          description={
            search
              ? 'No newsletter subscribers match your search.'
              : 'Signups from the marketing site will appear here.'
          }
          compact
        />
      ) : (
        pagination.page.map((sub, i) => (
          <Box
            key={sub.id}
            sx={{
              display: 'grid', gridTemplateColumns: '2fr 1fr', alignItems: 'center',
              px: 3, py: 2, borderBottom: `1px solid ${B}`,
              animation: `${slideIn} 0.3s ease ${i * 0.03}s both`,
              transition: 'background-color 0.15s ease',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
            }}
          >
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sub.email}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              {formatDate(sub.createdAt)}
            </Typography>
          </Box>
        ))
      )}

      {!loading && filtered.length > 0 && <PaginationBar pagination={pagination} accentColor={ACCENT} />}
    </Box>
  )
}
