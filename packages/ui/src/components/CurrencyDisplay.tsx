import React from 'react'
import Typography, { TypographyProps } from '@mui/material/Typography'

/**
 * Formats a numeric amount in Ghanaian cedis (GHS) — the platform's only currency.
 * The `currency` parameter is kept for API compatibility; amounts are always GHS.
 */
export function formatCurrency(amount: number, currency: string = 'GHS'): string {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Fallback for environments without en-GH locale data
    return `GH₵ ${amount.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
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
