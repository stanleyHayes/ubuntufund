import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import { keyframes } from '@mui/material/styles'
import { SUBSCRIPTION_PLANS } from '@ubuntu-fund/types'
import type { SubscriptionPlan } from '@ubuntu-fund/types'
import { SHAPE } from '@ubuntu-fund/ui'
import PageHeader from '@/components/PageHeader'

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function ManagePlansPage() {
  const navigate = useNavigate()

  // Use the static plans as initial data (in production this would fetch from API)
  const [plans, setPlans] = useState<PlanWithMeta[]>(() =>
    Object.values(SUBSCRIPTION_PLANS).map((p, i) => ({ ...p, isActive: true, sortOrder: i, audience: 'both' as PlanAudience }))
  )
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  function handleToggle(tier: string) {
    setPlans(plans.map((p) => (p.tier === tier ? { ...p, isActive: !p.isActive } : p)))
    const plan = plans.find((p) => p.tier === tier)
    setSnack({ open: true, message: `${plan?.name} ${plan?.isActive ? 'deactivated' : 'activated'}`, severity: 'success' })
  }

  function handleDelete(tier: string) {
    setPlans(plans.filter((p) => p.tier !== tier))
    setDeleteConfirm(null)
    setSnack({ open: true, message: 'Plan deleted', severity: 'success' })
  }

  return (
    <Box>
      <Box sx={{ animation: `${fadeSlide} 0.3s ease both` }}>
        <PageHeader
          tone="green"
          eyebrow="Platform"
          title="Subscription Plans"
          lede="Create and manage subscription packages with enforceable limits."
          icon={<LayersRoundedIcon />}
          actions={
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => navigate('/plans/new')}
              sx={{ borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 700, px: 3 }}
            >
              Create Plan
            </Button>
          }
        />
      </Box>

      {/* Plans Grid */}
      <Grid container spacing={2.5}>
        {plans.sort((a, b) => a.sortOrder - b.sortOrder).map((plan, i) => {
          const color = TIER_COLORS[plan.tier] ?? '#78909C'
          return (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={plan.tier}>
              <Card
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: plan.isActive ? 'divider' : 'rgba(192,107,88,0.2)',
                  borderRadius: SHAPE.card,
                  position: 'relative',
                  opacity: plan.isActive ? 1 : 0.6,
                  animation: `${fadeSlide} 0.35s ease ${i * 0.06}s both`,
                  transition: 'border-color 200ms ease, box-shadow 200ms ease',
                  '&:hover': { borderColor: `${color}60`, boxShadow: `0 2px 8px ${color}20` },
                }}
              >
                {/* Status chip */}
                {!plan.isActive && (
                  <Chip label="Inactive" size="small" sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'rgba(192,107,88,0.15)', color: '#C06B58', fontWeight: 700, fontSize: '0.65rem' }} />
                )}

                <CardContent sx={{ p: 3 }}>
                  {/* Tier badge */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: SHAPE.sm, bgcolor: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <StarRoundedIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', lineHeight: 1.2 }}>{plan.name}</Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>{plan.tier}</Typography>
                    </Box>
                  </Box>

                  {/* Audience badge */}
                  <Chip
                    size="small"
                    icon={plan.audience === 'individual' ? <PersonRoundedIcon sx={{ fontSize: '14px !important' }} /> : plan.audience === 'organization' ? <BusinessRoundedIcon sx={{ fontSize: '14px !important' }} /> : <GroupsRoundedIcon sx={{ fontSize: '14px !important' }} />}
                    label={plan.audience === 'both' ? 'Everyone' : plan.audience === 'individual' ? 'Individuals' : 'Organizations'}
                    sx={{ mb: 2, fontSize: '0.65rem', fontWeight: 700, bgcolor: `${color}15`, color, border: '1px solid', borderColor: `${color}30`, '& .MuiChip-icon': { color: 'inherit' } }}
                  />

                  {/* Price */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: '1.8rem', color }}>
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

                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2, lineHeight: 1.5, minHeight: 36 }}>
                    {plan.description}
                  </Typography>

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
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
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

                  <Divider sx={{ mb: 2, borderColor: 'divider' }} />

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Edit plan">
                      <IconButton size="small" onClick={() => navigate('/plans/' + plan.tier + '/edit')} sx={{ color: 'primary.main', border: '1px solid', borderColor: 'divider', borderRadius: SHAPE.sm }}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={plan.isActive ? 'Deactivate' : 'Activate'}>
                      <IconButton size="small" onClick={() => handleToggle(plan.tier)} sx={{ color: plan.isActive ? 'warning.main' : 'success.main', border: '1px solid', borderColor: 'divider', borderRadius: SHAPE.sm }}>
                        {plan.isActive ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete plan">
                      <IconButton size="small" onClick={() => setDeleteConfirm(plan.tier)} sx={{ color: 'error.main', border: '1px solid', borderColor: 'divider', borderRadius: SHAPE.sm }}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* ═══ Delete Confirmation ═══ */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: SHAPE.card } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete Plan?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            This will permanently remove the "{plans.find((p) => p.tier === deleteConfirm)?.name}" plan. Existing subscribers on this plan will need to be migrated first.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => handleDelete(deleteConfirm!)} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm }}>
            Delete Plan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled" sx={{ borderRadius: SHAPE.sm, fontWeight: 600 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
