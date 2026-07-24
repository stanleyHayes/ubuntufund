import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, TextField, MenuItem } from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import GavelIcon from '@mui/icons-material/Gavel'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import Button from '@mui/material/Button'
import { Resource, Action } from '@ubuntu-fund/types'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { useMockData } from '@/hooks/useMockData'
import type { Dispute } from '@/hooks/useMockData'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'
const PAGE_SIZE = 8

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

const statusColors: Record<string, string> = {
  open: '#C06B58',
  under_review: '#D3A95C',
  resolved: '#5E8F72',
}

export default function DisputesPage() {
  const navigate = useNavigate()
  const { disputes: initialDisputes } = useMockData()
  const { can } = useAdminPermissions()
  const [loading, setLoading] = useState(true)
  const [disputes] = useState<Dispute[]>(initialDisputes)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])

  const filtered = disputes.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return d.reason.toLowerCase().includes(q) || d.campaignTitle.toLowerCase().includes(q) || d.reporterName.toLowerCase().includes(q)
    }
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  return (
    <Box sx={{ bgcolor: '#0c0c14', minHeight: '100vh', animation: `${fadeIn} 0.4s ease` }}>
      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety"
        title="Disputes"
        lede="Review flagged campaigns and donor complaints, then track each case through to resolution."
        icon={<GavelRoundedIcon />}
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
            onChange={e => setStatusFilter(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: '0.82rem' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: B },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.3)' },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.3)' },
            }}
            label="Status"
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="under_review">Under Review</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
          </TextField>
        </Box>
        <Box sx={{ p: 2, borderRight: { sm: `1px solid ${B}` } }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search disputes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
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
            {loading ? '...' : `${filtered.length} disputes`}
          </Typography>
        </Box>
      </Box>

      {/* Content grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
      }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Box key={i} sx={{ borderRight: { lg: i % 2 === 0 ? `1px solid ${B}` : 'none' }, borderBottom: `1px solid ${B}`, p: 3 }}>
                <Skel w={60} h={18} />
                <Box sx={{ mt: 2 }}><Skel w="80%" h={16} /></Box>
                <Box sx={{ mt: 1.5 }}><Skel w="50%" h={12} /></Box>
                <Box sx={{ mt: 2, borderTop: `1px solid ${B}`, pt: 2, display: 'flex', gap: 4 }}>
                  <Skel w={100} h={12} />
                  <Skel w={100} h={12} />
                </Box>
              </Box>
            ))
          : pagination.page.map((dispute, idx) => {
              const color = statusColors[dispute.status] || '#74909A'
              return (
                <Box
                  key={dispute.id}
                  sx={{
                    position: 'relative',
                    borderRight: { lg: idx % 2 === 0 ? `1px solid ${B}` : 'none' },
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
                  <GavelIcon sx={{
                    position: 'absolute', right: 12, top: 12, fontSize: 64,
                    color: 'rgba(255,255,255,0.015)', pointerEvents: 'none',
                  }} />

                  {/* Status chip */}
                  <Typography sx={{
                    display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    color: color, letterSpacing: '0.08em',
                    border: `1px solid ${color}33`, px: 1, py: 0.25,
                  }}>
                    {dispute.status.replace('_', ' ')}
                  </Typography>

                  {/* Reason */}
                  <Typography sx={{ mt: 1.5, fontWeight: 700, fontSize: '0.95rem', color: '#fff', fontFamily: '"TT Squares", sans-serif' }}>
                    {dispute.reason}
                  </Typography>

                  {/* Campaign title */}
                  <Typography sx={{ mt: 0.5, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                    {dispute.campaignTitle}
                  </Typography>

                  {/* Separator */}
                  <Box sx={{ borderTop: `1px solid ${B}`, mt: 2, pt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                        Reporter: <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)' }}>{dispute.reporterName}</Box>
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                        Opened: <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)' }}>{new Date(dispute.createdAt).toLocaleDateString()}</Box>
                      </Typography>
                    </Box>
                  </Box>

                  {dispute.assigneeName && (
                    <Typography sx={{ mt: 0.75, fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                      Assignee: <Box component="span" sx={{ color: 'rgba(255,255,255,0.6)' }}>{dispute.assigneeName}</Box>
                    </Typography>
                  )}

                  {dispute.resolution && (
                    <Box sx={{
                      mt: 1.5, p: 1.5, border: `1px dashed rgba(76,175,80,0.15)`, bgcolor: 'rgba(76,175,80,0.04)',
                    }}>
                      <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>
                        {dispute.resolution}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/disputes/${dispute.id}`)}
                      sx={{
                        fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)',
                        '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' },
                      }}
                    >
                      View
                    </Button>
                    {dispute.status !== 'resolved' && can(Resource.DISPUTES, Action.UPDATE) && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/disputes/${dispute.id}`)}
                        sx={{
                          fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: '#5E8F72', borderColor: 'rgba(76,175,80,0.3)',
                          '&:hover': { borderColor: '#5E8F72', bgcolor: 'rgba(76,175,80,0.08)' },
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                  </Box>
                </Box>
              )
            })
        }
      </Box>

      {!loading && <PaginationBar pagination={pagination} accentColor="#C06B58" />}

    </Box>
  )
}
