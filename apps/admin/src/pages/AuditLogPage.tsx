import { useState, useEffect } from 'react'
import { Box, Typography, TextField } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import HistoryIcon from '@mui/icons-material/History'
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded'
import { api } from '@/lib/api'
import PageHeader from '@/components/PageHeader'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'
const PAGE_SIZE = 10

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
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
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.4s ease` }}>
      <Box sx={{ px: 3, pt: 3 }}>
        <PageHeader
          tone="green"
          eyebrow="Operations"
          title="Audit Log"
          lede="Trace every admin and system action taken on the platform, in order, with full detail."
          icon={<HistoryEduRoundedIcon />}
        />
      </Box>

      {/* Filter bar */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
        borderBottom: `1px solid ${B}`,
      }}>
        <Box sx={{ p: 2, borderRight: { sm: `1px solid ${B}` } }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search audit log..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: '0.82rem' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: B },
            }}
          />
        </Box>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', fontFamily: '"Outfit", monospace', whiteSpace: 'nowrap' }}>
            {loading ? '...' : `${total} entries`}
          </Typography>
        </Box>
      </Box>

      {/* Content: full-width log rows */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr' }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{
                display: 'flex', alignItems: 'center', gap: 3,
                borderBottom: `1px solid ${B}`, px: 3, py: 2,
                bgcolor: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
              }}>
                <Skel w={140} h={14} />
                <Skel w={80} h={14} />
                <Skel w={120} h={18} />
                <Box sx={{ flex: 1 }}><Skel h={14} /></Box>
                <Skel w={6} h={6} />
              </Box>
            ))
          : auditEntries.map((entry, idx) => {
              const color = severityColors[entry.severity]
              return (
                <Box
                  key={entry.id}
                  sx={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 3,
                    borderBottom: `1px solid ${B}`,
                    borderLeft: `2px solid ${color}40`,
                    px: 3, py: 1.75,
                    bgcolor: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    animation: `${slideIn} 0.3s ease ${idx * 0.03}s both`,
                    overflow: 'hidden',
                    transition: 'background 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.025)',
                    },
                  }}
                >


                  {/* Watermark — only on first row */}
                  {idx === 0 && (
                    <HistoryIcon sx={{
                      position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 48, color: 'rgba(255,255,255,0.015)', pointerEvents: 'none',
                    }} />
                  )}

                  {/* Timestamp */}
                  <Typography sx={{
                    fontSize: '0.72rem', fontFamily: '"Outfit", monospace',
                    color: 'rgba(255,255,255,0.4)', minWidth: 140, flexShrink: 0,
                  }}>
                    {formatTimestamp(entry.timestamp)}
                  </Typography>

                  {/* User */}
                  <Typography sx={{
                    fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)',
                    minWidth: 80, flexShrink: 0,
                  }}>
                    {entry.user}
                  </Typography>

                  {/* Action badge */}
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center',
                    px: 1, py: 0.25,
                    border: `1px solid ${color}33`,
                    flexShrink: 0,
                  }}>
                    <Typography sx={{
                      fontSize: '0.68rem', fontFamily: '"Outfit", monospace',
                      color: color, textTransform: 'uppercase', letterSpacing: '0.05em',
                      fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {entry.action}
                    </Typography>
                  </Box>

                  {/* Details */}
                  <Typography sx={{
                    flex: 1, fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.details}
                  </Typography>

                  {/* Severity dot */}
                  <Box sx={{
                    width: 6, height: 6, bgcolor: color, flexShrink: 0,
                  }} />
                </Box>
              )
            })
        }
        {!loading && error && (
          <Box sx={{ px: 3, py: 5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ color: '#C06B58', fontSize: '0.85rem' }}>{error}</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.42)', fontSize: '0.76rem', mt: 0.75 }}>
              No demonstration records are shown when the API is unavailable.
            </Typography>
          </Box>
        )}
        {!loading && !error && auditEntries.length === 0 && (
          <Box sx={{ px: 3, py: 5, borderBottom: `1px solid ${B}` }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.85rem' }}>
              {search ? 'No audit entries match this search.' : 'No authenticated changes have been recorded yet.'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Pagination */}
      {total > perPage && (
        <Box
          sx={{
            borderTop: `1px solid ${B}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 1.5,
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, total)} of {total}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Box
              component="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              sx={{
                px: 2, py: 0.75,
                bgcolor: 'transparent',
                border: `1px solid ${B}`,
                color: page === 0 ? 'rgba(255,255,255,0.2)' : 'text.secondary',
                cursor: page === 0 ? 'default' : 'pointer',
                fontSize: '0.75rem',
                fontFamily: '"Outfit", sans-serif',
                transition: 'all 0.2s',
                '&:hover:not(:disabled)': { borderColor: 'rgba(255,255,255,0.15)', color: 'text.primary' },
              }}
            >
              Prev
            </Box>
            {Array.from({ length: Math.ceil(total / perPage) }, (_, i) => (
              <Box
                key={i}
                component="button"
                onClick={() => setPage(i)}
                sx={{
                  px: 1.5, py: 0.75,
                  bgcolor: i === page ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: `1px solid ${i === page ? 'rgba(255,255,255,0.15)' : B}`,
                  color: i === page ? 'text.primary' : 'text.secondary',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontFamily: '"Outfit", monospace',
                  fontWeight: i === page ? 700 : 400,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'rgba(255,255,255,0.15)' },
                }}
              >
                {i + 1}
              </Box>
            ))}
            <Box
              component="button"
              onClick={() => setPage(p => Math.min(Math.ceil(total / perPage) - 1, p + 1))}
              disabled={page >= Math.ceil(total / perPage) - 1}
              sx={{
                px: 2, py: 0.75,
                bgcolor: 'transparent',
                border: `1px solid ${B}`,
                color: page >= Math.ceil(total / perPage) - 1 ? 'rgba(255,255,255,0.2)' : 'text.secondary',
                cursor: page >= Math.ceil(total / perPage) - 1 ? 'default' : 'pointer',
                fontSize: '0.75rem',
                fontFamily: '"Outfit", sans-serif',
                transition: 'all 0.2s',
                '&:hover:not(:disabled)': { borderColor: 'rgba(255,255,255,0.15)', color: 'text.primary' },
              }}
            >
              Next
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
