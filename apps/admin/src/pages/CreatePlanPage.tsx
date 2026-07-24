import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Switch from '@mui/material/Switch'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { keyframes } from '@mui/material/styles'
import { SubscriptionTier, type SubscriptionPlan } from '@ubuntu-fund/types'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Types ───────────────────────────────────────────────────────────────────

type PlanAudience = 'individual' | 'organization' | 'both'

interface PlanWithMeta extends SubscriptionPlan {
  isActive: boolean
  sortOrder: number
  audience: PlanAudience
}

const TIER_COLORS: Record<string, string> = {
  free: '#78909C',
  starter: '#74909A',
  pro: '#AB47BC',
  enterprise: '#C7A24A',
  custom: '#00BCD4',
}

const BOOLEAN_FEATURES: { key: keyof SubscriptionPlan; label: string }[] = [
  { key: 'featuredListing', label: 'Featured Listing' },
  { key: 'prioritySupport', label: 'Priority Support' },
  { key: 'advancedAnalytics', label: 'Advanced Analytics' },
  { key: 'customBranding', label: 'Custom Branding' },
  { key: 'escrowSupport', label: 'Escrow Support' },
  { key: 'liveStreaming', label: 'Live Streaming' },
]

// ─── Default empty plan ──────────────────────────────────────────────────────

