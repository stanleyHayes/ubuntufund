import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import CircularProgress from '@mui/material/CircularProgress'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { Link as RouterLink } from 'react-router-dom'
import {
  OrganizationType,
  SubscriptionTier,
  BillingCycle,
} from '@ubuntu-fund/types'
import { SHAPE, formatCurrency } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import { usePlanMap } from '@/hooks/useSubscription'
import {
  createSubscriptionCheckout,
  saveSubscriptionCheckoutHandoff,
  isPaymentsNotConfigured,
} from '@/lib/subscriptions'

const FOREST = 'primary.main'
const GOLD = '#C7A24A'
const GOLD_DARK = 'var(--text-warning)'
const INK_SECONDARY = 'text.secondary'

type AccountType = 'individual' | 'organization'

const ORG_TYPE_LABELS: Record<OrganizationType, string> = {
  [OrganizationType.NGO]: 'NGO / Non-profit',
  [OrganizationType.HOSPITAL]: 'Hospital / Health',
  [OrganizationType.SCHOOL]: 'School / Education',
  [OrganizationType.RELIGIOUS]: 'Religious body',
  [OrganizationType.GOVERNMENT]: 'Government / Public',
  [OrganizationType.OTHER]: 'Other',
}

const STEPS = ['Account', 'Details', 'Plan'] as const

const PAID_TIERS = [SubscriptionTier.STARTER, SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE]
const ALL_TIERS = [SubscriptionTier.FREE, ...PAID_TIERS]

interface FieldErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  organizationName?: string
  organizationType?: string
  website?: string
}

function Stepper({ current }: { current: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <Box key={label} aria-current={active ? 'step' : undefined} sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: i < STEPS.length - 1 ? 1 : '0 0 auto' }}>
            <Box
              sx={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
                bgcolor: done || active ? FOREST : 'transparent',
                color: done || active ? 'primary.contrastText' : INK_SECONDARY,
                border: '1.5px solid', borderColor: done || active ? 'primary.main' : 'divider',
                transition: 'all .2s ease',
              }}
            >
              {done ? <CheckRoundedIcon sx={{ fontSize: 15 }} /> : i + 1}
            </Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: active ? 700 : 500, color: active ? FOREST : INK_SECONDARY, whiteSpace: 'nowrap' }}>
              {label}
            </Typography>
            {i < STEPS.length - 1 && <Box sx={{ flex: 1, height: 2, bgcolor: done ? FOREST : 'divider', mx: 0.5 }} />}
          </Box>
        )
      })}
    </Box>
  )
}

