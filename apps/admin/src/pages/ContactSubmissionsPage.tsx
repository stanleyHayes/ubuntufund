import TextField from '@/components/AdminTextField'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { IconButton, Alert } from '@mui/material'
import ExportMenu from '@/components/ExportMenu'
import { loadAll } from '@/lib/exports/loadAll'
import { exportTable, dateCell } from '@/lib/exports/report'
import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, MenuItem, InputAdornment, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material'
import { keyframes } from '@mui/system'
import SearchIcon from '@mui/icons-material/Search'
import { EmptyState } from '@ubuntu-fund/ui'
import MarkEmailUnreadRoundedIcon from '@mui/icons-material/MarkEmailUnreadRounded'
import type { ContactSubmission, ContactStatus } from '@ubuntu-fund/types'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'
import { TONES } from '@/lib/tones'
import { api } from '@/lib/api'

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`
const slideIn = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`
const B = 'rgba(255,255,255,0.06)'
const ACCENT = '#74909A'

interface Stats {
  total: number
  new: number
  inProgress: number
  resolved: number
}

const statusColors: Record<string, string> = {
  new: '#74909A',
  in_progress: '#D3A95C',
  resolved: '#5E8F72',
  archived: '#78909C',
}

const inquiryColors: Record<string, string> = {
  general: '#78909C',
  partnership: TONES.maroon.text,
  campaign: '#74909A',
  bug: '#C06B58',
}

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return (
    <Box sx={{
      width: w || '100%', height: h || 14,
      bgcolor: 'rgba(255,255,255,0.04)',
    }} />
  )
}

