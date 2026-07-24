import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, TextField, MenuItem, InputAdornment, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Rating, Avatar, IconButton, Snackbar, Alert,
} from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import PublicIcon from '@mui/icons-material/Public'
import DraftsIcon from '@mui/icons-material/Drafts'
import ArchiveIcon from '@mui/icons-material/Archive'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { EmptyState, AiWritingBar } from '@ubuntu-fund/ui'
import { AiWritingAction } from '@ubuntu-fund/types'
import type { Testimonial, TestimonialStatus, CreateTestimonialInput } from '@ubuntu-fund/types'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'
const ACCENT = '#DCC07E'

interface Stats {
  total: number
  published: number
  draft: number
  archived: number
}

const statusColors: Record<string, string> = {
  draft: '#78909C',
  published: '#5E8F72',
  archived: '#FF7043',
}

const AVATAR_COLORS = [
  '#2E3D2F', '#1565C0', '#A07E33', '#6A1B9A',
  '#C62828', '#00695C', '#E65100', '#283593',
]

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14, borderRadius: 1,
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

const emptyForm: CreateTestimonialInput = {
  name: '',
  role: '',
  location: '',
  quote: '',
  rating: 5,
  avatarColor: AVATAR_COLORS[0],
  status: 'draft',
  displayOrder: 0,
}

