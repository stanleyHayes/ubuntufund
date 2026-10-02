import ExportMenu from '@/components/ExportMenu'
import { exportTable } from '@/lib/exports/report'
import { usePagination } from '@/hooks/usePagination'
import PaginationBar from '@/components/PaginationBar'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { ApiError } from '@/lib/apiError'
import { formatPlanPrice, toPesewas } from '@/lib/money'
import {
  comparePlans,
  cyclePrice,
  isFreePlan,
  isSalesOnly,
  MAX_PLAN_PRICE,
  onBehalfBlocked,
  ON_BEHALF_BLOCKED,
  priceInvalid,
  pricingChanges,
  SALES_ONLY_HINT,
  sortOrderTie,
  withFeature,
  yearlyNote,
  type PricingChange,
} from '@/lib/plans'
import { useAdminPlans } from '@/hooks/useApiData'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import PageHeader from '@/components/PageHeader'

// The first four flags have no implementation yet: members never see them on
// any plan page, and turning them on grants nothing. The labels say so.
const FEATURE_TOGGLES: { key: keyof SubscriptionPlan; label: string }[] = [
  { key: 'featuredListing', label: 'Featured listing (not built — hidden from members)' },
  { key: 'prioritySupport', label: 'Priority support (not built — hidden from members)' },
  { key: 'advancedAnalytics', label: 'Advanced analytics (not built — hidden from members)' },
  { key: 'customBranding', label: 'Custom branding (not built — hidden from members)' },
  { key: 'escrowSupport', label: 'Split proceeds' },
  { key: 'liveStreaming', label: 'Live streaming' },
  { key: 'campaignCollaboration', label: 'Campaign collaboration' },
  { key: 'onBehalfCampaigns', label: 'Campaigns on behalf of others' },
]

/** Plan prices only drive web (Paystack) checkout; store prices live on the store products. */
const WEB_PRICE_HELP = 'Web checkout price. Update store products separately.'

/** The prices the API accepts: checkout charges whole pesewas, so more decimals would differ from the amount charged. */
const PRICE_RANGE = `0 to ${MAX_PLAN_PRICE.toLocaleString('en-GH')}, with at most two decimal places`
const PRICE_ERROR = `Use ${PRICE_RANGE}.`

const PLATFORM_FEE_HELP = 'Between 0 and 100. Locked onto each campaign when it is created (existing campaigns keep their rate); creator-page withdrawals use the current rate.'

const NUMERIC_LIMITS: { key: keyof SubscriptionPlan; label: string; unlimited?: boolean; help?: string; error?: (plan: SubscriptionPlan) => string | null }[] = [
  { key: 'maxActiveCampaigns', label: 'Max active campaigns', unlimited: true },
  { key: 'maxCampaignGoal', label: 'Max campaign goal (GH₵)', unlimited: true },
  { key: 'maxMediaPerCampaign', label: 'Max media per campaign', unlimited: true },
  { key: 'maxTeamMembers', label: 'Organization team seats (incl. owner)', unlimited: true },
  { key: 'maxPayoutAccounts', label: 'Saved payout accounts', unlimited: true },
  { key: 'maxCollaboratorsPerCampaign', label: 'Max collaborators per campaign', unlimited: true },
  {
    key: 'maxOnBehalfCampaigns',
    label: 'Active campaigns on behalf of others',
    unlimited: true,
    help: '-1 = unlimited. They also count toward max active campaigns.',
    error: onBehalfLimitError,
  },
]

const LIMIT_ERROR = 'Use a whole number, or -1 for unlimited.'

const FEE_HELP = 'Between 0 and 100. Added to the platform fee and locked onto each campaign on behalf of others when it is created.'

function onBehalfLimitInvalid(plan: SubscriptionPlan): boolean {
  return !Number.isInteger(plan.maxOnBehalfCampaigns) || plan.maxOnBehalfCampaigns < -1
}

/** The inline error under the on-behalf limit, or null. */
function onBehalfLimitError(plan: SubscriptionPlan): string | null {
  if (onBehalfLimitInvalid(plan)) return LIMIT_ERROR
  if (onBehalfBlocked(plan)) return `${ON_BEHALF_BLOCKED}.`
  return null
}

function onBehalfFeeInvalid(plan: SubscriptionPlan): boolean {
  return !Number.isFinite(plan.onBehalfFeePercent) || plan.onBehalfFeePercent < 0 || plan.onBehalfFeePercent > 100
}

