import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, TextField } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import HistoryIcon from '@mui/icons-material/History'
import { useMockData } from '@/hooks/useMockData'

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
  timestamp: Date
  user: string
  action: string
  resource: string
  details: string
  severity: Severity
}

const severityColors: Record<Severity, string> = {
  info: '#42A5F5',
  warning: '#FFA726',
  critical: '#EF5350',
}

export default function AuditLogPage() {
  useMockData() // keep hook active for consistency
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [perPage] = useState(PAGE_SIZE)

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const auditEntries = useMemo<AuditEntry[]>(() => [
    { id: '1', timestamp: new Date(2026, 2, 30, 14, 30), user: 'Admin', action: 'campaign.approve', resource: 'campaign-5', details: 'Approved "Solar Power for Rural Clinic"', severity: 'info' },
    { id: '2', timestamp: new Date(2026, 2, 30, 13, 15), user: 'System', action: 'user.flag', resource: 'user-12', details: 'Flagged suspicious activity on account', severity: 'warning' },
    { id: '3', timestamp: new Date(2026, 2, 30, 12, 0), user: 'Admin', action: 'dispute.resolve', resource: 'dispute-3', details: 'Resolved dispute: funds released', severity: 'info' },
    { id: '4', timestamp: new Date(2026, 2, 29, 22, 45), user: 'System', action: 'campaign.block', resource: 'campaign-8', details: 'Auto-blocked: fraud score exceeded threshold', severity: 'critical' },
    { id: '5', timestamp: new Date(2026, 2, 29, 20, 10), user: 'Admin', action: 'user.verify', resource: 'user-7', details: 'Approved National ID verification for Nala Kamara', severity: 'info' },
    { id: '6', timestamp: new Date(2026, 2, 29, 18, 30), user: 'System', action: 'donation.large', resource: 'donation-45', details: 'Large donation alert: $5,000 to "Scholarship Fund"', severity: 'warning' },
    { id: '7', timestamp: new Date(2026, 2, 29, 16, 0), user: 'Admin', action: 'settings.update', resource: 'platform', details: 'Updated platform fee from 3% to 2.5%', severity: 'info' },
    { id: '8', timestamp: new Date(2026, 2, 29, 14, 20), user: 'System', action: 'campaign.expire', resource: 'campaign-12', details: 'Campaign "Drought Relief" expired unfunded', severity: 'warning' },
    { id: '9', timestamp: new Date(2026, 2, 28, 22, 0), user: 'Admin', action: 'user.ban', resource: 'user-22', details: 'Banned user for repeated fraud attempts', severity: 'critical' },
    { id: '10', timestamp: new Date(2026, 2, 28, 19, 30), user: 'System', action: 'backup.complete', resource: 'database', details: 'Daily backup completed successfully', severity: 'info' },
    { id: '11', timestamp: new Date(2026, 2, 28, 15, 45), user: 'Admin', action: 'report.generate', resource: 'analytics', details: 'Generated monthly analytics report', severity: 'info' },
    { id: '12', timestamp: new Date(2026, 2, 28, 12, 0), user: 'System', action: 'campaign.fund', resource: 'campaign-3', details: '"Build a School in Kumasi" reached funding goal', severity: 'info' },
  ], [])

  const filtered = auditEntries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return e.action.toLowerCase().includes(q) || e.details.toLowerCase().includes(q) || e.user.toLowerCase().includes(q) || e.resource.toLowerCase().includes(q)
  })

  const paginated = filtered.slice(page * perPage, (page + 1) * perPage)

  const formatTimestamp = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.4s ease` }}>
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
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', fontFamily: '"TT Squares", monospace', whiteSpace: 'nowrap' }}>
            {loading ? '...' : `${filtered.length} entries`}
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
          : paginated.map((entry, idx) => {
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
                    fontSize: '0.72rem', fontFamily: '"TT Squares", monospace',
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
                      fontSize: '0.68rem', fontFamily: '"TT Squares", monospace',
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
      </Box>

      {/* Pagination */}
      {filtered.length > perPage && (
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
            Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}
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
                fontFamily: '"TT Squares", sans-serif',
                transition: 'all 0.2s',
                '&:hover:not(:disabled)': { borderColor: 'rgba(255,255,255,0.15)', color: 'text.primary' },
              }}
            >
              Prev
            </Box>
            {Array.from({ length: Math.ceil(filtered.length / perPage) }, (_, i) => (
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
                  fontFamily: '"TT Squares", monospace',
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
              onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / perPage) - 1, p + 1))}
              disabled={page >= Math.ceil(filtered.length / perPage) - 1}
              sx={{
                px: 2, py: 0.75,
                bgcolor: 'transparent',
                border: `1px solid ${B}`,
                color: page >= Math.ceil(filtered.length / perPage) - 1 ? 'rgba(255,255,255,0.2)' : 'text.secondary',
                cursor: page >= Math.ceil(filtered.length / perPage) - 1 ? 'default' : 'pointer',
                fontSize: '0.75rem',
                fontFamily: '"TT Squares", sans-serif',
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
