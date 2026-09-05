import { useState, useEffect, useMemo } from 'react'
import { Alert, Skeleton, Box, Typography, TextField, InputAdornment } from '@mui/material'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import SearchIcon from '@mui/icons-material/Search'
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import type { NewsletterSubscriberSummary } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'

const ACCENT = '#5E8F72'
const PAGE_SIZE = 12

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
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
  const [error, setError] = useState(false)
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
        if (!cancelled) { setSubscribers([]); setError(true) }
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
    <Box sx={{ bgcolor: 'background.default', }}>
      <PageHeader
        tone="green"
        eyebrow="Growth"
        title="Newsletter Subscribers"
        lede="Everyone who signed up for Ujimora updates from the marketing site, newest first."
        icon={<MarkEmailReadRoundedIcon />}
        stats={[{ label: 'Total Subscribers', value: loading ? <Skeleton width={60} /> : error ? '—' : subscribers.length }]}
      />

      {error && <Alert severity="error" sx={{ mb: 3 }}>Could not load newsletter subscribers. Refresh the page to try again.</Alert>}

      {/* Filter bar */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
        ...raisedSurface, mb: 2,
      }}>
        <Box sx={{ px: 2.5, py: 1.5,  display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small"
            variant="outlined"
            slotProps={{ htmlInput: { 'aria-label': 'Search by email' } }}
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
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontFamily: '"Outfit", monospace', fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {loading ? <Skeleton width={90} /> : error ? 'Unavailable' : `${filtered.length} subscriber${filtered.length === 1 ? '' : 's'}`}
          </Typography>
        </Box>
      </Box>

      {/* Table header */}
      <Box sx={{
        display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        px: 3, py: 1.5, ...raisedSurface, mb: 2,
        bgcolor: 'background.paper',
      }}>
        {['Email', 'Subscribed'].map((h) => (
          <Typography key={h} sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {h}
          </Typography>
        ))}
      </Box>

      {/* Rows */}
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', px: 3, py: 2, ...raisedSurface, mb: 2 }}>
            <Skel w="55%" h={14} />
            <Skel w={90} h={14} />
          </Box>
        ))
      ) : error ? null : filtered.length === 0 ? (
        <Box sx={{ ...raisedSurface, p: 3 }}><EmptyState
          variant={search ? 'search' : 'empty'}
          title={search ? 'No subscribers found' : 'No subscribers yet'}
          description={
            search
              ? 'No newsletter subscribers match your search.'
              : 'Signups from the marketing site will appear here.'
          }
          compact
        /></Box>
      ) : (
        pagination.page.map((sub) => (
          <Box
            key={sub.id}
            sx={{
              display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'center',
              px: 3, py: 2, ...raisedSurface, mb: 2,
              transition: 'background-color 0.15s ease',
              '&:hover': { boxShadow: 'var(--neu-raised-hover)' },
            }}
          >
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sub.email}
            </Typography>
            <Typography sx={{ ...insetSurface, px: 1.5, py: 1, fontSize: '0.78rem', color: 'text.secondary' }}>
              {formatDate(sub.createdAt)}
            </Typography>
          </Box>
        ))
      )}

      {!loading && filtered.length > 0 && <PaginationBar neumorphic pagination={pagination} accentColor={ACCENT} />}
    </Box>
  )
}
