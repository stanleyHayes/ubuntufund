import { useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { CouponCommissionBase, CouponDiscountType } from '@ubuntu-fund/types'
import PageHeader from '@/components/PageHeader'
import CouponFormFields from '@/components/coupons/CouponFormFields'
import {
  createCouponPayload,
  emptyForm,
  parseEmails,
  planLabel,
  SURFACE_LABEL,
  validateCouponStep,
} from '@/components/coupons/couponForm'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import { api } from '@/lib/api'

const steps = [
  {
    title: 'Offer',
    description: 'Name your coupon and choose its discount.',
    icon: LocalOfferRoundedIcon,
  },
  {
    title: 'Eligibility',
    description: 'Choose where the code works and which plans qualify.',
    icon: GroupOutlinedIcon,
  },
  {
    title: 'Limits & schedule',
    description: 'Set usage limits, recipients and availability.',
    icon: TuneRoundedIcon,
  },
  {
    title: 'Review',
    description: 'Check the details before creating your coupon.',
    icon: FactCheckOutlinedIcon,
  },
]

export default function CreateCouponPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ ...emptyForm })
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const current = steps[step]
  const Icon = current.icon
  const moveTo = (next: number) => {
    setError('')
    setStep(next)
    requestAnimationFrame(() => {
      heading.current?.focus()
      heading.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
  }
  const next = () => {
    const message = validateCouponStep(form, step)
    if (message) {
      setError(message)
      return
    }
    moveTo(step + 1)
  }
  const create = async () => {
    if (submitting.current) return
    for (let index = 0; index < 3; index++) {
      const message = validateCouponStep(form, index)
      if (message) {
        moveTo(index)
        setError(message)
        return
      }
    }
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      await api.post('/coupons', createCouponPayload(form))
      navigate('/coupons', {
        replace: true,
        state: { createdCoupon: form.code.trim().toUpperCase() },
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create the coupon. Please try again.',
      )
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  const unlimited = (value: number) => (value ? value.toLocaleString() : 'Unlimited')
  const review = [
    ['Code', form.code.trim().toUpperCase()],
    ['Description', form.description || 'No description'],
    [
      'Discount',
      form.discountType === CouponDiscountType.PERCENT ? `${form.amount}%` : `GHS ${form.amount}`,
    ],
    [
      'Maximum discount',
      form.discountType === CouponDiscountType.PERCENT && form.maxDiscountAmount
        ? `GHS ${form.maxDiscountAmount}`
        : 'No additional ceiling',
    ],
    [
      'Where it works',
      form.appliesToSurfaces.length
        ? form.appliesToSurfaces.map((value) => SURFACE_LABEL[value]).join(', ')
        : 'Subscriptions only',
    ],
    [
      'Plans',
      form.appliesToTiers.length ? form.appliesToTiers.map(planLabel).join(', ') : 'All paid plans',
    ],
    ['Billing cycles', form.appliesToBillingCycles.join(', ') || 'All cycles'],
    [
      'Affiliate commission basis',
      form.commissionBase === CouponCommissionBase.POST_COUPON
        ? 'Amount actually charged'
        : 'Full list price',
    ],
    ['Total redemptions', unlimited(form.maxRedemptions)],
    ['Per-person limit', unlimited(form.perUserLimit)],
    ['Minimum subtotal', form.minSubtotal ? `GHS ${form.minSubtotal}` : 'No minimum'],
    ['Starts', form.validFrom || 'Immediately'],
    ['Ends', form.validUntil || 'No end date'],
    [
      'Recipients',
      parseEmails(form.allowedEmails).join(', ') || 'Anyone meeting the eligibility rules',
    ],
    ['First-time subscribers only', form.newUsersOnly ? 'Yes' : 'No'],
    ['Availability', form.active ? 'Active during the selected dates' : 'Inactive until enabled'],
  ]
  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', minWidth: 0 }}>
      <Button
        component={RouterLink}
        to="/coupons"
        startIcon={<ArrowBackRoundedIcon />}
        disabled={saving}
        sx={{ mb: 2 }}
      >
        Back to coupons
      </Button>
      <PageHeader
        tone="gold"
        eyebrow="Growth · New coupon"
        title="Create a coupon"
        lede="Build an offer, choose who can use it, then review before creating."
        icon={<LocalOfferRoundedIcon />}
      />
      <Box
        component="ol"
        aria-label="Coupon creation steps"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
          listStyle: 'none',
          p: 0,
          mb: 3,
        }}
      >
        {steps.map(({ title, icon: StepIcon }, index) => (
          <Box
            component="li"
            key={title}
            aria-current={index === step ? 'step' : undefined}
            sx={{
              ...insetSurface,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: index === step ? 'primary.main' : 'text.secondary',
              border: '1px solid',
              borderColor: index === step ? 'primary.main' : 'divider',
              minWidth: 0,
            }}
          >
            <StepIcon sx={{ fontSize: 20, flexShrink: 0 }} />
            <Typography sx={{ fontWeight: index === step ? 800 : 500, fontSize: '.82rem' }}>
              {index + 1}. {title}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ ...raisedSurface, p: { xs: 2.5, sm: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Icon color="primary" />
          <Typography
            ref={heading}
            tabIndex={-1}
            component="h2"
            variant="h5"
            sx={{ fontWeight: 800 }}
          >
            {' '}
            {current.title}
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {current.description}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={(step + 1) * 25}
          aria-label={`Step ${step + 1} of 4`}
          sx={{ mb: 3 }}
        />
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        {step < 3 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <CouponFormFields form={form} setForm={setForm} step={step} />
          </Box>
        ) : (
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {review.map(([label, value]) => (
              <Box
                key={label}
                sx={{ ...insetSurface, p: 2, minWidth: 0, overflowWrap: 'anywhere' }}
              >
                <Typography component="dt" variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  {label}
                </Typography>
                <Typography component="dd" sx={{ m: 0, fontWeight: 650 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: 'space-between',
            gap: 2,
            mt: 4,
            pt: 3,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button
            disabled={saving}
            onClick={() => (step ? moveTo(step - 1) : navigate('/coupons'))}
          >
            {step ? 'Back' : 'Cancel'}
          </Button>
          <Button variant="contained" disabled={saving} onClick={step === 3 ? create : next}>
            {saving ? 'Creating…' : step === 3 ? 'Create coupon' : 'Continue'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
