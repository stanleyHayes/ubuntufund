import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, TextField, MenuItem, InputAdornment, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import { EmptyState, AiWritingBar } from '@ubuntu-fund/ui'
import { AiWritingAction } from '@ubuntu-fund/types'
import FiberNewIcon from '@mui/icons-material/FiberNew'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import ContactMailRoundedIcon from '@mui/icons-material/ContactMailRounded'
import type { ContactSubmission, ContactStatus } from '@ubuntu-fund/types'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'
const ACCENT = '#42A5F5'

interface Stats {
  total: number
  new: number
  inProgress: number
  resolved: number
}

const statusColors: Record<string, string> = {
  new: '#42A5F5',
  in_progress: '#FFA726',
  resolved: '#4CAF50',
  archived: '#78909C',
}

const inquiryColors: Record<string, string> = {
  general: '#78909C',
  partnership: '#AB47BC',
  campaign: '#42A5F5',
  bug: '#EF5350',
}

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

function StatCard({ icon, label, value, color, index }: { icon: React.ReactNode; label: string; value: number; color: string; index: number }) {
  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden',
      borderRight: `1px solid ${B}`, borderBottom: `1px solid ${B}`,
      p: 3,
      animation: `${slideIn} 0.4s ease ${index * 0.08}s both`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ color, '& svg': { fontSize: 20 } }}>{icon}</Box>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
        {value.toLocaleString()}
      </Typography>
    </Box>
  )
}