function ContactSubmissionsPage() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, inProgress: 0, resolved: 0 })
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [totalItems, setTotalItems] = useState(0)
  const [selected, setSelected] = useState<ContactSubmission | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [newStatus, setNewStatus] = useState<ContactStatus>('new')

  const pagination = usePagination({ totalItems, pageSize: 20 })

  const [loadError, setLoadError] = useState('')

  // The shared client refreshes the session, sends 401s to sign-in and throws
  // descriptive errors, so a failed load shows an error instead of an empty inbox.
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pagination.currentPage), pageSize: String(pagination.pageSize) })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('inquiryType', typeFilter)

      const [subsData, statsData] = await Promise.all([
        api.get<{ items: ContactSubmission[]; total: number }>(`/contact?${params}`),
        api.get<Stats>('/contact/stats'),
      ])
      setSubmissions(subsData.items)
      setTotalItems(subsData.total)
      setStats(statsData)
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load contact submissions')
    } finally {
      setLoading(false)
    }
  }, [pagination.currentPage, pagination.pageSize, statusFilter, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const handleUpdateStatus = async () => {
    if (!selected || updating) return
    setUpdating(true)
    setUpdateError('')
    try {
      await api.patch(`/contact/${selected.id}/status`, { status: newStatus, adminNotes })
      setSelected(null)
      void fetchData()
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Could not update submission')
    } finally { setUpdating(false) }
  }

  const openDetail = (sub: ContactSubmission) => {
    setUpdateError('')
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

  return (
    <Box sx={{ animation: `${fadeIn} 0.3s ease` }}>
      <PageHeader
        tone="clay"
        eyebrow="Trust & Safety"
        title="Contact Submissions"
        lede="Review and respond to inquiries submitted through the site's contact form."
        icon={<MarkEmailUnreadRoundedIcon />}
        stats={[
          { label: 'Total', value: loadError ? '—' : stats.total },
          { label: 'New', value: loadError ? '—' : stats.new },
          { label: 'In Progress', value: loadError ? '—' : stats.inProgress },
          { label: 'Resolved', value: loadError ? '—' : stats.resolved },
        ]}
      actions={<ExportMenu title="Contact submissions" disabled={loading} getReport={async progress => { const params = new URLSearchParams(); if (statusFilter !== 'all') params.set('status', statusFilter); if (typeFilter !== 'all') params.set('inquiryType', typeFilter);
const rows = (await loadAll<ContactSubmission>('/contact?' + params, progress)).filter(r => !search || [r.name, r.email, r.subject].some(value => value.toLowerCase().includes(search.toLowerCase())));
return { title: 'Contact submissions', filters: [`Status: ${statusFilter}`, `Type: ${typeFilter}`, `Search: ${search || 'All'}`], tables: [exportTable('Submissions', rows, { ID: r => r.id, Name: r => r.name, Email: r => r.email, Subject: r => r.subject, Type: r => r.inquiryType, Status: r => r.status, Message: r => r.message, 'Created (UTC)': r => dateCell(r.createdAt) })] } }} />}
      />


      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField optionContext="contact"
          size="small" placeholder="Search by name, email, subject..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} /></InputAdornment> }}
          sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
        />
        <TextField optionContext="contact"
          select size="small" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); pagination.goToPage(1) }}
          sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' } }}
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="new">New</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
          <MenuItem value="archived">Archived</MenuItem>
        </TextField>
        <TextField optionContext="contact"
          select size="small" value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); pagination.goToPage(1) }}
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
        ) : loadError ? (
          <Alert severity="error" sx={{ m: 2 }} action={<Button color="inherit" onClick={() => void fetchData()}>Retry</Button>}>{loadError}</Alert>
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
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>{sub.name}</Typography>
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
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                {new Date(sub.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          ))
        )}
      </Box>

      {totalItems > 0 && (
        <Box sx={{ mt: 2 }}>
          <PaginationBar pagination={pagination} />
        </Box>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selected}
        onClose={() => { if (!updating) setSelected(null) }}
        maxWidth="sm"
        fullWidth
        aria-labelledby="contact-detail-title"
        PaperProps={{ sx: { ...raisedSurface, backgroundImage: 'none', color: 'text.primary', border: '1px solid', borderColor: 'divider', maxHeight: 'calc(100dvh - 32px)', m: 2 } }}
      >
        {selected && (
          <>
            <DialogTitle id="contact-detail-title" sx={{ fontWeight: 800, pr: 7, overflowWrap: 'anywhere' }}>
              <IconButton aria-label="Close submission" disabled={updating} onClick={() => setSelected(null)} sx={{ position: 'absolute', right: 16, top: 16, color: 'text.primary' }}><CloseRoundedIcon /></IconButton>
<Box aria-hidden="true" sx={{ position: 'absolute', right: 50, top: 30, opacity: .045, pointerEvents: 'none' }}><MarkEmailUnreadRoundedIcon sx={{ fontSize: 135 }} /></Box>
              {selected.subject}
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.5 }}>
                From {selected.name} &lt;{selected.email}&gt; &middot; {new Date(selected.createdAt).toLocaleString()}
              </Typography>
            </DialogTitle>
            <DialogContent sx={{ pt: '16px !important' }}>
              {updateError && <Alert severity="error" sx={{ mb: 2 }}>{updateError}</Alert>}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip label={selected.inquiryType} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: 'action.hover', color: 'text.primary' }} />
                <Chip label={selected.status.replace('_', ' ')} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: 'action.hover', color: 'text.primary' }} />
              </Box>
              <Typography sx={{ fontSize: '0.9rem', color: 'text.primary', lineHeight: 1.7, mb: 3, ...insetSurface, p: 2, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                {selected.message}
              </Typography>

              <TextField optionContext="contact"
                select fullWidth disabled={updating} size="small" label="Update Status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ContactStatus)}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              >
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </TextField>

              <TextField optionContext="contact"
                fullWidth multiline disabled={updating} rows={3} size="small" label="Admin Notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button disabled={updating} onClick={() => setSelected(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
              <Button
                variant="contained" disabled={updating} onClick={handleUpdateStatus}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                {updating ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}

export default ContactSubmissionsPage
