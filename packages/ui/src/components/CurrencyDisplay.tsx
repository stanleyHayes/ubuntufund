import React from 'react'
import Typography, { TypographyProps } from '@mui/material/Typography'

/**
 * Formats a numeric amount in Ghanaian cedis (GHS) — the platform's only currency.
 * Whole cedis show no decimals and anything else shows two, so an amount never
 * reads with one decimal: GH₵3,990, GH₵9.99, GH₵332.50.
 * The `currency` parameter is kept for API compatibility; amounts are always GHS.
 */
export function formatCurrency(amount: number, _currency: string = 'GHS'): string {
  // Judged on the amount rounded to the pesewa, so float noise such as
  // 29.999999999999996 still reads as whole cedis.
  const minimumFractionDigits = Number.isInteger(Math.round(amount * 100) / 100) ? 0 : 2
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Fallback for environments without en-GH locale data
    return `GH₵ ${amount.toLocaleString('en-GH', { minimumFractionDigits, maximumFractionDigits: 2 })}`
  }
}

export interface CurrencyDisplayProps extends Omit<TypographyProps, 'children'> {
  /** Numeric amount */
  amount: number
  /** Currency code — the platform uses GHS (Ghanaian cedi) only */
  currency?: string
}

export function CurrencyDisplay({ amount, currency = 'GHS', component = 'span', ...typographyProps }: CurrencyDisplayProps & { component?: React.ElementType }) {
  return <Typography component={component} {...typographyProps}>{formatCurrency(amount, currency)}</Typography>
}