function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, draft: 0, archived: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [totalItems, setTotalItems] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateTestimonialInput>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

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

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/v1/testimonials?${params}`, { headers }),
        fetch('/api/v1/testimonials/stats', { headers }),
      ])

      const listData = await listRes.json()
      const statsData = await statsRes.json()

      if (listRes.ok) {
        setTestimonials(listData.data.items)
        setTotalItems(listData.data.total)
      }
      if (statsRes.ok) setStats(statsData.data)
    } catch {
      // API unavailable
    } finally {
      setLoading(false)
    }
  }, [pagination.currentPage, statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (t: Testimonial) => {
    setEditingId(t.id)
    setForm({
      name: t.name,
      role: t.role,
      location: t.location,
      quote: t.quote,
      rating: t.rating,
      avatarColor: t.avatarColor,
      status: t.status,
      displayOrder: t.displayOrder,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      const headers = getAuthHeaders()
      const url = editingId
        ? `/api/v1/testimonials/${editingId}`
        : '/api/v1/testimonials'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setDialogOpen(false)
        setSnackbar({ open: true, message: editingId ? 'Testimonial updated' : 'Testimonial created', severity: 'success' })
        fetchData()
      } else {
        const err = await res.json().catch(() => ({ message: 'Failed' }))
        setSnackbar({ open: true, message: err.message || 'Failed to save', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Network error', severity: 'error' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const headers = getAuthHeaders()
      const res = await fetch(`/api/v1/testimonials/${id}`, { method: 'DELETE', headers })
      if (res.ok) {
        setDeleteConfirm(null)
        setSnackbar({ open: true, message: 'Testimonial deleted', severity: 'success' })
        fetchData()
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete', severity: 'error' })
    }
  }

  const filtered = search
    ? testimonials.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.role.toLowerCase().includes(search.toLowerCase()) ||
        t.location.toLowerCase().includes(search.toLowerCase())
      )
    : testimonials

  const statCards = [
    { icon: <TrendingUpIcon />, label: 'Total', value: stats.total, color: ACCENT },
    { icon: <PublicIcon />, label: 'Published', value: stats.published, color: '#5E8F72' },
    { icon: <DraftsIcon />, label: 'Draft', value: stats.draft, color: '#78909C' },
    { icon: <ArchiveIcon />, label: 'Archived', value: stats.archived, color: '#FF7043' },
  ]

  return (
    <Box sx={{ animation: `${fadeIn} 0.3s ease` }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FormatQuoteRoundedIcon sx={{ fontSize: 28, color: ACCENT }} />
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Testimonials</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Manage success stories shown on the marketing site</Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: 2,
            bgcolor: ACCENT, '&:hover': { bgcolor: '#A07E33' },
          }}
        >
          Add Testimonial
        </Button>
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
          size="small" placeholder="Search by name, role, location..."
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
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="archived">Archived</MenuItem>
        </TextField>
      </Box>

      {/* Table */}
      <Box sx={{
        border: `1px solid ${B}`, borderRadius: 2, overflow: 'hidden',
        bgcolor: 'rgba(255,255,255,0.015)',
      }}>
        {/* Header row */}
        <Box sx={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.7fr 0.6fr 0.5fr',
          p: 2, borderBottom: `1px solid ${B}`,
          bgcolor: 'rgba(255,255,255,0.02)',
        }}>
          {['Person', 'Location', 'Quote Preview', 'Rating', 'Status', 'Actions'].map((h) => (
            <Typography key={h} sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {h}
            </Typography>
          ))}
        </Box>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.7fr 0.6fr 0.5fr', alignItems: 'center', p: 2, borderBottom: `1px solid ${B}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Skel w={36} h={36} />
                <Box sx={{ flex: 1 }}><Skel w="70%" h={14} /><Box sx={{ mt: 0.5 }}><Skel w="50%" h={12} /></Box></Box>
              </Box>
              <Skel w="60%" h={14} />
              <Skel w="80%" h={14} />
              <Skel w={80} h={14} />
              <Skel w={60} h={22} />
              <Skel w={60} h={28} />
            </Box>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState variant="search" title="No testimonials found" description="No testimonials match your filters." compact />
        ) : (
          filtered.map((t, i) => (
            <Box
              key={t.id}
              sx={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.7fr 0.6fr 0.5fr',
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: t.avatarColor, width: 36, height: 36, fontWeight: 700, fontSize: '0.85rem' }}>
                  {t.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{t.name}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{t.role}</Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{t.location}</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 2 }}>
                {t.quote.substring(0, 60)}...
              </Typography>
              <Rating value={t.rating} readOnly size="small" />
              <Chip
                label={t.status}
                size="small"
                sx={{
                  width: 'fit-content',
                  fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase',
                  bgcolor: `${statusColors[t.status] ?? '#78909C'}18`,
                  color: statusColors[t.status] ?? '#78909C',
                  border: '1px solid',
                  borderColor: `${statusColors[t.status] ?? '#78909C'}30`,
                }}
              />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" onClick={() => openEdit(t)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: ACCENT } }}>
                  <EditIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" onClick={() => setDeleteConfirm(t.id)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#C06B58' } }}>
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </Box>
          ))
        )}
      </Box>

      {totalItems > 20 && (
        <Box sx={{ mt: 2 }}>
          <PaginationBar pagination={pagination} accentColor={ACCENT} />
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1a1a2e', border: `1px solid ${B}`, borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingId ? 'Edit Testimonial' : 'Add Testimonial'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth size="small" label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              fullWidth size="small" label="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
          <TextField
            fullWidth size="small" label="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <AiWritingBar
            value={form.quote}
            onChange={(v) => setForm({ ...form, quote: v })}
            inputLabel="Testimonial Content"
            allowedActions={[AiWritingAction.FORMALIZE, AiWritingAction.SUMMARIZE, AiWritingAction.FIX_GRAMMAR, AiWritingAction.IMPROVE_CLARITY, AiWritingAction.GENERATE_TITLE]}
          />
          <TextField
            fullWidth multiline rows={4} size="small" label="Quote"
            value={form.quote}
            onChange={(e) => setForm({ ...form, quote: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>Rating</Typography>
              <Rating
                value={form.rating}
                onChange={(_, v) => setForm({ ...form, rating: v ?? 5 })}
              />
            </Box>
            <TextField
              select size="small" label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TestimonialStatus })}
              sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="published">Published</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </TextField>
            <TextField
              size="small" label="Display Order" type="number"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
              sx={{ width: 120, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', mb: 1 }}>Avatar Color</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {AVATAR_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setForm({ ...form, avatarColor: c })}
                  sx={{
                    width: 32, height: 32, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                    border: form.avatarColor === c ? '3px solid #fff' : '3px solid transparent',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': { boxShadow: '0 0 0 2px rgba(255,255,255,0.35)' },
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave}
            disabled={!form.name || !form.role || !form.location || !form.quote}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, bgcolor: ACCENT, '&:hover': { bgcolor: '#F57C00' } }}
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        PaperProps={{ sx: { bgcolor: '#1a1a2e', border: `1px solid ${B}`, borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Testimonial?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
            This action cannot be undone. The testimonial will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained" color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default TestimonialsPage
