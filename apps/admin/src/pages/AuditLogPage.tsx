import { useState, useEffect } from 'react'
import { Alert, Box, Pagination, Skeleton, Typography, TextField } from '@mui/material'
import { SHAPE } from '@ubuntu-fund/ui'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded'
import { api } from '@/lib/api'
import PageHeader from '@/components/PageHeader'

const PAGE_SIZE = 10
const surfaceSx = {
  borderRadius: SHAPE.card,
  bgcolor: 'background.paper',
  boxShadow: 'var(--neu-raised)',
}

type Severity = 'info' | 'warning' | 'critical'

interface AuditEntry {
  id: string
  timestamp: string | Date
  user: string
  action: string
  resource: string
  details: string
  severity: Severity
}

const severityColors: Record<Severity, string> = {
  info: '#74909A',
  warning: '#D3A95C',
  critical: '#C06B58',
}

export default function AuditLogPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [perPage] = useState(PAGE_SIZE)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page + 1), pageSize: String(perPage) })
        if (search.trim()) params.set('search', search.trim())
        const result = await api.get<{ items: AuditEntry[]; total: number }>(`/audit?${params}`)
        if (!cancelled) {
          setAuditEntries(result.items)
          setTotal(result.total)
          setError(null)
        }
      } catch (requestError) {
        if (!cancelled) {
          setAuditEntries([])
          setTotal(0)
          setError(requestError instanceof Error ? requestError.message : 'Could not load the audit log')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, search ? 250 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [page, perPage, search])

  const formatTimestamp = (value: string | Date) => {
    const d = new Date(value)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="green"
        eyebrow="Operations"
        title="Audit Log"
        lede="Trace every admin and system action taken on the platform, in order, with full detail."
        icon={<HistoryEduRoundedIcon />}
      />

      <Box sx={{ ...surfaceSx, p: 2.5, mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search audit log..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search audit log' },
            input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment> },
          }}
          sx={{ flex: '1 1 240px' }}
        />
        <Box sx={{ px: 2, py: 1, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-inset)' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {loading ? <Skeleton width={70} /> : error ? 'Unavailable' : `${total} entries`}
          </Typography>
        </Box>
      </Box>

      <Box component="section" aria-label="Audit entries" aria-busy={loading} sx={{ display: 'grid', gap: 2 }}>
        {loading ? Array.from({ length: 8 }, (_, i) => (
          <Box key={i} sx={{ ...surfaceSx, p: 2.5 }}>
            <Skeleton width="45%" height={22} />
            <Skeleton width="80%" height={28} sx={{ mt: 1 }} />
          </Box>
        )) : auditEntries.map(entry => {
          const color = severityColors[entry.severity]
          return (
            <Box component="article" key={entry.id} sx={{ ...surfaceSx, p: 2.5, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1.5 }}>
                <Box aria-hidden="true" sx={{ width: 36, height: 36, display: 'grid', placeItems: 'center', color, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-inset)' }}>
                  <HistoryEduRoundedIcon sx={{ fontSize: 19 }} />
                </Box>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{entry.user}</Typography>
                <Typography component="time" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTimestamp(entry.timestamp)}
                </Typography>
                <Box sx={{ ml: { sm: 'auto' }, px: 1.25, py: 0.5, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-subtle)', color }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize' }}>{entry.severity}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 1.5 }}>
                <Typography sx={{ px: 1.25, py: 0.75, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-inset)', color, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
                  {entry.action}
                </Typography>
                <Typography variant="body2" sx={{ flex: '1 1 260px', minWidth: 0, color: 'text.secondary', overflowWrap: 'anywhere' }}>
                  {entry.details}
                </Typography>
              </Box>
            </Box>
          )
        })}
        {!loading && error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && auditEntries.length === 0 && (
          <Box sx={{ ...surfaceSx, p: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {search ? 'No audit entries match this search.' : 'No authenticated changes have been recorded yet.'}
            </Typography>
          </Box>
        )}
      </Box>

      {total > perPage && (
        <Box sx={{ ...surfaceSx, mt: 3, p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, total)} of {total}
          </Typography>
          <Pagination
            count={Math.ceil(total / perPage)}
            page={page + 1}
            onChange={(_, nextPage) => setPage(nextPage - 1)}
            disabled={loading}
            size="small"
            sx={{
              '& .MuiPagination-ul': { gap: 0.5 },
              '& .MuiPaginationItem-root': {
                borderRadius: SHAPE.sm,
                color: 'text.secondary',
                bgcolor: 'background.paper',
                boxShadow: 'var(--neu-subtle)',
                '&:hover': { boxShadow: 'var(--neu-raised-hover)' },
                '&.Mui-selected': { bgcolor: 'background.paper', color: 'primary.main', boxShadow: 'var(--neu-inset)', fontWeight: 700 },
                '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
                '&.Mui-disabled, &.MuiPaginationItem-ellipsis': { boxShadow: 'none' },
              },
            }}
          />
        </Box>
      )}
    </Box>
  )
}