/** Why the on-behalf fields cannot be saved (the API's plan schema), or null. */
function onBehalfError(plan: SubscriptionPlan): string | null {
  if (onBehalfLimitInvalid(plan)) return 'Active campaigns on behalf of others must be a whole number, or -1 for unlimited.'
  if (onBehalfBlocked(plan)) return `${ON_BEHALF_BLOCKED}. Set a limit, -1 for unlimited, or switch it off.`
  if (onBehalfFeeInvalid(plan)) return 'The extra fee on campaigns on behalf of others must be between 0 and 100%.'
  return null
}

/** Why either plan dialog cannot save, or null. */
function planError(plan: SubscriptionPlan): string | null {
  if (priceInvalid(plan.priceMonthly) || priceInvalid(plan.priceYearly)) return `Prices must be ${PRICE_RANGE}.`
  if (yearlyNote(plan)?.exceeds) {
    return `The yearly price is more than 12 × the monthly price (${formatPlanPrice((12 * toPesewas(plan.priceMonthly)) / 100)}). Lower it, or set it to 0 if the plan is not sold yearly.`
  }
  return onBehalfError(plan)
}

type PriceKey = 'priceMonthly' | 'priceYearly'

/** Monthly and yearly prices, with the yearly price's monthly equivalent, in both plan dialogs. */
function PriceFields({ plan, onChange }: { plan: SubscriptionPlan; onChange: (key: PriceKey, value: number) => void }) {
  const yearly = yearlyNote(plan)
  const field = (key: PriceKey, label: string, help: ReactNode, error = false) => (
    <TextField
      label={label} type="number" fullWidth size="small"
      value={plan[key]}
      onChange={(e) => onChange(key, Number(e.target.value))}
      error={priceInvalid(plan[key]) || error}
      InputProps={{ startAdornment: <InputAdornment position="start">GH₵</InputAdornment> }}
      inputProps={{ min: 0, max: MAX_PLAN_PRICE, step: 0.01 }}
      helperText={priceInvalid(plan[key]) ? PRICE_ERROR : help}
    />
  )
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
      {field('priceMonthly', 'Monthly price', WEB_PRICE_HELP)}
      {field('priceYearly', 'Yearly price', yearly ? (
        <>
          {/* At or above 12 × monthly, yearly saves nothing: a warning, and an error once it costs more. */}
          <Box component="span" sx={{ display: 'block', ...(yearly.warning && !yearly.exceeds && { color: 'var(--text-warning)', fontWeight: 600 }) }}>{yearly.text}</Box>
          {WEB_PRICE_HELP}
        </>
      ) : WEB_PRICE_HELP, yearly?.exceeds)}
    </Box>
  )
}

/** Shown beside the on-behalf limit in both plan dialogs. */
function OnBehalfFeeField({ plan, onChange }: { plan: SubscriptionPlan; onChange: (value: number) => void }) {
  const invalid = onBehalfFeeInvalid(plan)
  return (
    <TextField
      label="Extra fee on those campaigns"
      type="number"
      size="small"
      value={plan.onBehalfFeePercent}
      onChange={(e) => onChange(Number(e.target.value))}
      error={invalid}
      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
      inputProps={{ min: 0, max: 100, step: 'any' }}
      helperText={invalid ? 'Enter a percentage between 0 and 100.' : FEE_HELP}
    />
  )
}

/** Sort order in both plan dialogs, warning when another plan already uses it. */
function SortOrderField({ value, tie, onChange }: { value: number; tie: string | null; onChange: (value: number) => void }) {
  return (
    <TextField
      label="Sort order" type="number" size="small" fullWidth
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      helperText={tie ? (
        <>
          {/* A tie is ordered by price, not by the admin: a warning, since the order may still be intended. */}
          <Box component="span" sx={{ display: 'block', color: 'var(--text-warning)', fontWeight: 600 }}>{tie}</Box>
          Lower = shown first
        </>
      ) : 'Lower = shown first'}
    />
  )
}

/** Field labels for the API's validation errors, which name fields by key. */
const FIELD_LABELS: Record<string, string> = {
  tier: 'Tier id', name: 'Name', description: 'Description', priceMonthly: 'Monthly price', priceYearly: 'Yearly price',
  platformFeePercent: 'Platform fee', onBehalfFeePercent: 'Extra fee on those campaigns', sortOrder: 'Sort order', accentColor: 'Accent colour',
  ...Object.fromEntries(NUMERIC_LIMITS.map((limit) => [limit.key, limit.label])),
}