function ContactSubmissionsPage() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, inProgress: 0, resolved: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [totalItems, setTotalItems] = useState(0)
  const [selected, setSelected] = useState<ContactSubmission | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [newStatus, setNewStatus] = useState<ContactStatus>('new')

  const pagination = usePagination({ totalItems, pageSize: 20 })

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('accessToken')
      ?? (() => { try { return JSON.parse(localStorage.getItem('uf_tokens') ?? 'null')?.accessToken } catch { return null } })()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const headers = getAuthHeaders()
      const params = new URLSearchParams({ page: String(pagination.currentPage), pageSize: '20' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('inquiryType', typeFilter)

      const [subsRes, statsRes] = await Promise.all([
        fetch(`/api/v1/contact?${params}`, { headers }),
        fetch('/api/v1/contact/stats', { headers }),
      ])

      const subsData = await subsRes.json()
      const statsData = await statsRes.json()

      if (subsRes.ok) {
        setSubmissions(subsData.data.items)
        setTotalItems(subsData.data.total)
      }
      if (statsRes.ok) setStats(statsData.data)
    } catch {
      // API unavailable
    } finally {
      setLoading(false)
    }
  }, [pagination.currentPage, statusFilter, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const handleUpdateStatus = async () => {
    if (!selected) return
    try {
      const headers = getAuthHeaders()
      const res = await fetch(`/api/v1/contact/${selected.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus, adminNotes }),
      })
      if (res.ok) {
        setSelected(null)
        fetchData()
      }
    } catch {
      // handle error silently
    }
  }

  const openDetail = (sub: ContactSubmission) => {
    setSelected(sub)
    setNewStatus(sub.status)
    setAdminNotes(sub.adminNotes ?? '')
  }

  const filtered = search
    ? submissions.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.subject.toLowerCase().includes(search.toLowerCase())
      )
    : submissions

  const statCards = [
    { icon: <TrendingUpIcon />, label: 'Total', value: stats.total, color: '#42A5F5' },
    { icon: <FiberNewIcon />, label: 'New', value: stats.new, color: '#42A5F5' },
    { icon: <HourglassTopIcon />, label: 'In Progress', value: stats.inProgress, color: '#FFA726' },
    { icon: <CheckCircleIcon />, label: 'Resolved', value: stats.resolved, color: '#4CAF50' },
  ]

  return (
    <Box sx={{ animation: `${fadeIn} 0.3s ease` }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <ContactMailRoundedIcon sx={{ fontSize: 28, color: ACCENT }} />
        <Box>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Contact Submissions</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Review and manage contact form inquiries</Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{
        display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        border: `1px solid ${B}`, borderRadius: 2, mb: 3, overflow: 'hidden',
        bgcolor: 'rgba(255,255,255,0.015)',
      }}>
        {statCards.map((s, i) => <StatCard key={s.label} {...s} index={i} />)}
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small" placeholder="Search by name, email, subject..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} /></InputAdornment> }}
          sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
        />
        <TextField
          select size="small" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="new">New</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
          <MenuItem value="archived">Archived</MenuItem>
        </TextField>
        <TextField
          select size="small" value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
        >
          <MenuItem value="all">All Types</MenuItem>
          <MenuItem value="general">General</MenuItem>
          <MenuItem value="partnership">Partnership</MenuItem>
          <MenuItem value="campaign">Campaign</MenuItem>
          <MenuItem value="bug">Bug Report</MenuItem>
        </TextField>
      </Box>

      {/* Table */}
      <Box sx={{
        border: `1px solid ${B}`, borderRadius: 2, overflow: 'hidden',
        bgcolor: 'rgba(255,255,255,0.015)',
      }}>
        {/* Header row */}
        <Box sx={{
          display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.8fr 1fr',
          p: 2, borderBottom: `1px solid ${B}`,
          bgcolor: 'rgba(255,255,255,0.02)',
        }}>
          {['Name', 'Subject', 'Type', 'Status', 'Date'].map((h) => (
            <Typography key={h} sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {h}
            </Typography>
          ))}
        </Box>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.8fr 1fr', p: 2, borderBottom: `1px solid ${B}` }}>
              <Skel w="60%" h={14} />
              <Skel w="70%" h={14} />
              <Skel w={70} h={22} />
              <Skel w={60} h={22} />
              <Skel w={80} h={14} />
            </Box>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState variant="search" title="No submissions found" description="No contact submissions match your filters." compact />
        ) : (
          filtered.map((sub, i) => (
            <Box
              key={sub.id}
              onClick={() => openDetail(sub)}
              sx={{
                display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 0.8fr 1fr',
                alignItems: 'center', p: 2,
                borderBottom: `1px solid ${B}`,
                cursor: 'pointer',
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
              <Box>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{sub.name}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{sub.email}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sub.subject}
              </Typography>
              <Chip
                label={sub.inquiryType}
                size="small"
                sx={{
                  width: 'fit-content',
                  fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase',
                  bgcolor: `${inquiryColors[sub.inquiryType] ?? '#78909C'}18`,
                  color: inquiryColors[sub.inquiryType] ?? '#78909C',
                  border: '1px solid',
                  borderColor: `${inquiryColors[sub.inquiryType] ?? '#78909C'}30`,
                }}
              />
              <Chip
                label={sub.status.replace('_', ' ')}
                size="small"
                sx={{
                  width: 'fit-content',
                  fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase',
                  bgcolor: `${statusColors[sub.status] ?? '#78909C'}18`,
                  color: statusColors[sub.status] ?? '#78909C',
                  border: '1px solid',
                  borderColor: `${statusColors[sub.status] ?? '#78909C'}30`,
                }}
              />
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                {new Date(sub.createdAt).toLocaleDateString()}
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

      {/* Detail Dialog */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1a1a2e', border: `1px solid ${B}`, borderRadius: 3 } }}
      >
        {selected && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>
              {selected.subject}
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>
                From {selected.name} &lt;{selected.email}&gt; &middot; {new Date(selected.createdAt).toLocaleString()}
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={selected.inquiryType} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: `${inquiryColors[selected.inquiryType]}18`, color: inquiryColors[selected.inquiryType] }} />
                <Chip label={selected.status.replace('_', ' ')} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: `${statusColors[selected.status]}18`, color: statusColors[selected.status] }} />
              </Box>
              <Typography sx={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, mb: 3, whiteSpace: 'pre-wrap' }}>
                {selected.message}
              </Typography>

              <TextField
                select fullWidth size="small" label="Update Status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ContactStatus)}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </TextField>

              <AiWritingBar
                value={adminNotes}
                onChange={setAdminNotes}
                inputLabel="Response"
                allowedActions={[AiWritingAction.FORMALIZE, AiWritingAction.CASUAL, AiWritingAction.FIX_GRAMMAR, AiWritingAction.IMPROVE_CLARITY, AiWritingAction.GENERATE_EMAIL]}
              />
              <TextField
                fullWidth multiline rows={3} size="small" label="Admin Notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setSelected(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
              <Button
                variant="contained" onClick={handleUpdateStatus}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Update
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}

export default ContactSubmissionsPage
