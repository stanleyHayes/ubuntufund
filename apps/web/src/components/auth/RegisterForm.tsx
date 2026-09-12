import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { OrganizationTypePicker } from './OrganizationTypePicker'
import { PasswordStrength } from './PasswordStrength'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { Link as RouterLink } from 'react-router-dom'
import { SubscriptionTier, BillingCycle } from '@ubuntu-fund/types'
import {
  REFERRAL_CODE_MAX,
  normalizeReferralCode,
  referralCodeProblemMessage,
  validateReferralCode,
} from '@ubuntu-fund/types'
import { SHAPE, formatCurrency, LoadingDots } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import { useSignupPlans } from '@/hooks/useSubscription'
import {
  createSubscriptionCheckout,
  saveSubscriptionCheckoutHandoff,
} from '@/lib/subscriptions'

const FOREST = 'primary.main'
const GOLD = '#C7A24A'
const GOLD_DARK = 'var(--text-warning)'
const INK_SECONDARY = 'text.secondary'

type AccountType = 'individual' | 'organization'

const PERSONAL_STEPS = ['Account', 'Details', 'Plan']
const ORGANIZATION_STEPS = ['Account', 'Organization', 'Contact', 'Plan']

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

function Stepper({ current, steps }: { current: number; steps: string[] }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <Box
            key={label}
            aria-current={active ? 'step' : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flex: i < steps.length - 1 ? 1 : '0 0 auto',
            }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                bgcolor: done || active ? FOREST : 'transparent',
                color: done || active ? 'primary.contrastText' : INK_SECONDARY,
                border: '1.5px solid',
                borderColor: done || active ? 'primary.main' : 'divider',
                transition: 'background-color 180ms ease, color 180ms ease, box-shadow 180ms ease',
              }}
            >
              {done ? <CheckRoundedIcon sx={{ fontSize: 15 }} /> : i + 1}
            </Box>
            <Typography
              sx={{
                display: { xs: active ? 'block' : 'none', sm: 'block' },
                fontSize: '0.72rem',
                fontWeight: active ? 700 : 500,
                color: active ? FOREST : INK_SECONDARY,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </Typography>
            {i < steps.length - 1 && (
              <Box sx={{ flex: 1, height: 2, bgcolor: done ? FOREST : 'divider', mx: 0.5 }} />
            )}
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
  const { plans, error: plansError, retry: retryPlans } = useSignupPlans()

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
  const [needsWebsite, setNeedsWebsite] = useState(false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(BillingCycle.MONTHLY)
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(SubscriptionTier.FREE)
  // Seeded from the ?ref= link App.tsx stored. Editable, because a code shared
  // by word of mouth, on a flyer, or clicked on another device never reaches
  // localStorage — without a field those referrals were simply lost.
  const [referralCode, setReferralCode] = useState(() => {
    try {
      return localStorage.getItem('uf_ref')?.trim() ?? ''
    } catch {
      return ''
    }
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isOrg = accountType === 'organization'
  // Optional field: only validate once something is typed.
  const referralProblem = referralCode.trim() ? validateReferralCode(referralCode) : null

  const steps = isOrg ? ORGANIZATION_STEPS : PERSONAL_STEPS
  const contactStep = isOrg ? 2 : 1

  function validateDetails(): FieldErrors {
    const e: FieldErrors = {}
    if (!name.trim()) e.name = isOrg ? 'Contact name is required' : 'Name is required'
    if (!email.trim()) e.email = 'Email is required'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    if (isOrg && step === 1) {
      if (!organizationName.trim()) e.organizationName = 'Organization name is required'
      if (!organizationType) e.organizationType = 'Select an organization type'
      if (website.trim() && !/^https?:\/\/.+/i.test(website.trim()))
        e.website = 'Enter a full URL (https://…)'
    }
    const keys: (keyof FieldErrors)[] = isOrg && step === 1 ? ['organizationName', 'organizationType', 'website'] : ['name', 'email', 'password', 'confirmPassword']
    return Object.fromEntries(Object.entries(e).filter(([key]) => keys.includes(key as keyof FieldErrors)))
  }

  function next() {
    setApiError('')
    if (step > 0) {
      const e = validateDetails()
      setErrors(e)
      if (Object.keys(e).length > 0) return
    }
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }
  function back() {
    setApiError('')
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleSubmit() {
    setApiError('')
    if (!plans[selectedTier]) return
    setSubmitting(true)
    try {
      const referral = normalizeReferralCode(referralCode) || undefined
      // 1) Create the account (critical — a failure here blocks signup).
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        referralCode: referral,
        ...(isOrg
          ? {
              role: 'organization',
              organizationName: organizationName.trim(),
              organizationType,
              registrationNumber: registrationNumber.trim() || undefined,
              website: website.trim() || undefined,
              needsWebsite: !website.trim() && needsWebsite,
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
        navigate(`/subscription?tier=${encodeURIComponent(selectedTier)}&billingCycle=${billingCycle}&checkoutError=1`)
      } catch {
        // Registration succeeded. Retry payment from the signed-in subscription page.
        navigate(`/subscription?tier=${encodeURIComponent(selectedTier)}&billingCycle=${billingCycle}&checkoutError=1`)
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
      setStep(contactStep) // Keep entered details so the contact can fix/retry.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Stepper current={step} steps={steps} />
      {apiError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiError}
        </Alert>
      )}

      {/* STEP 1 — Account type */}
      {step === 0 && (
        <Box className="uf-auth-step" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontSize: '0.9rem', color: INK_SECONDARY, mb: 0.5 }}>
            Who are you fundraising as?
          </Typography>
          {[
            {
              type: 'individual' as const,
              icon: <PersonRoundedIcon />,
              title: 'Individual',
              blurb: 'Raise for yourself, family, or a personal cause.',
            },
            {
              type: 'organization' as const,
              icon: <ApartmentRoundedIcon />,
              title: 'Organization',
              blurb: 'NGO, hospital, school, church, or business.',
            },
          ].map((opt) => {
            const active = accountType === opt.type
            return (
              <Box
                key={opt.type}
                component="button"
                type="button"
                aria-pressed={active}
                onClick={() => setAccountType(opt.type)}
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  borderRadius: SHAPE.card,
                  boxSizing: 'border-box',
                  width: '100%',
                  border: '1.5px solid',
                  borderColor: active ? 'secondary.main' : 'divider',
                  bgcolor: 'background.paper',
                  boxShadow: active ? 'var(--neu-inset)' : 'var(--neu-raised)',
                  backdropFilter: 'var(--neu-backdrop, none)',
                  '&:hover': { boxShadow: active ? 'var(--neu-inset)' : 'var(--neu-raised-hover)' },
                  transition: 'box-shadow .15s ease, border-color .15s ease',
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  '&:focus-visible': { outline: '2px solid var(--focus-ring)', outlineOffset: 2 },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: SHAPE.sm,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: active ? GOLD : 'action.hover',
                    color: active ? 'secondary.contrastText' : FOREST,
                    flexShrink: 0,
                  }}
                >
                  {opt.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, color: FOREST }}>{opt.title}</Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: INK_SECONDARY }}>
                    {opt.blurb}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* STEP 2 — Details */}
      {step > 0 && step < steps.length - 1 && (
        <Box className="uf-auth-step" sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {isOrg && step === 1 && (
            <>
              <TextField
                label="Organization name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                error={!!errors.organizationName}
                helperText={errors.organizationName}
                fullWidth
                required
              />
              <OrganizationTypePicker
                value={organizationType}
                onChange={(value) => {
                  setOrganizationType(value)
                  setErrors((current) => ({ ...current, organizationType: undefined }))
                }}
                error={errors.organizationType}
              />
            </>
          )}
          {step === contactStep && <>
          <TextField
            label={isOrg ? 'Contact name' : 'Full name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
            autoComplete="name"
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!errors.email}
            helperText={errors.email}
            fullWidth
            required
            autoComplete="email"
          />
          <Box>
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!errors.password}
              helperText={errors.password}
              fullWidth
              required
              autoComplete="new-password"
            />
            <PasswordStrength value={password} />
          </Box>
          <TextField
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            fullWidth
            required
            autoComplete="new-password"
          />
          <TextField
            label="Referral code (optional)"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            error={Boolean(referralProblem)}
            helperText={
              referralProblem
                ? referralCodeProblemMessage(referralProblem)
                : 'Were you invited? Enter their code so they get credit.'
            }
            fullWidth
            slotProps={{ htmlInput: { maxLength: REFERRAL_CODE_MAX, autoCapitalize: 'none', spellCheck: false } }}
          />
          </>}
          {isOrg && step === 1 && (
            <>
              <TextField
                label="Registration number (optional)"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                fullWidth
              />
              <TextField
                label="Website (optional)"
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value)
                  if (e.target.value.trim()) setNeedsWebsite(false)
                }}
                error={!!errors.website}
                helperText={errors.website}
                placeholder="https://"
                fullWidth
              />
              {!website.trim() && (
                <Box>
                  <FormControlLabel
                    control={<Checkbox checked={needsWebsite} onChange={(event) => setNeedsWebsite(event.target.checked)} />}
                    label="Does your organization need a website?"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Optional. Check this box to request contact from our parent company, Neurodyne Corp Ltd, about a website for your organization.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* STEP 3 — Plan */}
      {step === steps.length - 1 && (
        <Box className="uf-auth-step" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography sx={{ fontSize: '0.9rem', color: INK_SECONDARY }}>
              Choose a plan — you can change it anytime.
            </Typography>
            <Box
              sx={{
                // Matches the pricing page's segmented control: the container is
                // the recessed well, the active segment sits raised inside it.
                // SHAPE.button, not SHAPE.sm, so it shares the buttons' radius.
                display: 'inline-flex',
                gap: 0.5,
                p: 0.5,
                borderRadius: SHAPE.button,
                boxShadow: 'var(--neu-inset)',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {[BillingCycle.MONTHLY, BillingCycle.YEARLY].map((c) => (
                <Box
                  key={c}
                  component="button"
                  type="button"
                  aria-pressed={billingCycle === c}
                  onClick={() => setBillingCycle(c)}
                  sx={{
                    all: 'unset',
                    cursor: 'pointer',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: SHAPE.button,
                    boxShadow: billingCycle === c ? 'var(--neu-raised)' : 'none',
                    transition: 'background-color .15s ease, color .15s ease, box-shadow .15s ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'secondary.main',
                      outlineOffset: -2,
                    },
                    bgcolor: billingCycle === c ? FOREST : 'transparent',
                    color: billingCycle === c ? 'primary.contrastText' : INK_SECONDARY,
                  }}
                >
                  {c === BillingCycle.MONTHLY ? 'Monthly' : 'Yearly · save'}
                </Box>
              ))}
            </Box>
          </Box>
          {plansError && <Alert severity="error" action={<Button onClick={retryPlans}>Retry</Button>}>We couldn’t load current prices. Please retry before choosing a plan.</Alert>}
          {!plansError && Object.keys(plans).length === 0 && <Box aria-label="Loading current plans" aria-busy="true">{[0, 1, 2].map(row => <Skeleton key={row} variant="rounded" height={84} sx={{ mb: 2 }} />)}</Box>}
          {ALL_TIERS.filter(tier => plans[tier]).map((tier) => {
            const plan = plans[tier]
            const active = selectedTier === tier
            const price =
              billingCycle === BillingCycle.YEARLY ? plan.priceYearly : plan.priceMonthly
            return (
              <Box
                key={tier}
                component="button"
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedTier(tier)}
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: SHAPE.card,
                  border: '1.5px solid',
                  borderColor: active ? 'secondary.main' : 'divider',
                  bgcolor: 'background.paper',
                  boxShadow: active ? 'var(--neu-inset)' : 'var(--neu-raised)',
                  backdropFilter: 'var(--neu-backdrop, none)',
                  '&:hover': { boxShadow: active ? 'var(--neu-inset)' : 'var(--neu-raised-hover)' },
                  transition: 'box-shadow .15s ease, border-color .15s ease',
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  '&:focus-visible': { outline: '2px solid var(--focus-ring)', outlineOffset: 2 },
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor: active ? 'secondary.main' : 'text.secondary',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active && (
                    <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: GOLD }} />
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: FOREST }}>{plan.name}</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: INK_SECONDARY }}>
                    {plan.maxActiveCampaigns === -1 ? 'Unlimited' : plan.maxActiveCampaigns}{' '}
                    campaign{plan.maxActiveCampaigns === 1 ? '' : 's'} · {plan.platformFeePercent}%
                    fee
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontWeight: 800, color: FOREST }}>
                    {price === 0 ? 'Free' : formatCurrency(price, 'GHS')}
                  </Typography>
                  {price > 0 && (
                    <Typography sx={{ fontSize: '0.7rem', color: INK_SECONDARY }}>
                      {billingCycle === BillingCycle.YEARLY ? 'per year · billed yearly' : 'per month'}
                    </Typography>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Nav */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
        {step > 0 && (
          <Button
            onClick={back}
            disabled={submitting}
            startIcon={<ArrowBackRoundedIcon />}
            sx={{ color: FOREST, textTransform: 'none', fontWeight: 700 }}
          >
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {step < steps.length - 1 ? (
          <Button
            onClick={next}
            variant="contained"
            color="primary"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            Continue
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={submitting || !plans[selectedTier]}
            endIcon={submitting ? <LoadingDots size={6} /> : undefined}
            sx={{ textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            {submitting
              ? 'Creating…'
              : selectedTier === SubscriptionTier.FREE
                ? 'Create account'
                : 'Create account & continue'}
          </Button>
        )}
      </Box>

      <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 3 }}>
        Already have an account?{' '}
        <Link
          component={RouterLink}
          to="/login"
          underline="hover"
          sx={{ color: GOLD_DARK, fontWeight: 600 }}
        >
          Sign in
        </Link>
      </Typography>
    </Box>
  )
}