/** A failed save's message, with each field the API refused ('Validation failed' alone names none). */
function saveErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  const fields = error instanceof ApiError ? Object.entries(error.errors ?? {}) : []
  const details = fields.flatMap(([field, messages]) =>
    messages.filter((message) => message !== error.message).map((message) => `${FIELD_LABELS[field] ?? field}: ${message}`))
  if (details.length === 0) return error.message
  return [error.message, ...details].map((text) => (/[.!?]$/.test(text) ? text : `${text}.`)).join(' ')
}

/** The editable subset sent to `PUT /plans/:tier` (tier is immutable). */
function toPatch(plan: SubscriptionPlan): UpdateSubscriptionPlanInput {
  const { tier: _tier, ...rest } = plan
  return rest
}

function limitDisplay(value: number): string {
  return value === -1 ? 'Unlimited' : value.toLocaleString()
}

/** The card headline: 'Free', 'GH₵ 9.99/mo', or 'Monthly not offered' on a yearly-only paid plan. */
function monthlyHeadline(plan: SubscriptionPlan): string {
  if (isFreePlan(plan)) return 'Free'
  return plan.priceMonthly > 0 ? `${formatPlanPrice(plan.priceMonthly)}/mo` : 'Monthly not offered'
}

/** The card's yearly row: the yearly price, its monthly equivalent and how it compares with 12 × monthly. */
function yearlyPrice(plan: SubscriptionPlan): ReactNode {
  const note = yearlyNote(plan)
  if (!note) return cyclePrice(plan.priceYearly, plan)
  return (
    <>
      {formatPlanPrice(plan.priceYearly)}/yr
      <Box component="span" sx={{ fontWeight: 400, color: note.warning ? 'var(--text-warning)' : 'text.secondary' }}> · {note.text}</Box>
    </>
  )
}

