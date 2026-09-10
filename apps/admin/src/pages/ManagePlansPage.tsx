import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import InputAdornment from '@mui/material/InputAdornment'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { BrandedTextField as TextField, EmptyState, ErrorState, LoadingDots } from '@ubuntu-fund/ui'
import {
  Resource,
  Action,
  type SubscriptionPlan,
  type UpdateSubscriptionPlanInput,
} from '@ubuntu-fund/types'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import { api } from '@/lib/api'
import { useAdminPlans } from '@/hooks/useApiData'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import PageHeader from '@/components/PageHeader'

const FEATURE_TOGGLES: { key: keyof SubscriptionPlan; label: string }[] = [
  { key: 'featuredListing', label: 'Featured listing' },
  { key: 'prioritySupport', label: 'Priority support' },
  { key: 'advancedAnalytics', label: 'Advanced analytics' },
  { key: 'customBranding', label: 'Custom branding' },
  { key: 'escrowSupport', label: 'Escrow & milestones' },
  { key: 'liveStreaming', label: 'Live streaming' },
  { key: 'campaignCollaboration', label: 'Campaign collaboration' },
]

const NUMERIC_LIMITS: { key: keyof SubscriptionPlan; label: string; unlimited?: boolean }[] = [
  { key: 'maxActiveCampaigns', label: 'Max active campaigns', unlimited: true },
  { key: 'maxCampaignGoal', label: 'Max campaign goal (GH₵)', unlimited: true },
  { key: 'maxMediaPerCampaign', label: 'Max media per campaign', unlimited: true },
  { key: 'maxTeamMembers', label: 'Max team members', unlimited: true },
  { key: 'maxPayoutAccounts', label: 'Saved payout accounts', unlimited: true },
  { key: 'maxCollaboratorsPerCampaign', label: 'Max collaborators per campaign', unlimited: true },
]

/** The editable subset sent to `PUT /plans/:tier` (tier is immutable). */
function toPatch(plan: SubscriptionPlan): UpdateSubscriptionPlanInput {
  const { tier: _tier, ...rest } = plan
  return rest
}

function limitDisplay(value: number): string {
  return value === -1 ? 'Unlimited' : value.toLocaleString()
}

/** A blank plan for the "new tier" form; admins fill in the tier id + details. */
function blankPlan(nextSortOrder: number): SubscriptionPlan {
  return {
    tier: '', name: '', description: '',
    priceMonthly: 0, priceYearly: 0, platformFeePercent: 3.5,
    maxActiveCampaigns: 1, maxCampaignGoal: 10000,
    featuredListing: false, prioritySupport: false, advancedAnalytics: false,
    customBranding: false, maxMediaPerCampaign: 3, escrowSupport: false,
    liveStreaming: false, maxTeamMembers: 1, campaignCollaboration: false,
    maxCollaboratorsPerCampaign: 0,
    maxPayoutAccounts: 1,
    sortOrder: nextSortOrder, active: true, isPublic: true, accentColor: '#2E3D2F', popular: false,
  }
}

/** Lowercase-slug validity for a NEW tier id (matches the API's create schema). */
function isValidTierId(tier: string): boolean {
  return /^[a-z][a-z0-9_-]{1,39}$/.test(tier)
}