export function RegisterForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register } = useAuth()
  // DB-backed plans (seeded from SUBSCRIPTION_PLANS so the picker never flashes empty).
  const plans = usePlanMap()

  const [step, setStep] = useState(0)
  const [accountType, setAccountType] = useState<AccountType>(
    searchParams.get('role') === 'organization' ? 'organization' : 'individual',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationType, setOrganizationType] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [website, setWebsite] = useState('')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY)
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(SubscriptionTier.FREE)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isOrg = accountType === 'organization'

  function validateDetails(): FieldErrors {
    const e: FieldErrors = {}
    if (!name.trim()) e.name = isOrg ? 'Contact name is required' : 'Name is required'
    if (!email.trim()) e.email = 'Email is required'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (isOrg) {
      if (!organizationName.trim()) e.organizationName = 'Organization name is required'
      if (!organizationType) e.organizationType = 'Select an organization type'
      if (website.trim() && !/^https?:\/\/.+/i.test(website.trim())) e.website = 'Enter a full URL (https://…)'
    }
    return e
  }

  function next() {
    setApiError('')
    if (step === 1) {
      const e = validateDetails()
      setErrors(e)
      if (Object.keys(e).length > 0) return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  function back() {
    setApiError('')
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleSubmit() {
    setApiError('')
    setSubmitting(true)
    try {
      let referralCode: string | undefined
      try {
        referralCode = localStorage.getItem('uf_ref')?.trim() || undefined
      } catch {
        referralCode = undefined
      }
      // 1) Create the account (critical — a failure here blocks signup).
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        referralCode,
        ...(isOrg
          ? {
              role: 'organization',
              organizationName: organizationName.trim(),
              organizationType,
              registrationNumber: registrationNumber.trim() || undefined,
              website: website.trim() || undefined,
            }
          : {}),
      })

      // 2) Free plan → straight to the dashboard.
      if (selectedTier === SubscriptionTier.FREE) {
        navigate('/dashboard')
        return
      }

      // 3) Paid plan → start checkout. The account already exists, so any
      // checkout hiccup falls back to the dashboard (upgrade later) rather than
      // reading as a signup failure.
      try {
        const result = await createSubscriptionCheckout({ tier: selectedTier, billingCycle })
        if (result.activatedWithoutCharge) {
          navigate(`/subscription/callback?checkout=${result.checkout.id}`)
          return
        }
        if (result.authorizationUrl) {
          saveSubscriptionCheckoutHandoff({
            checkoutId: result.checkout.id,
            reference: result.reference ?? '',
            tier: selectedTier,
            billingCycle,
            finalAmount: result.preview.finalAmount,
            currency: result.preview.currency,
          })
          window.location.assign(result.authorizationUrl)
          return
        }
        navigate('/dashboard')
      } catch (err) {
        // Payments disabled or transient checkout error — account is created.
        if (!isPaymentsNotConfigured(err)) {
          // Still land them in-app; they can upgrade from Subscription.
        }
        navigate('/dashboard')
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
      setStep(1) // send them back to the details step to fix/retry
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Stepper current={step} />
      {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

      {/* STEP 1 — Account type */}
      {step === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontSize: '0.9rem', color: INK_SECONDARY, mb: 0.5 }}>Who are you fundraising as?</Typography>
          {([
            { type: 'individual' as const, icon: <PersonRoundedIcon />, title: 'Individual', blurb: 'Raise for yourself, family, or a personal cause.' },
            { type: 'organization' as const, icon: <ApartmentRoundedIcon />, title: 'Organization', blurb: 'NGO, hospital, school, church, or business.' },
          ]).map((opt) => {
            const active = accountType === opt.type
            return (
              <Box
                key={opt.type}
                component="button"
                type="button"
                aria-pressed={active}
                onClick={() => setAccountType(opt.type)}
                sx={{
                  all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, p: 2,
                  borderRadius: SHAPE.card, boxSizing: 'border-box', width: '100%',
                  border: '1.5px solid', borderColor: active ? 'secondary.main' : 'divider',
                  bgcolor: active ? 'rgba(199,162,74,0.08)' : 'transparent',
                  transition: 'border-color .15s ease, background-color .15s ease',
                  '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
                }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: SHAPE.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: active ? GOLD : 'action.hover', color: active ? 'secondary.contrastText' : FOREST, flexShrink: 0 }}>
                  {opt.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, color: FOREST }}>{opt.title}</Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: INK_SECONDARY }}>{opt.blurb}</Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* STEP 2 — Details */}
      {step === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {isOrg && (
            <>
              <TextField label="Organization name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} error={!!errors.organizationName} helperText={errors.organizationName} fullWidth required />
              <TextField select label="Organization type" value={organizationType} onChange={(e) => setOrganizationType(e.target.value)} error={!!errors.organizationType} helperText={errors.organizationType} fullWidth required>
                {Object.values(OrganizationType).map((t) => <MenuItem key={t} value={t}>{ORG_TYPE_LABELS[t]}</MenuItem>)}
              </TextField>
            </>
          )}
          <TextField label={isOrg ? 'Contact name' : 'Full name'} value={name} onChange={(e) => setName(e.target.value)} error={!!errors.name} helperText={errors.name} fullWidth required autoComplete="name" />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={!!errors.email} helperText={errors.email} fullWidth required autoComplete="email" />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={!!errors.password} helperText={errors.password} fullWidth required autoComplete="new-password" />
          <TextField label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={!!errors.confirmPassword} helperText={errors.confirmPassword} fullWidth required autoComplete="new-password" />
          {isOrg && (
            <>
              <TextField label="Registration number (optional)" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} fullWidth />
              <TextField label="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} error={!!errors.website} helperText={errors.website} placeholder="https://" fullWidth />
            </>
          )}
        </Box>
      )}

      {/* STEP 3 — Plan */}
      {step === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: '0.9rem', color: INK_SECONDARY }}>Choose a plan — you can change it anytime.</Typography>
            <Box sx={{ display: 'inline-flex', borderRadius: SHAPE.sm, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              {[BillingCycle.MONTHLY, BillingCycle.YEARLY].map((c) => (
                <Box key={c} component="button" type="button" aria-pressed={billingCycle === c} onClick={() => setBillingCycle(c)}
                  sx={{ all: 'unset', cursor: 'pointer', px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 700, '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: -2 },
                    bgcolor: billingCycle === c ? FOREST : 'transparent', color: billingCycle === c ? 'primary.contrastText' : INK_SECONDARY }}>
                  {c === BillingCycle.MONTHLY ? 'Monthly' : 'Yearly · save'}
                </Box>
              ))}
            </Box>
          </Box>
          {ALL_TIERS.map((tier) => {
            const plan = plans[tier]
            const active = selectedTier === tier
            const price = billingCycle === BillingCycle.YEARLY ? plan.priceYearly : plan.priceMonthly
            return (
              <Box key={tier} component="button" type="button" aria-pressed={active} onClick={() => setSelectedTier(tier)}
                sx={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, p: 2, width: '100%', boxSizing: 'border-box',
                  borderRadius: SHAPE.card, border: '1.5px solid', borderColor: active ? 'secondary.main' : 'divider',
                  bgcolor: active ? 'rgba(199,162,74,0.08)' : 'transparent',
                  '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 } }}>
                <Box sx={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', border: '2px solid', borderColor: active ? 'secondary.main' : 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {active && <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: GOLD }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: FOREST }}>{plan.name}</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: INK_SECONDARY }}>
                    {plan.maxActiveCampaigns === -1 ? 'Unlimited' : plan.maxActiveCampaigns} campaign{plan.maxActiveCampaigns === 1 ? '' : 's'} · {plan.platformFeePercent}% fee
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontWeight: 800, color: FOREST }}>
                    {price === 0 ? 'Free' : formatCurrency(price, 'GHS')}
                  </Typography>
                  {price > 0 && <Typography sx={{ fontSize: '0.7rem', color: INK_SECONDARY }}>/{billingCycle === BillingCycle.YEARLY ? 'yr' : 'mo'}</Typography>}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Nav */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
        {step > 0 && (
          <Button onClick={back} disabled={submitting} startIcon={<ArrowBackRoundedIcon />} sx={{ color: FOREST, textTransform: 'none', fontWeight: 700 }}>
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {step < STEPS.length - 1 ? (
          <Button onClick={next} variant="contained" color="primary" endIcon={<ArrowForwardRoundedIcon />} sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}>
            Continue
          </Button>
        ) : (
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={submitting}
            endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}>
            {submitting ? 'Creating…' : selectedTier === SubscriptionTier.FREE ? 'Create account' : 'Create account & continue'}
          </Button>
        )}
      </Box>

      <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 3 }}>
        Already have an account?{' '}
        <Link component={RouterLink} to="/login" underline="hover" sx={{ color: GOLD_DARK, fontWeight: 600 }}>
          Sign in
        </Link>
      </Typography>
    </Box>
  )
}