/** A blank plan for the "new tier" form; admins fill in the tier id + details. */
function blankPlan(nextSortOrder: number): SubscriptionPlan {
  return {
    tier: '', name: '', description: '',
    priceMonthly: 0, priceYearly: 0, platformFeePercent: 5,
    maxActiveCampaigns: 1, maxCampaignGoal: 10000,
    featuredListing: false, prioritySupport: false, advancedAnalytics: false,
    customBranding: false, maxMediaPerCampaign: 3, escrowSupport: false,
    liveStreaming: false, maxTeamMembers: 1, campaignCollaboration: false,
    maxCollaboratorsPerCampaign: 0,
    maxPayoutAccounts: 1,
    onBehalfCampaigns: false, maxOnBehalfCampaigns: 0, onBehalfFeePercent: 0,
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
  /** Price and fee changes awaiting confirmation before the PUT. */
  const [confirming, setConfirming] = useState<PricingChange[] | null>(null)

  useEffect(() => { setPlans(data) }, [data])

  const ordered = useMemo(
    // Admin-set order (sortOrder), so admin-ADDED tiers slot in wherever configured.
    () => [...plans].sort(comparePlans),
    [plans],
  )
  const pagination = usePagination(ordered, 12)
  const paidCount = useMemo(() => plans.filter((plan) => !isFreePlan(plan)).length, [plans])
  const formYearly = form ? yearlyNote(form) : null

  function openEdit(plan: SubscriptionPlan) {
    if (!canUpdate) return
    setEditing(plan)
    setForm({ ...plan })
  }

  function closeEdit() {
    if (saving) return
    setConfirming(null)
    setEditing(null)
    setForm(null)
  }

  function setField<K extends keyof SubscriptionPlan>(key: K, value: SubscriptionPlan[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  function setFeature(key: keyof SubscriptionPlan, on: boolean) {
    setForm((current) => (current ? withFeature(current, key, on) : current))
  }

  async function handleSave() {
    if (!form || !editing) return
    const invalid = planError(form)
    if (invalid) {
      setMessage({ text: invalid, severity: 'error' })
      return
    }
    // One mistyped digit changes a live price, so every price and fee change is confirmed first.
    const changes = pricingChanges(editing, form)
    if (changes.length > 0) {
      setConfirming(changes)
      return
    }
    await saveEdit()
  }

  async function saveEdit() {
    if (!form) return
    setSaving(true)
    try {
      const updated = await api.put<SubscriptionPlan>(`/plans/${form.tier}`, toPatch(form))
      setPlans((current) => current.map((plan) => (plan.tier === updated.tier ? updated : plan)))
      setMessage({ text: `${updated.name} plan updated.`, severity: 'success' })
      setConfirming(null)
      setEditing(null)
      setForm(null)
    } catch (saveError) {
      setConfirming(null)
      setMessage({ text: saveErrorText(saveError, 'Unable to update the plan.'), severity: 'error' })
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

  function setCreateFeature(key: keyof SubscriptionPlan, on: boolean) {
    setCreateForm((current) => (current ? withFeature(current, key, on) : current))
  }

  async function handleCreate() {
    if (!createForm) return
    if (!isValidTierId(createForm.tier)) {
      setMessage({ text: 'Tier id must be lowercase letters/digits/-/_ (min 2 chars).', severity: 'error' })
      return
    }
    const invalid = planError(createForm)
    if (invalid) {
      setMessage({ text: invalid, severity: 'error' })
      return
    }
    setSaving(true)
    try {
      const created = await api.post<SubscriptionPlan>('/plans', createForm)
      setPlans((current) => [...current, created])
      setMessage({ text: `${created.name} plan created.`, severity: 'success' })
      setCreateForm(null)
    } catch (createError) {
      setMessage({ text: saveErrorText(createError, 'Unable to create the plan.'), severity: 'error' })
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
      actions={<ExportMenu title="Subscription plans" disabled={isLoading || !!error} getReport={() => ({ title: "Subscription plans", filters: ['Published configuration'], tables: [exportTable("Subscription plans", ordered, { Tier: r => r.tier, Name: r => r.name, 'Monthly (GHS)': r => r.priceMonthly, 'Yearly (GHS)': r => r.priceYearly, 'Platform fee (%)': r => r.platformFeePercent, 'Active campaigns': r => r.maxActiveCampaigns, 'Maximum goal (GHS)': r => r.maxCampaignGoal, 'Campaigns on behalf of others': r => r.onBehalfCampaigns, 'On-behalf active limit': r => r.maxOnBehalfCampaigns, 'On-behalf extra fee (%)': r => r.onBehalfFeePercent, Description: r => r.description })] })} />}
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
        Prices, limits and tiers are stored in the database. Prices here apply to web checkout (Paystack) only: iOS
        and Android subscribers pay the price set on each App Store and Google Play product, so changing a price here
        does not change store prices. After a price change, update the matching products in App Store Connect and
        Google Play Console (mapped by the server&apos;s STORE_BILLING_PRODUCTS). A price of 0 on a paid plan means that
        billing cycle is not offered. Admins can add new tiers and reorder them. The code-defined defaults only add
        built-in tiers that are missing; they never change a plan that already exists, whether or not it was edited
        here. Use -1 for an unlimited numeric limit.
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
            const free = isFreePlan(plan)
            const salesOnly = isSalesOnly(plan)
            const details: [string, ReactNode][] = [
              ['Yearly price', yearlyPrice(plan)],
              ['Platform fee', `${plan.platformFeePercent}%`],
              ['Active campaigns', limitDisplay(plan.maxActiveCampaigns)],
              ['Payout accounts', limitDisplay(plan.maxPayoutAccounts ?? 1)],
              ['Campaign goal', plan.maxCampaignGoal === -1 ? 'Unlimited' : formatPlanPrice(plan.maxCampaignGoal)],
              ...(plan.onBehalfCampaigns
                ? [['On behalf of others', `${limitDisplay(plan.maxOnBehalfCampaigns)} active · +${plan.onBehalfFeePercent}% fee`] as [string, ReactNode]]
                : []),
            ]
            return (
              <Card key={plan.tier} sx={{ ...raisedSurface, height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{plan.name}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {salesOnly && <Chip label="Sales only" size="small" sx={{ color: 'var(--text-info)' }} />}
                      <Chip label={free ? 'Free' : 'Paid'} size="small" sx={free ? undefined : { color: 'var(--text-success)' }} />
                    </Box>
                  </Box>
                  <Typography color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>{plan.description}</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: salesOnly ? 0.5 : 2 }}>
                    {monthlyHeadline(plan)}
                  </Typography>
                  {salesOnly && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{SALES_ONLY_HINT}.</Typography>}
                  <Box component="dl" sx={{ ...insetSurface, m: 0, p: 2, mb: 3, display: 'grid', gap: 2 }}>
                    {details.map(([label, value]) => (
                      <Box key={label}>
                        <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
                        <Typography component="dd" sx={{ m: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
                      </Box>
                    ))}
                  </Box>
                  {onBehalfBlocked(plan) && <Alert severity="warning" sx={{ mb: 3 }}>{ON_BEHALF_BLOCKED}.</Alert>}
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
              <PriceFields plan={form} onChange={setField} />
              <TextField
                label="Platform fee" type="number" fullWidth size="small"
                value={form.platformFeePercent}
                onChange={(e) => setField('platformFeePercent', Number(e.target.value))}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                helperText={PLATFORM_FEE_HELP}
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
                    error={Boolean(limit.error?.(form))}
                    helperText={limit.error?.(form) ?? limit.help ?? (limit.unlimited ? '-1 = unlimited' : undefined)}
                  />
                ))}
                <OnBehalfFeeField plan={form} onChange={(value) => setField('onBehalfFeePercent', value)} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <SortOrderField value={form.sortOrder} tie={sortOrderTie(plans, form.sortOrder, form.tier)} onChange={(value) => setField('sortOrder', value)} />
                <TextField label="Accent colour" size="small" fullWidth value={form.accentColor} onChange={(e) => setField('accentColor', e.target.value)} helperText="#RRGGBB" />
              </Box>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <FormControlLabel control={<Switch checked={form.active ?? true} onChange={(e) => setField('active', e.target.checked)} />} label="Active" />
                <FormControlLabel control={<Switch checked={form.isPublic ?? true} onChange={(e) => setField('isPublic', e.target.checked)} />} label="Public" />
                <FormControlLabel control={<Switch checked={Boolean(form.popular)} onChange={(e) => setField('popular', e.target.checked)} />} label="Popular" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Turning off Active or Public hides this plan from new purchases on the website and in the app store catalog. Existing subscribers are not cancelled and keep all of the plan's benefits, including creator donations, until their period ends.
              </Typography>
              <Typography variant="overline" color="text.secondary">Benefits</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
                {FEATURE_TOGGLES.map((toggle) => (
                  <FormControlLabel
                    key={toggle.key}
                    control={
                      <Switch
                        checked={Boolean(form[toggle.key])}
                        onChange={(e) => setFeature(toggle.key, e.target.checked)}
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

      {/* Confirm step: every changed price and fee, old → new, before the PUT */}
      <Dialog open={confirming !== null} onClose={() => !saving && setConfirming(null)} maxWidth="xs" fullWidth aria-labelledby="confirm-plan-pricing-title">
        {confirming && form && (
          <>
            <DialogTitle id="confirm-plan-pricing-title" sx={{ fontWeight: 800 }}>Confirm {form.name} pricing</DialogTitle>
            <DialogContent>
              <Box component="dl" sx={{ ...insetSurface, border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)', WebkitBackdropFilter: 'var(--neu-backdrop)', m: 0, p: 2, display: 'grid', gap: 1.5 }}>
                {confirming.map((change) => (
                  <Box key={change.label}>
                    <Typography component="dt" variant="caption" color="text.secondary">{change.label}</Typography>
                    <Typography component="dd" sx={{ m: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {change.from} → {change.to}{change.change && ` (${change.change})`}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {formYearly?.warning && <Alert severity="warning" sx={{ mt: 2 }}>Yearly: {formYearly.text}.</Alert>}
              {confirming.some((change) => change.kind === 'price') && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  New prices apply to new web checkouts only. App Store and Google Play prices do not change.
                </Typography>
              )}
              {confirming.some((change) => change.kind === 'fee') && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  A new fee is locked onto campaigns created from now on; existing campaigns keep their rate. Creator-page withdrawals use the current platform fee straight away.
                </Typography>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirming(null)} disabled={saving} sx={{ textTransform: 'none' }}>Back</Button>
              <Button
                variant="contained"
                onClick={() => void saveEdit()}
                disabled={saving}
                startIcon={saving ? <LoadingDots size={6} /> : undefined}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {saving ? 'Saving…' : 'Confirm and save'}
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
              <PriceFields plan={createForm} onChange={setCreateField} />
              <TextField label="Platform fee" type="number" fullWidth size="small" value={createForm.platformFeePercent} onChange={(e) => setCreateField('platformFeePercent', Number(e.target.value))} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} helperText={PLATFORM_FEE_HELP} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {NUMERIC_LIMITS.map((limit) => (
                  <TextField
                    key={limit.key} label={limit.label} type="number" size="small"
                    value={createForm[limit.key] as number}
                    onChange={(e) => setCreateField(limit.key, Number(e.target.value) as SubscriptionPlan[typeof limit.key])}
                    error={Boolean(limit.error?.(createForm))}
                    helperText={limit.error?.(createForm) ?? limit.help ?? (limit.unlimited ? '-1 = unlimited' : undefined)}
                  />
                ))}
                <OnBehalfFeeField plan={createForm} onChange={(value) => setCreateField('onBehalfFeePercent', value)} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <SortOrderField value={createForm.sortOrder} tie={sortOrderTie(plans, createForm.sortOrder)} onChange={(value) => setCreateField('sortOrder', value)} />
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
                    control={<Switch checked={Boolean(createForm[toggle.key])} onChange={(e) => setCreateFeature(toggle.key, e.target.checked)} />}
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
