import { useState, useEffect, useMemo } from 'react'
import { Box, Typography, TextField, MenuItem } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import Button from '@mui/material/Button'
import { useMockData } from '@/hooks/useMockData'
import { VerificationLevel, Resource, Action } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import PageHeader from '@/components/PageHeader'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'
const PAGE_SIZE = 9

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

const statusColors: Record<string, string> = {
  pending: '#D3A95C',
  approved: '#5E8F72',
  rejected: '#C06B58',
}

const levelLabels: Record<number, string> = {
  [VerificationLevel.EMAIL_PHONE]: 'Email / Phone',
  [VerificationLevel.NATIONAL_ID]: 'National ID',
  [VerificationLevel.INSTITUTIONAL]: 'Institutional',
  [VerificationLevel.COMMUNITY]: 'Community',
}

type VerificationStatus = 'pending' | 'approved' | 'rejected'

interface Verification {
  id: string
  userId: string
  userName: string
  level: VerificationLevel
  type: string
  status: VerificationStatus
  submittedAt: Date
}

export default function VerificationsPage() {
  const { users } = useMockData()
  const { can } = useAdminPermissions()
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [perPage] = useState(PAGE_SIZE)
  const [localStatuses, setLocalStatuses] = useState<Record<string, VerificationStatus>>({})

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const verifications = useMemo<Verification[]>(() => {
    return users.slice(0, 15).map((u, i) => ({
      id: `ver-${i + 1}`,
      userId: u.id,
      userName: u.name,
      level: [VerificationLevel.EMAIL_PHONE, VerificationLevel.NATIONAL_ID, VerificationLevel.INSTITUTIONAL, VerificationLevel.COMMUNITY][i % 4],
      type: ['ID Document', 'Phone Verification', 'Institution Letter', 'Community Endorsement'][i % 4],
      status: (['pending', 'pending', 'pending', 'approved', 'rejected'] as const)[i % 5],
      submittedAt: new Date(2026, 2, 15 - i),
    }))
  }, [users])

  const getStatus = (v: Verification): VerificationStatus => localStatuses[v.id] ?? v.status

  const filtered = verifications.filter(v => {
    const st = getStatus(v)
    if (statusFilter !== 'all' && st !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return v.userName.toLowerCase().includes(q) || v.type.toLowerCase().includes(q)
    }
    return true
  })

  const paginated = filtered.slice(page * perPage, (page + 1) * perPage)

  const handleAction = (id: string, action: VerificationStatus) => {
    setLocalStatuses(prev => ({ ...prev, [id]: action }))
  }

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.4s ease` }}>
      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety"
        title="Verifications"
        lede="Review identity, phone, institutional, and community verification submissions and approve or reject them."
        icon={<VerifiedUserRoundedIcon />}
      />

      {/* Filter bar */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '200px 1fr auto' },
        borderBottom: `1px solid ${B}`,
      }}>
        <Box sx={{ p: 2, borderRight: { sm: `1px solid ${B}` } }}>
          <TextField
            select
            fullWidth
            size="small"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: '0.82rem' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: B },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.3)' },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.3)' },
            }}
            label="Status"
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ p: 2, borderRight: { sm: `1px solid ${B}` } }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search verifications..."
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
            {loading ? '...' : `${filtered.length} verifications`}
          </Typography>
        </Box>
      </Box>

      {/* Content grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
      }}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Box key={i} sx={{
                borderRight: `1px solid ${B}`,
                borderBottom: `1px solid ${B}`, p: 3,
              }}>
                <Skel w={70} h={18} />
                <Box sx={{ mt: 2 }}><Skel w="60%" h={16} /></Box>
                <Box sx={{ mt: 1.5 }}><Skel w="40%" h={12} /></Box>
                <Box sx={{ mt: 2, borderTop: `1px solid ${B}`, pt: 2 }}><Skel w={90} h={12} /></Box>
                <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                  <Skel w={70} h={28} />
                  <Skel w={70} h={28} />
                </Box>
              </Box>
            ))
          : paginated.map((v, idx) => {
              const st = getStatus(v)
              const color = statusColors[st] || '#74909A'
              return (
                <Box
                  key={v.id}
                  sx={{
                    position: 'relative',
                    borderRight: `1px solid ${B}`,
                    borderBottom: `1px solid ${B}`,
                    borderTop: `2px solid ${color}40`,
                    p: 3,
                    overflow: 'hidden',
                    animation: `${slideIn} 0.4s ease ${idx * 0.04}s both`,
                    transition: 'background 0.25s ease',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.015)',
                    },
                  }}
                >
                  {/* Watermark */}
                  <VerifiedUserIcon sx={{
                    position: 'absolute', right: 12, top: 12, fontSize: 64,
                    color: 'rgba(255,255,255,0.015)', pointerEvents: 'none',
                  }} />

                  {/* Status chip */}
                  <Typography sx={{
                    display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    color: color, letterSpacing: '0.08em',
                    border: `1px solid ${color}33`, px: 1, py: 0.25,
                  }}>
                    {st}
                  </Typography>

                  {/* User name */}
                  <Typography sx={{ mt: 1.5, fontWeight: 700, fontSize: '0.95rem', color: '#fff', fontFamily: '"TT Squares", sans-serif' }}>
                    {v.userName}
                  </Typography>

                  {/* Level + type */}
                  <Typography sx={{ mt: 0.5, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                    {levelLabels[v.level] ?? 'Unknown'} — {v.type}
                  </Typography>

                  {/* Separator */}
                  <Box sx={{ borderTop: `1px solid ${B}`, mt: 2, pt: 1.5 }}>
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                      Submitted: <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)' }}>{v.submittedAt.toLocaleDateString()}</Box>
                    </Typography>
                  </Box>

                  {/* Actions */}
                  {st === 'pending' && can(Resource.VERIFICATIONS, Action.UPDATE) && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleAction(v.id, 'approved')}
                        sx={{
                          fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: '#5E8F72', borderColor: 'rgba(47,107,70,0.3)',
                          '&:hover': { borderColor: '#5E8F72', bgcolor: 'rgba(47,107,70,0.08)' },
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleAction(v.id, 'rejected')}
                        sx={{
                          fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: '#C06B58', borderColor: 'rgba(192,107,88,0.3)',
                          '&:hover': { borderColor: '#C06B58', bgcolor: 'rgba(192,107,88,0.08)' },
                        }}
                      >
                        Reject
                      </Button>
                    </Box>
                  )}
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
