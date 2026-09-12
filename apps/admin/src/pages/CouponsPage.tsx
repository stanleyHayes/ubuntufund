import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import CouponFormFields from '@/components/coupons/CouponFormFields'
import { type CouponForm, emptyForm, parseEmails, planLabel } from '@/components/coupons/couponForm'
import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, MenuItem, InputAdornment, Button, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Snackbar, Alert,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import { SHAPE, EmptyState } from '@ubuntu-fund/ui'
import {
  CouponDiscountType,
  CouponCommissionBase,
  Resource,
  Action,
} from '@ubuntu-fund/types'
import type { Coupon, UpdateCouponInput } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import PageHeader from '@/components/PageHeader'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import { TONES } from '@/lib/tones'

const ACCENT = TONES.gold.text

const PAGE_SIZE = 10

const toDateInput = (value?: Date | string): string => {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

const formatDate = (value?: Date | string): string => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDiscount = (coupon: Coupon): string =>
  coupon.discountType === CouponDiscountType.PERCENT
    ? `${coupon.amount}% off`
    : `GH₵ ${coupon.amount} off`

function Skel({ w, h }: { w?: string | number; h?: number }) {
  return <Skeleton variant="rounded" width={w ?? '100%'} height={h ?? 14} />
}

const GRID = '1.2fr 1fr 1fr 1fr 1.4fr 0.7fr 0.8fr'

export default function CouponsPage() {
  const location = useLocation()
  const { can } = useAdminPermissions()
  const canCreate = can(Resource.COUPONS, Action.CREATE)
  const canUpdate = can(Resource.COUPONS, Action.UPDATE)
  const canDelete = can(Resource.COUPONS, Action.DELETE)

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [form, setForm] = useState<CouponForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: Boolean(location.state?.createdCoupon), message: location.state?.createdCoupon ? `Coupon ${location.state.createdCoupon} created` : '', severity: 'success',
  })

  const fetchCoupons = useCallback(() => {
    let cancelled = false
    setLoading(true)
    api.get<Coupon[]>('/coupons')
      .then((data) => { if (!cancelled) setCoupons(Array.isArray(data) ? data : []) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load coupons') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => fetchCoupons(), [fetchCoupons])

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon)
    setForm({
      code: coupon.code,
      description: coupon.description ?? '',
      discountType: coupon.discountType,
      amount: coupon.amount,
      maxDiscountAmount: coupon.maxDiscountAmount ?? 0,
      appliesToSurfaces: coupon.appliesToSurfaces ?? [],
      commissionBase: coupon.commissionBase ?? CouponCommissionBase.POST_COUPON,
      newUsersOnly: coupon.newUsersOnly ?? false,
      allowedEmails: (coupon.allowedEmails ?? []).join('\n'),
      maxRedemptions: coupon.maxRedemptions ?? 0,
      perUserLimit: coupon.perUserLimit ?? 0,
      minSubtotal: coupon.minSubtotal ?? 0,
      appliesToTiers: coupon.appliesToTiers ?? [],
      appliesToBillingCycles: coupon.appliesToBillingCycles ?? [],
      validFrom: toDateInput(coupon.validFrom),
      validUntil: toDateInput(coupon.validUntil),
      active: coupon.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        const payload: UpdateCouponInput = {
          description: form.description || undefined,
          discountType: form.discountType,
          amount: form.amount,
          maxDiscountAmount: form.maxDiscountAmount || 0,
          appliesToSurfaces: form.appliesToSurfaces,
          commissionBase: form.commissionBase,
          newUsersOnly: form.newUsersOnly,
          allowedEmails: parseEmails(form.allowedEmails),
          maxRedemptions: form.maxRedemptions || 0,
          perUserLimit: form.perUserLimit || 0,
          minSubtotal: form.minSubtotal || 0,
          appliesToTiers: form.appliesToTiers,
          appliesToBillingCycles: form.appliesToBillingCycles,
          validFrom: form.validFrom || undefined,
          validUntil: form.validUntil || undefined,
          active: form.active,
        }
        const updated = await api.put<Coupon>(`/coupons/${editing.id}`, payload)
        setCoupons((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        setSnackbar({ open: true, message: 'Coupon updated', severity: 'success' })
      }
      setDialogOpen(false)
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : 'Failed to save coupon', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (coupon: Coupon) => {
    try {
      await api.delete(`/coupons/${coupon.id}`)
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id))
      setDeleteTarget(null)
      setSnackbar({ open: true, message: 'Coupon deleted', severity: 'success' })
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : 'Failed to delete coupon', severity: 'error' })
    }
  }

  const filtered = coupons.filter((c) => {
    if (statusFilter === 'active' && !c.active) return false
    if (statusFilter === 'inactive' && c.active) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.code.toLowerCase().includes(q) && !(c.description ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const pagination = usePagination(filtered, PAGE_SIZE)

  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.redemptions ?? 0), 0)
  const activeCount = coupons.filter((c) => c.active).length

  const codeInvalid = !editing && !form.code.trim()
  const amountInvalid =
    form.amount <= 0 || (form.discountType === CouponDiscountType.PERCENT && form.amount > 100)

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="gold"
        eyebrow="Growth"
        title="Coupons"
        lede="Manage promotions for subscriptions, donations and withdrawal fees."
        icon={<LocalOfferRoundedIcon />}
        actions={canCreate ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            component={RouterLink}
            to="/coupons/new"
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm, bgcolor: TONES.gold.solid, color: '#0E1916', '&:hover': { bgcolor: TONES.gold.border } }}
          >
            New Coupon
          </Button>
        ) : undefined}
        stats={[
          { label: 'Total Coupons', value: loading ? <Skeleton width={50} /> : coupons.length },
          { label: 'Active', value: loading ? <Skeleton width={50} /> : activeCount },
          { label: 'Redemptions', value: loading ? <Skeleton width={50} /> : totalRedemptions.toLocaleString() },
        ]}
      />

      {/* Filters */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 0, ...raisedSurface, mb: 3 }}>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            size="small" variant="outlined" fullWidth
            placeholder="Search by code or description..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            slotProps={{ htmlInput: { 'aria-label': 'Search coupons' } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment> }}
          />
        </Box>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <TextField
            select size="small" variant="outlined" label="Status" fullWidth
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <MenuItem value="all">All Coupons</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </Box>
      </Box>

      {error && !loading ? (
        <Box sx={{ ...raisedSurface, p: 3 }}>
          <EmptyState title="Could not load coupons" description={error} />
        </Box>
      ) : (
        <>
          {/* Table header */}
          <Box sx={{
            display: { xs: 'none', md: 'grid' }, gridTemplateColumns: GRID,
            gap: 2, px: 3, py: 1.2, mb: 2, ...raisedSurface, bgcolor: 'background.paper',
          }}>
            {['Code', 'Discount', 'Redemptions', 'Validity', 'Applies To', 'Status', 'Actions'].map((h) => (
              <Typography key={h} sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {h}
              </Typography>
            ))}
          </Box>

          {/* Rows */}
          <Box sx={{ display: 'grid', gap: 2 }}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: GRID }, gap: 2, px: 3, py: 2, ...raisedSurface }}>
                  {Array.from({ length: 7 }).map((__, j) => <Skel key={j} w={j === 0 ? '70%' : '55%'} h={14} />)}
                </Box>
              ))
            ) : pagination.page.length === 0 ? (
              <Box sx={{ ...raisedSurface, p: 3 }}>
                <EmptyState variant="search" title="No coupons found" description="No coupons match your filters. Try adjusting your search criteria." compact />
              </Box>
            ) : (
              pagination.page.map((c) => {
                const limitLabel = c.maxRedemptions && c.maxRedemptions > 0 ? c.maxRedemptions.toLocaleString() : '∞'
                const appliesTiers = c.appliesToTiers?.length
                  ? c.appliesToTiers.map((t) => planLabel(t)).join(', ')
                  : 'All tiers'
                return (
                  <Box key={c.id} sx={{
                    display: 'grid', gridTemplateColumns: { xs: '1fr', md: GRID }, gap: { xs: 0.75, md: 2 },
                    alignItems: 'center', px: 3, py: 2, ...raisedSurface,
                    transition: 'box-shadow 160ms ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }}>
                    {/* Code + description */}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: '"Outfit", monospace', letterSpacing: '0.04em', color: 'text.primary' }}>
                        {c.code}
                      </Typography>
                      {c.description && (
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.description}
                        </Typography>
                      )}
                    </Box>

                    {/* Discount */}
                    <Box>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.3, ...insetSurface }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' }}>
                          {formatDiscount(c)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Redemptions / limit */}
                    <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontFamily: '"Outfit", monospace', fontVariantNumeric: 'tabular-nums' }}>
                      {(c.redemptions ?? 0).toLocaleString()} / {limitLabel}
                    </Typography>

                    {/* Validity */}
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {!c.validFrom && !c.validUntil ? 'Always' : `${formatDate(c.validFrom)} – ${formatDate(c.validUntil)}`}
                    </Typography>

                    {/* Applies to */}
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {appliesTiers}
                    </Typography>

                    {/* Status */}
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: c.active ? TONES.green.text : 'text.secondary' }}>
                      {c.active ? 'Active' : 'Inactive'}
                    </Typography>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {canUpdate && (
                        <IconButton size="small" onClick={() => openEdit(c)} aria-label={`Edit ${c.code}`} sx={{ color: 'text.secondary', '&:hover': { color: ACCENT } }}>
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                      {canDelete && (
                        <IconButton size="small" onClick={() => setDeleteTarget(c)} aria-label={`Delete ${c.code}`} sx={{ color: 'text.secondary', '&:hover': { color: TONES.clay.text } }}>
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>

          {!loading && filtered.length > 0 && <PaginationBar neumorphic pagination={pagination} accentColor={TONES.gold.solid} />}
        </>
      )}

      {/* Create / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { ...raisedSurface, borderRadius: SHAPE.card } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Edit Coupon</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <CouponFormFields form={form} setForm={setForm} editing />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || codeInvalid || amountInvalid}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm, bgcolor: TONES.gold.solid, color: '#0E1916', '&:hover': { bgcolor: TONES.gold.border } }}
          >
            {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { ...raisedSurface, borderRadius: SHAPE.card } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Coupon?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            Permanently delete <strong>{deleteTarget?.code}</strong>? Existing redemptions are retained, but the code can no longer be applied at checkout.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained" color="error"
            onClick={() => deleteTarget && handleDelete(deleteTarget)}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm }}
          >
            Delete
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