export default function ManagePlansPage() {
  const { can } = useAdminPermissions()
  const canUpdate = can(Resource.PLANS, Action.UPDATE)
  const canCreate = can(Resource.PLANS, Action.CREATE)
  const { data, isLoading, error } = useAdminPlans()

  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [form, setForm] = useState<SubscriptionPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null)
  const [createForm, setCreateForm] = useState<SubscriptionPlan | null>(null)

  useEffect(() => { setPlans(data) }, [data])

  const ordered = useMemo(
    // Admin-set order (sortOrder), so admin-ADDED tiers slot in wherever configured.
    () => [...plans].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.priceMonthly - b.priceMonthly),
    [plans],
  )
  const pagination = usePagination(ordered, 12)
  const paidCount = useMemo(() => plans.filter((plan) => plan.priceMonthly > 0).length, [plans])

  function openEdit(plan: SubscriptionPlan) {
    if (!canUpdate) return
    setEditing(plan)
    setForm({ ...plan })
  }

  function closeEdit() {
    if (saving) return
    setEditing(null)
    setForm(null)
  }

  function setField<K extends keyof SubscriptionPlan>(key: K, value: SubscriptionPlan[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    try {
      const updated = await api.put<SubscriptionPlan>(`/plans/${form.tier}`, toPatch(form))
      setPlans((current) => current.map((plan) => (plan.tier === updated.tier ? updated : plan)))
      setMessage({ text: `${updated.name} plan updated.`, severity: 'success' })
      setEditing(null)
      setForm(null)
    } catch (saveError) {
      setMessage({
        text: saveError instanceof Error ? saveError.message : 'Unable to update the plan.',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  function openCreate() {
    if (!canCreate) return
    const nextOrder = plans.length ? Math.max(...plans.map((p) => p.sortOrder ?? 0)) + 1 : 0
    setCreateForm(blankPlan(nextOrder))
  }

  function closeCreate() {
    if (saving) return
    setCreateForm(null)
  }

  function setCreateField<K extends keyof SubscriptionPlan>(key: K, value: SubscriptionPlan[K]) {
    setCreateForm((current) => (current ? { ...current, [key]: value } : current))
  }

  async function handleCreate() {
    if (!createForm) return
    if (!isValidTierId(createForm.tier)) {
      setMessage({ text: 'Tier id must be lowercase letters/digits/-/_ (min 2 chars).', severity: 'error' })
      return
    }
    setSaving(true)
    try {
      const created = await api.post<SubscriptionPlan>('/plans', createForm)
      setPlans((current) => [...current, created])
      setMessage({ text: `${created.name} plan created.`, severity: 'success' })
      setCreateForm(null)
    } catch (createError) {
      setMessage({
        text: createError instanceof Error ? createError.message : 'Unable to create the plan.',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader
        tone="green"
        eyebrow="Platform"
        title="Subscription plans"
        lede="Edit pricing, limits, and benefits for every plan tier."
        icon={<LayersRoundedIcon />}
        stats={[
          { label: 'Plans', value: isLoading ? <Skeleton width={40} /> : error ? '—' : plans.length },
          { label: 'Paid tiers', value: isLoading ? <Skeleton width={40} /> : error ? '—' : paidCount },
          { label: 'Editing', value: canUpdate ? 'Enabled' : 'View only' },
        ]}
      />

      {canCreate && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
          >
            New plan
          </Button>
        </Box>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        Prices, limits and tiers are stored in the database and read across the platform. Admins can add new tiers
        and reorder them; the code-defined defaults seed this list and act as a safe fallback. Use -1 for an
        unlimited numeric limit.
      </Alert>
      {error && plans.length > 0 && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {isLoading ? (
        <Box aria-label="Loading plans" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 2.5 }}>
          {[0, 1, 2, 3].map((item) => (
            <Box key={item} sx={{ ...raisedSurface, p: 3 }}>
              <Skeleton width="55%" height={30} />
              <Skeleton height={72} sx={{ my: 2 }} />
              <Skeleton width="40%" />
            </Box>
          ))}
        </Box>
      ) : plans.length === 0 ? (
        error ? (
          <Box sx={{ ...raisedSurface, p: 3 }}>
            <ErrorState title="Plans unavailable" message={error} compact />
          </Box>
        ) : (
          <Box sx={{ ...raisedSurface, p: 3 }}>
            <EmptyState variant="noData" title="No plans configured" description="Plans will appear here once the backend has seeded them." compact />
          </Box>
        )
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 2.5 }}>
          {pagination.page.map((plan) => {
            const features = FEATURE_TOGGLES.filter((toggle) => plan[toggle.key]).map((toggle) => toggle.label)
            return (
              <Card key={plan.tier} sx={{ ...raisedSurface, height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{plan.name}</Typography>
                    <Chip label={plan.priceMonthly === 0 ? 'Free' : 'Paid'} size="small" color={plan.priceMonthly === 0 ? 'default' : 'success'} />
                  </Box>
                  <Typography color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>{plan.description}</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
                    {plan.priceMonthly === 0 ? 'Free' : `GH₵ ${plan.priceMonthly}/mo`}
                  </Typography>
                  <Box component="dl" sx={{ ...insetSurface, m: 0, p: 2, mb: 3, display: 'grid', gap: 2 }}>
                    {[
                      ['Yearly price', plan.priceYearly === 0 ? 'Free' : `GH₵ ${plan.priceYearly.toLocaleString()}`],
                      ['Platform fee', `${plan.platformFeePercent}%`],
                      ['Active campaigns', limitDisplay(plan.maxActiveCampaigns)],
                      ['Payout accounts', limitDisplay(plan.maxPayoutAccounts ?? 1)],
                      ['Campaign goal', plan.maxCampaignGoal === -1 ? 'Unlimited' : `GH₵ ${plan.maxCampaignGoal.toLocaleString()}`],
                    ].map(([label, value]) => (
                      <Box key={label}>
                        <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
                        <Typography component="dd" sx={{ m: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Included features</Typography>
                  {features.length === 0 && <Typography variant="body2" color="text.secondary">Core campaign tools</Typography>}
                  {features.map((feature) => (
                    <Box key={feature} sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mb: 0.75 }}>
                      <CheckCircleRoundedIcon color="success" sx={{ fontSize: 16 }} />
                      <Typography variant="body2">{feature}</Typography>
                    </Box>
                  ))}
                  {canUpdate ? (
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<EditRoundedIcon />}
                      onClick={() => openEdit(plan)}
                      sx={{ mt: 2.5, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                    >
                      Edit plan
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>Your role has view-only access.</Typography>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}

      {/* Edit dialog */}
      {!isLoading && <PaginationBar neumorphic pagination={pagination} />}
      <Dialog open={editing !== null} onClose={closeEdit} maxWidth="sm" fullWidth>
        {form && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>Edit {form.name} plan</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
              <TextField label="Name" fullWidth size="small" value={form.name} onChange={(e) => setField('name', e.target.value)} />
              <TextField label="Description" fullWidth size="small" multiline minRows={2} value={form.description} onChange={(e) => setField('description', e.target.value)} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Monthly price" type="number" fullWidth size="small"
                  value={form.priceMonthly}
                  onChange={(e) => setField('priceMonthly', Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">GH₵</InputAdornment> }}
                />
                <TextField
                  label="Yearly price" type="number" fullWidth size="small"
                  value={form.priceYearly}
                  onChange={(e) => setField('priceYearly', Number(e.target.value))}
                  InputProps={{ startAdornment: <InputAdornment position="start">GH₵</InputAdornment> }}
                />
              </Box>
              <TextField
                label="Platform fee" type="number" fullWidth size="small"
                value={form.platformFeePercent}
                onChange={(e) => setField('platformFeePercent', Number(e.target.value))}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                helperText="Between 0 and 100"
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {NUMERIC_LIMITS.map((limit) => (
                  <TextField
                    key={limit.key}
                    label={limit.label}
                    type="number"
                    size="small"
                    value={form[limit.key] as number}
                    onChange={(e) => setField(limit.key, Number(e.target.value) as SubscriptionPlan[typeof limit.key])}
                    helperText={limit.unlimited ? '-1 = unlimited' : undefined}
                  />
                ))}
              </Box>
              <Typography variant="overline" color="text.secondary">Benefits</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
                {FEATURE_TOGGLES.map((toggle) => (
                  <FormControlLabel
                    key={toggle.key}
                    control={
                      <Switch
                        checked={Boolean(form[toggle.key])}
                        onChange={(e) => setField(toggle.key, e.target.checked as SubscriptionPlan[typeof toggle.key])}
                      />
                    }
                    label={toggle.label}
                  />
                ))}
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closeEdit} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                startIcon={saving ? <LoadingDots size={6} /> : undefined}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Create dialog — add a brand-new tier */}
      <Dialog open={createForm !== null} onClose={closeCreate} maxWidth="sm" fullWidth>
        {createForm && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>Create new plan</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Tier id" fullWidth size="small" value={createForm.tier}
                  onChange={(e) => setCreateField('tier', e.target.value.trim().toLowerCase())}
                  helperText="Unique, lowercase (e.g. ngo, student)"
                />
                <TextField label="Name" fullWidth size="small" value={createForm.name} onChange={(e) => setCreateField('name', e.target.value)} />
              </Box>
              <TextField label="Description" fullWidth size="small" multiline minRows={2} value={createForm.description} onChange={(e) => setCreateField('description', e.target.value)} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Monthly price" type="number" fullWidth size="small" value={createForm.priceMonthly} onChange={(e) => setCreateField('priceMonthly', Number(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start">GH₵</InputAdornment> }} />
                <TextField label="Yearly price" type="number" fullWidth size="small" value={createForm.priceYearly} onChange={(e) => setCreateField('priceYearly', Number(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start">GH₵</InputAdornment> }} />
              </Box>
              <TextField label="Platform fee" type="number" fullWidth size="small" value={createForm.platformFeePercent} onChange={(e) => setCreateField('platformFeePercent', Number(e.target.value))} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} helperText="Between 0 and 100" />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {NUMERIC_LIMITS.map((limit) => (
                  <TextField
                    key={limit.key} label={limit.label} type="number" size="small"
                    value={createForm[limit.key] as number}
                    onChange={(e) => setCreateField(limit.key, Number(e.target.value) as SubscriptionPlan[typeof limit.key])}
                    helperText={limit.unlimited ? '-1 = unlimited' : undefined}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Sort order" type="number" size="small" fullWidth value={createForm.sortOrder} onChange={(e) => setCreateField('sortOrder', Number(e.target.value))} helperText="Lower = shown first" />
                <TextField label="Accent colour" size="small" fullWidth value={createForm.accentColor} onChange={(e) => setCreateField('accentColor', e.target.value)} helperText="#RRGGBB" />
              </Box>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <FormControlLabel control={<Switch checked={createForm.active} onChange={(e) => setCreateField('active', e.target.checked)} />} label="Active" />
                <FormControlLabel control={<Switch checked={createForm.isPublic} onChange={(e) => setCreateField('isPublic', e.target.checked)} />} label="Public" />
                <FormControlLabel control={<Switch checked={Boolean(createForm.popular)} onChange={(e) => setCreateField('popular', e.target.checked)} />} label="Popular" />
              </Box>
              <Typography variant="overline" color="text.secondary">Benefits</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
                {FEATURE_TOGGLES.map((toggle) => (
                  <FormControlLabel
                    key={toggle.key}
                    control={<Switch checked={Boolean(createForm[toggle.key])} onChange={(e) => setCreateField(toggle.key, e.target.checked as SubscriptionPlan[typeof toggle.key])} />}
                    label={toggle.label}
                  />
                ))}
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closeCreate} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={saving || !createForm.name.trim() || !createForm.tier.trim()}
                startIcon={saving ? <LoadingDots size={6} /> : undefined}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                {saving ? 'Creating…' : 'Create plan'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={Boolean(message)} autoHideDuration={message?.severity === 'error' ? null : 4000} onClose={() => setMessage(null)}>
        <Alert severity={message?.severity ?? 'success'} variant="filled" onClose={() => setMessage(null)}>{message?.text}</Alert>
      </Snackbar>
    </Box>
  )
}
