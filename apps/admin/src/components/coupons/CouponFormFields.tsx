import type { Dispatch, SetStateAction } from 'react'
import {
  Box,
  MenuItem,
  InputAdornment,
  Select,
  OutlinedInput,
  Checkbox,
  ListItemText,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
} from '@mui/material'
import { BrandedTextField as TextField, BrandedDatePicker } from '@ubuntu-fund/ui'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded'
import {
  CouponDiscountType,
  BillingCycle,
  CouponSurface,
  CouponCommissionBase,
} from '@ubuntu-fund/types'
import { type CouponForm, PAID_TIERS, planLabel, SURFACE_LABEL, SURFACE_HINT } from './couponForm'

export default function CouponFormFields({
  form,
  setForm,
  editing = false,
  step,
}: {
  form: CouponForm
  setForm: Dispatch<SetStateAction<CouponForm>>
  editing?: boolean
  step?: number
}) {
  const codeInvalid = form.code.length > 50
  const amountInvalid =
    form.amount <= 0 || (form.discountType === CouponDiscountType.PERCENT && form.amount > 100)
  return (
    <>
      {(step === undefined || step === 0) && (
        <>
          <TextField
            fullWidth
            size="small"
            label="Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            disabled={!!editing}
            helperText={
              editing ? 'Code is immutable after creation' : 'Stored uppercase; must be unique'
            }
            error={codeInvalid}
          />
          <TextField
            fullWidth
            size="small"
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Discount Type"
              value={form.discountType}
              onChange={(e) =>
                setForm({ ...form, discountType: e.target.value as CouponDiscountType })
              }
            >
              <MenuItem value={CouponDiscountType.PERCENT}>Percent (%)</MenuItem>
              <MenuItem value={CouponDiscountType.FIXED}>Fixed (GH₵)</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              error={amountInvalid}
              helperText={form.discountType === CouponDiscountType.PERCENT ? '0–100' : 'GH₵ off'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {form.discountType === CouponDiscountType.PERCENT ? '%' : 'GH₵'}
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          {form.discountType === CouponDiscountType.PERCENT && (
            <TextField
              fullWidth
              size="small"
              label="Maximum discount (optional)"
              type="number"
              value={form.maxDiscountAmount}
              onChange={(e) =>
                setForm({ ...form, maxDiscountAmount: parseFloat(e.target.value) || 0 })
              }
              helperText="0 = no ceiling. Caps what this percentage can take off a large plan."
              InputProps={{ endAdornment: <InputAdornment position="end">GH₵</InputAdornment> }}
            />
          )}
        </>
      )}
      {(step === undefined || step === 1) && (
        <>
          <FormControl fullWidth size="small">
            <InputLabel shrink id="coupon-tiers-label">
              Applies to Tiers
            </InputLabel>
            <Select
              labelId="coupon-tiers-label"
              displayEmpty
              multiple
              value={form.appliesToTiers}
              onChange={(e) => setForm({ ...form, appliesToTiers: e.target.value as string[] })}
              input={
                <OutlinedInput
                  label="Applies to Tiers"
                  startAdornment={
                    <InputAdornment position="start">
                      <LocalOfferRoundedIcon fontSize="small" />
                    </InputAdornment>
                  }
                />
              }
              renderValue={(selected) =>
                selected.length === 0 ? 'All tiers' : selected.map((t) => planLabel(t)).join(', ')
              }
            >
              {PAID_TIERS.map((t) => (
                <MenuItem key={t} value={t}>
                  <Checkbox checked={form.appliesToTiers.includes(t)} size="small" />
                  <ListItemText primary={planLabel(t)} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel shrink id="coupon-cycles-label">
              Applies to Billing Cycles
            </InputLabel>
            <Select
              labelId="coupon-cycles-label"
              displayEmpty
              multiple
              value={form.appliesToBillingCycles}
              onChange={(e) =>
                setForm({ ...form, appliesToBillingCycles: e.target.value as BillingCycle[] })
              }
              input={
                <OutlinedInput
                  label="Applies to Billing Cycles"
                  startAdornment={
                    <InputAdornment position="start">
                      <CalendarMonthOutlinedIcon fontSize="small" />
                    </InputAdornment>
                  }
                />
              }
              renderValue={(selected) =>
                selected.length === 0
                  ? 'All cycles'
                  : selected.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
              }
            >
              {Object.values(BillingCycle).map((cycle) => (
                <MenuItem key={cycle} value={cycle}>
                  <Checkbox checked={form.appliesToBillingCycles.includes(cycle)} size="small" />
                  <ListItemText primary={cycle.charAt(0).toUpperCase() + cycle.slice(1)} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel shrink id="coupon-surfaces-label">
              Where it can be used
            </InputLabel>
            <Select
              labelId="coupon-surfaces-label"
              displayEmpty
              multiple
              value={form.appliesToSurfaces}
              onChange={(e) =>
                setForm({ ...form, appliesToSurfaces: e.target.value as CouponSurface[] })
              }
              input={<OutlinedInput label="Where it can be used" />}
              renderValue={(selected) =>
                selected.length === 0
                  ? 'Subscriptions only'
                  : selected.map((v) => SURFACE_LABEL[v]).join(', ')
              }
            >
              {Object.values(CouponSurface).map((surface) => (
                <MenuItem key={surface} value={surface}>
                  <Checkbox checked={form.appliesToSurfaces.includes(surface)} size="small" />
                  <ListItemText
                    primary={SURFACE_LABEL[surface]}
                    secondary={SURFACE_HINT[surface]}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            select
            fullWidth
            size="small"
            label="Affiliate commission on a discounted sale"
            value={form.commissionBase}
            onChange={(e) =>
              setForm({ ...form, commissionBase: e.target.value as CouponCommissionBase })
            }
            helperText="Which amount a referrer's commission is calculated from."
          >
            <MenuItem value={CouponCommissionBase.POST_COUPON}>Amount actually charged</MenuItem>
            <MenuItem value={CouponCommissionBase.LIST_PRICE}>Full list price</MenuItem>
          </TextField>
        </>
      )}
      {(step === undefined || step === 2) && (
        <>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Max Redemptions"
              type="number"
              value={form.maxRedemptions}
              onChange={(e) => setForm({ ...form, maxRedemptions: parseInt(e.target.value) || 0 })}
              helperText="0 = unlimited"
            />
            <TextField
              fullWidth
              size="small"
              label="Per-User Limit"
              type="number"
              value={form.perUserLimit}
              onChange={(e) => setForm({ ...form, perUserLimit: parseInt(e.target.value) || 0 })}
              helperText="0 = unlimited"
            />
          </Box>
          <TextField
            fullWidth
            size="small"
            label="Minimum Subtotal (GH₵)"
            type="number"
            value={form.minSubtotal}
            onChange={(e) => setForm({ ...form, minSubtotal: parseFloat(e.target.value) || 0 })}
            helperText="0 = no minimum"
          />
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
            <BrandedDatePicker
              fullWidth
              size="small"
              label="Valid From"
              value={form.validFrom}
              onChange={(value) => setForm({ ...form, validFrom: value })}
            />
            <BrandedDatePicker
              fullWidth
              size="small"
              label="Valid Until"
              value={form.validUntil}
              onChange={(value) => setForm({ ...form, validUntil: value })}
              minDate={form.validFrom || undefined}
            />
          </Box>
          <TextField
            fullWidth
            size="small"
            label="Limit to specific people (optional)"
            multiline
            minRows={2}
            value={form.allowedEmails}
            onChange={(e) => setForm({ ...form, allowedEmails: e.target.value })}
            helperText="One email per line. Leave blank to let anyone use the code."
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.newUsersOnly}
                onChange={(e) => setForm({ ...form, newUsersOnly: e.target.checked })}
              />
            }
            label="First-time subscribers only"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            }
            label="Active"
          />
        </>
      )}
    </>
  )
}
