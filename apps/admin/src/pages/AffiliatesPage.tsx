import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, TextField, MenuItem, InputAdornment, Button, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Snackbar, Alert, Tabs, Tab,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import EditIcon from '@mui/icons-material/Edit'
import VisibilityIcon from '@mui/icons-material/Visibility'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import { SHAPE, EmptyState } from '@ubuntu-fund/ui'
import { AffiliateStatus, Resource, Action } from '@ubuntu-fund/types'
import type { Affiliate, AffiliatePayout } from '@ubuntu-fund/types'
import type { PayoutStatus } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import { TONES } from '@/lib/tones'

const ACCENT = TONES.green.solid
const PAGE_SIZE = 10

const statusColors: Record<AffiliateStatus, string> = {
  [AffiliateStatus.ACTIVE]: TONES.green.text,
  [AffiliateStatus.SUSPENDED]: TONES.clay.text,
}

const payoutStatusColors: Record<PayoutStatus, string> = {
  PENDING: TONES.gold.text,
  PROCESSING: TONES.teal.text,
  PAID: TONES.green.text,
  FAILED: TONES.clay.text,
  REVERSED: TONES.maroon.text,
}

const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id)
const formatMoney = (amount: number, currency = 'GHS') => `${currency === 'GHS' ? 'GH₵' : currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatDate = (value?: Date | string) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
}

const AFF_GRID = '1.4fr 1.1fr 0.9fr 0.8fr 1.2fr 0.9fr'
const PAYOUT_GRID = '1.3fr 1fr 1fr 1.2fr 1fr'

export default function AffiliatesPage() {
  const navigate = useNavigate()
  const { can } = useAdminPermissions()
  const canUpdate = can(Resource.AFFILIATES, Action.UPDATE)

  const [tab, setTab] = useState(0)

  // Affiliates list
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [loadingAffiliates, setLoadingAffiliates] = useState(true)
  const [affiliatesError, setAffiliatesError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AffiliateStatus>('all')

  // Payouts list
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([])
  const [loadingPayouts, setLoadingPayouts] = useState(true)
  const [payoutsError, setPayoutsError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Edit dialog
  const [editing, setEditing] = useState<Affiliate | null>(null)
  const [editRate, setEditRate] = useState('')
  const [editStatus, setEditStatus] = useState<AffiliateStatus>(AffiliateStatus.ACTIVE)
  const [saving, setSaving] = useState(false)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  })

  const fetchAffiliates = useCallback(() => {
    let cancelled = false
    setLoadingAffiliates(true)
    api.get<Affiliate[]>('/affiliates')
      .then((data) => { if (!cancelled) setAffiliates(Array.isArray(data) ? data : []) })
      .catch((e: unknown) => { if (!cancelled) setAffiliatesError(e instanceof Error ? e.message : 'Could not load affiliates') })
      .finally(() => { if (!cancelled) setLoadingAffiliates(false) })
    return () => { cancelled = true }
  }, [])

  const fetchPayouts = useCallback(() => {
    let cancelled = false
    setLoadingPayouts(true)
    api.get<AffiliatePayout[]>('/affiliates/payouts')
      .then((data) => { if (!cancelled) setPayouts(Array.isArray(data) ? data : []) })
      .catch((e: unknown) => { if (!cancelled) setPayoutsError(e instanceof Error ? e.message : 'Could not load payouts') })
      .finally(() => { if (!cancelled) setLoadingPayouts(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => fetchAffiliates(), [fetchAffiliates])
  useEffect(() => fetchPayouts(), [fetchPayouts])

  const openEdit = (affiliate: Affiliate) => {
    setEditing(affiliate)
    setEditRate(String(affiliate.commissionRate))
    setEditStatus(affiliate.status)
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const rate = parseFloat(editRate)
      let updated = editing
      if (!Number.isNaN(rate) && rate !== editing.commissionRate) {
        updated = await api.put<Affiliate>(`/affiliates/${editing.id}/commission-rate`, { commissionRate: rate })
      }
      if (editStatus !== editing.status) {
        updated = await api.put<Affiliate>(`/affiliates/${editing.id}/status`, { status: editStatus })
      }
      setAffiliates((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      setSnackbar({ open: true, message: 'Affiliate updated', severity: 'success' })
      setEditing(null)
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : 'Failed to update affiliate', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (payout: AffiliatePayout) => {
    setApprovingId(payout.id)
    try {
      const updated = await api.post<AffiliatePayout>(`/affiliates/payouts/${payout.id}/approve`)
      setPayouts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setSnackbar({ open: true, message: 'Payout approved and transfer initiated', severity: 'success' })
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : 'Failed to approve payout', severity: 'error' })
    } finally {
      setApprovingId(null)
    }
  }

  const filteredAffiliates = affiliates.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!a.referralCode.toLowerCase().includes(q) && !a.userId.toLowerCase().includes(q) && !(a.accountName ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const affPagination = usePagination(filteredAffiliates, PAGE_SIZE)
  const payoutPagination = usePagination(payouts, PAGE_SIZE)

  const activeCount = affiliates.filter((a) => a.status === AffiliateStatus.ACTIVE).length
  const pendingPayouts = payouts.filter((p) => p.status === 'PENDING').length

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="green"
        eyebrow="Growth"
        title="Affiliates"
        lede="Manage referral partners, tune commission rates, and clear the payout approval queue."
        icon={<HandshakeRoundedIcon />}
        stats={[
          { label: 'Affiliates', value: loadingAffiliates ? <Skeleton width={50} /> : affiliates.length },
          { label: 'Active', value: loadingAffiliates ? <Skeleton width={50} /> : activeCount },
          { label: 'Payouts', value: loadingPayouts ? <Skeleton width={50} /> : payouts.length },
          { label: 'Awaiting Approval', value: loadingPayouts ? <Skeleton width={50} /> : pendingPayouts },
        ]}
      />

      <Box sx={{ ...raisedSurface, mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 52 }, '& .MuiTabs-indicator': { bgcolor: ACCENT } }}
        >
          <Tab label="Affiliates" />
          <Tab label={`Payout Queue${pendingPayouts ? ` (${pendingPayouts})` : ''}`} />
        </Tabs>
      </Box>

      {tab === 0 && (
        <>
          {/* Filters */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, ...raisedSurface, mb: 3 }}>
            <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
              <TextField
                size="small" variant="outlined" fullWidth
                placeholder="Search by code, user, or account name..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                slotProps={{ htmlInput: { 'aria-label': 'Search affiliates' } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
              />
            </Box>
            <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
              <TextField
                select size="small" variant="outlined" label="Status" fullWidth
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                {Object.values(AffiliateStatus).map((s) => (
                  <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>

          {affiliatesError && !loadingAffiliates ? (
            <Box sx={{ ...raisedSurface, p: 3 }}>
              <EmptyState title="Could not load affiliates" description={affiliatesError} />
            </Box>
          ) : (
            <>
              {/* Header */}
              <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: AFF_GRID, gap: 2, px: 3, py: 1.2, mb: 2, ...raisedSurface, bgcolor: 'background.paper' }}>
                {['Referral Code', 'User', 'Status', 'Rate', 'Payout Recipient', 'Actions'].map((h) => (
                  <Typography key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
                ))}
              </Box>

              {/* Rows */}
              <Box sx={{ display: 'grid', gap: 2 }}>
                {loadingAffiliates ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: AFF_GRID }, gap: 2, px: 3, py: 2, ...raisedSurface }}>
                      {Array.from({ length: 6 }).map((__, j) => <Skel key={j} w={j === 0 ? '70%' : '55%'} h={14} />)}
                    </Box>
                  ))
                ) : affPagination.page.length === 0 ? (
                  <Box sx={{ ...raisedSurface, p: 3 }}>
                    <EmptyState variant="search" title="No affiliates found" description="No affiliates match your filters." compact />
                  </Box>
                ) : (
                  affPagination.page.map((a) => (
                    <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: AFF_GRID }, gap: { xs: 0.75, md: 2 }, alignItems: 'center', px: 3, py: 2, ...raisedSurface }}>
                      {/* Referral code */}
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: '"Outfit", monospace', letterSpacing: '0.04em', color: 'text.primary' }}>
                        {a.referralCode}
                      </Typography>

                      {/* User id */}
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontFamily: '"Outfit", monospace' }}>
                        {shortId(a.userId)}
                      </Typography>

                      {/* Status */}
                      <Box>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.3, ...insetSurface }}>
                          <Box sx={{ width: 6, height: 6, bgcolor: statusColors[a.status], flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: statusColors[a.status], textTransform: 'capitalize' }}>{a.status}</Typography>
                        </Box>
                      </Box>

                      {/* Commission rate */}
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.primary', fontFamily: '"Outfit", monospace' }}>
                        {a.commissionRate}%
                      </Typography>

                      {/* Payout recipient */}
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.accountName ? `${a.accountName}${a.accountNumber ? ` · ${a.accountNumber}` : ''}` : 'Not set'}
                      </Typography>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => navigate(`/affiliates/${a.id}`)} aria-label={`View ${a.referralCode}`} sx={{ color: 'text.secondary', '&:hover': { color: TONES.teal.text } }}>
                          <VisibilityIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        {canUpdate && (
                          <IconButton size="small" onClick={() => openEdit(a)} aria-label={`Edit ${a.referralCode}`} sx={{ color: 'text.secondary', '&:hover': { color: ACCENT } }}>
                            <EditIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>

              {!loadingAffiliates && filteredAffiliates.length > 0 && <PaginationBar neumorphic pagination={affPagination} accentColor={ACCENT} />}
            </>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          {payoutsError && !loadingPayouts ? (
            <Box sx={{ ...raisedSurface, p: 3 }}>
              <EmptyState title="Could not load payouts" description={payoutsError} />
            </Box>
          ) : (
            <>
              {/* Header */}
              <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: PAYOUT_GRID, gap: 2, px: 3, py: 1.2, mb: 2, ...raisedSurface, bgcolor: 'background.paper' }}>
                {['Affiliate', 'Amount', 'Status', 'Requested', 'Action'].map((h) => (
                  <Typography key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</Typography>
                ))}
              </Box>

              {/* Rows */}
              <Box sx={{ display: 'grid', gap: 2 }}>
                {loadingPayouts ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: PAYOUT_GRID }, gap: 2, px: 3, py: 2, ...raisedSurface }}>
                      {Array.from({ length: 5 }).map((__, j) => <Skel key={j} w={j === 0 ? '70%' : '55%'} h={14} />)}
                    </Box>
                  ))
                ) : payoutPagination.page.length === 0 ? (
                  <Box sx={{ ...raisedSurface, p: 3 }}>
                    <EmptyState title="No payouts yet" description="Affiliate payout requests will appear here for approval." compact />
                  </Box>
                ) : (
                  payoutPagination.page.map((p) => (
                    <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: PAYOUT_GRID }, gap: { xs: 0.75, md: 2 }, alignItems: 'center', px: 3, py: 2, ...raisedSurface }}>
                      {/* Affiliate id (link to detail) */}
                      <Box
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/affiliates/${p.affiliateId}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/affiliates/${p.affiliateId}`) }}
                        sx={{ cursor: 'pointer', minWidth: 0 }}
                      >
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: TONES.teal.text, fontFamily: '"Outfit", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {shortId(p.affiliateId)}
                        </Typography>
                      </Box>

                      {/* Amount */}
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.primary', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(p.amount, p.currency)}
                      </Typography>

                      {/* Status */}
                      <Box>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.3, ...insetSurface }}>
                          <Box sx={{ width: 6, height: 6, bgcolor: payoutStatusColors[p.status], flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: payoutStatusColors[p.status], textTransform: 'capitalize' }}>{p.status.toLowerCase()}</Typography>
                        </Box>
                      </Box>

                      {/* Requested date */}
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                        {formatDate(p.createdAt)}
                      </Typography>

                      {/* Approve action */}
                      <Box>
                        {p.status === 'PENDING' && canUpdate ? (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
                            disabled={approvingId === p.id}
                            onClick={() => handleApprove(p)}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm, bgcolor: ACCENT, color: '#0E1916', '&:hover': { bgcolor: TONES.green.border } }}
                          >
                            {approvingId === p.id ? 'Approving…' : 'Approve'}
                          </Button>
                        ) : (
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                            {p.status === 'PENDING' ? 'Awaiting approval' : '—'}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>

              {!loadingPayouts && payouts.length > 0 && <PaginationBar neumorphic pagination={payoutPagination} accentColor={ACCENT} />}
            </>
          )}
        </>
      )}

      {/* Edit dialog */}
      <Dialog
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { ...raisedSurface, borderRadius: SHAPE.card } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Edit Affiliate</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {editing && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              <strong style={{ fontFamily: '"Outfit", monospace' }}>{editing.referralCode}</strong> · user {shortId(editing.userId)}
            </Typography>
          )}
          <TextField
            fullWidth size="small" label="Commission Rate" type="number"
            value={editRate}
            onChange={(e) => setEditRate(e.target.value)}
            helperText="Percent of net paid-subscription revenue (0–100)"
            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          />
          <TextField
            select fullWidth size="small" label="Status"
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as AffiliateStatus)}
          >
            {Object.values(AffiliateStatus).map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)} sx={{ textTransform: 'none' }} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm, bgcolor: ACCENT, color: '#0E1916', '&:hover': { bgcolor: TONES.green.border } }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ borderRadius: SHAPE.sm }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