function emptyPlan(): PlanWithMeta {
  return {
    tier: '' as SubscriptionTier,
    name: '',
    description: '',
    priceMonthly: 0,
    priceYearly: 0,
    platformFeePercent: 5,
    maxActiveCampaigns: 1,
    maxCampaignGoal: 5000,
    featuredListing: false,
    prioritySupport: false,
    advancedAnalytics: false,
    customBranding: false,
    maxMediaPerCampaign: 3,
    escrowSupport: false,
    liveStreaming: false,
    maxTeamMembers: 1,
    campaignCollaboration: false,
    maxCollaboratorsPerCampaign: 0,
    isActive: true,
    sortOrder: 0,
    audience: 'both' as PlanAudience,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CreatePlanPage() {
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PlanWithMeta>(emptyPlan())
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  function updateField(key: string, value: unknown) {
    setPlan((prev) => ({ ...prev, [key]: value }))
  }

  function handleCreate() {
    if (!plan.tier || !plan.name) {
      setSnack({ open: true, message: 'Tier key and name are required', severity: 'error' })
      return
    }
    // In production this would POST to the API
    setSnack({ open: true, message: `Plan "${plan.name}" created`, severity: 'success' })
    setTimeout(() => navigate('/plans'), 1500)
  }

  const tierColor = TIER_COLORS[plan.tier] ?? '#78909C'
  const enabledFeatureCount = BOOLEAN_FEATURES.filter((f) => plan[f.key] as boolean).length

  return (
    <Box sx={{ animation: `${fadeSlide} 0.3s ease both` }}>
      {/* Breadcrumb */}
      <Breadcrumbs separator={<NavigateNextRoundedIcon sx={{ fontSize: 16 }} />} sx={{ mb: 3 }}>
        <Typography
          component={RouterLink}
          to="/plans"
          sx={{ fontSize: '0.85rem', color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
        >
          Plans
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.primary', fontWeight: 700 }}>Create New Plan</Typography>
      </Breadcrumbs>

      {/* Title */}
      <Typography variant="h5" sx={{ fontWeight: 900, color: 'text.primary', mb: 3 }}>
        Create New Plan
      </Typography>

      <Grid container spacing={3}>
        {/* ═══ Left Column — Form ═══ */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              {/* ── Basic Info ── */}
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'text.primary', mb: 2 }}>Basic Info</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Tier Key"
                    value={plan.tier}
                    onChange={(e) => updateField('tier', e.target.value)}
                    fullWidth
                    size="small"
                    select
                    helperText="Unique key (e.g. pro, starter)"
                  >
                    {['free', 'starter', 'pro', 'enterprise', 'custom'].map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Display Name" value={plan.name} onChange={(e) => updateField('name', e.target.value)} fullWidth size="small" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Description" value={plan.description} onChange={(e) => updateField('description', e.target.value)} fullWidth size="small" multiline rows={2} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Target Audience"
                    value={plan.audience}
                    onChange={(e) => updateField('audience', e.target.value)}
                    select
                    fullWidth
                    size="small"
                    helperText="Who can subscribe to this plan"
                  >
                    <MenuItem value="both">Everyone (Individuals & Organizations)</MenuItem>
                    <MenuItem value="individual">Individuals Only</MenuItem>
                    <MenuItem value="organization">Organizations Only</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }}><Chip label="Pricing" size="small" sx={{ fontWeight: 700 }} /></Divider>

              {/* ── Pricing ── */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Monthly Price"
                    type="number"
                    value={plan.priceMonthly}
                    onChange={(e) => updateField('priceMonthly', parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="USD"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Yearly Price"
                    type="number"
                    value={plan.priceYearly}
                    onChange={(e) => updateField('priceYearly', parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="USD"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Platform Fee %"
                    type="number"
                    value={plan.platformFeePercent}
                    onChange={(e) => updateField('platformFeePercent', parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="%"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }}><Chip label="Limits" size="small" sx={{ fontWeight: 700 }} /></Divider>

              {/* ── Limits ── */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Max Campaigns"
                    type="number"
                    value={plan.maxActiveCampaigns}
                    onChange={(e) => updateField('maxActiveCampaigns', parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="-1 = unlimited"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Max Goal"
                    type="number"
                    value={plan.maxCampaignGoal}
                    onChange={(e) => updateField('maxCampaignGoal', parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="-1 = unlimited"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Max Media"
                    type="number"
                    value={plan.maxMediaPerCampaign}
                    onChange={(e) => updateField('maxMediaPerCampaign', parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="-1 = unlimited"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Max Team Members"
                    type="number"
                    value={plan.maxTeamMembers}
                    onChange={(e) => updateField('maxTeamMembers', parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    helperText="-1 = unlimited"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }}><Chip label="Features (Enforceable)" size="small" sx={{ fontWeight: 700 }} /></Divider>

              {/* ── Features ── */}
              <Grid container spacing={2}>
                {BOOLEAN_FEATURES.map((feat) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={feat.key}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{feat.label}</Typography>
                      <Switch
                        checked={plan[feat.key] as boolean}
                        onChange={(_, v) => updateField(feat.key, v)}
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#5E8F72' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#5E8F72' } }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 3 }}><Chip label="Visibility" size="small" sx={{ fontWeight: 700 }} /></Divider>

              {/* ── Visibility ── */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Active (Visible to Users)</Typography>
                    <Switch
                      checked={plan.isActive}
                      onChange={(_, v) => updateField('isActive', v)}
                      sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#5E8F72' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#5E8F72' } }}
                    />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Sort Order" type="number" value={plan.sortOrder} onChange={(e) => updateField('sortOrder', parseInt(e.target.value) || 0)} fullWidth size="small" helperText="Lower = shown first" />
                </Grid>
              </Grid>

              {/* ── Actions ── */}
              <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'flex-end' }}>
                <Button
                  component={RouterLink}
                  to="/plans"
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveRoundedIcon />}
                  onClick={handleCreate}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3 }}
                >
                  Create Plan
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ═══ Right Column — Live Preview ═══ */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ position: 'sticky', top: 24 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Live Preview
            </Typography>
            <Card
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: plan.tier ? `${tierColor}40` : 'divider',
                borderRadius: 3,
                transition: 'all 0.3s ease',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                {/* Tier badge */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: `${tierColor}15`, color: tierColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <StarRoundedIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', lineHeight: 1.2 }}>
                      {plan.name || 'Plan Name'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {plan.tier || 'tier'}
                    </Typography>
                  </Box>
                </Box>

                {/* Price */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.8rem', color: tierColor }}>
                      {plan.priceMonthly === 0 ? 'Free' : `$${plan.priceMonthly}`}
                    </Typography>
                    {plan.priceMonthly > 0 && (
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>/mo</Typography>
                    )}
                  </Box>
                  {plan.priceYearly > 0 && (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>${plan.priceYearly}/yr</Typography>
                  )}
                </Box>

                {plan.description && (
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2, lineHeight: 1.5 }}>
                    {plan.description}
                  </Typography>
                )}

                <Divider sx={{ my: 2, borderColor: 'divider' }} />

                {/* Limits summary */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 2 }}>
                  {[
                    { label: 'Campaigns', value: plan.maxActiveCampaigns === -1 ? 'Unlimited' : String(plan.maxActiveCampaigns) },
                    { label: 'Goal Limit', value: plan.maxCampaignGoal === -1 ? 'Unlimited' : `$${plan.maxCampaignGoal.toLocaleString()}` },
                    { label: 'Platform Fee', value: `${plan.platformFeePercent}%` },
                    { label: 'Team Members', value: plan.maxTeamMembers === -1 ? 'Unlimited' : String(plan.maxTeamMembers) },
                  ].map((row) => (
                    <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{row.label}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary' }}>{row.value}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Feature chips */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {BOOLEAN_FEATURES.map((feat) => {
                    const enabled = plan[feat.key] as boolean
                    return (
                      <Chip
                        key={feat.key}
                        label={feat.label}
                        size="small"
                        icon={enabled ? <CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} /> : <CancelRoundedIcon sx={{ fontSize: '14px !important' }} />}
                        sx={{
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          bgcolor: enabled ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.04)',
                          color: enabled ? '#5E8F72' : 'text.secondary',
                          borderColor: enabled ? 'rgba(76,175,80,0.2)' : 'transparent',
                          border: '1px solid',
                          '& .MuiChip-icon': { color: 'inherit' },
                        }}
                      />
                    )
                  })}
                </Box>

                <Divider sx={{ my: 2, borderColor: 'divider' }} />

                {/* Summary line */}
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center' }}>
                  {enabledFeatureCount} feature{enabledFeatureCount !== 1 ? 's' : ''} enabled
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ borderRadius: 2, fontWeight: 600 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
