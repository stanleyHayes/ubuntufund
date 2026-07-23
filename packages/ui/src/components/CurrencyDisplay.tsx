import React from 'react'
import Typography, { TypographyProps } from '@mui/material/Typography'

const CURRENCY_LOCALES: Record<string, string> = {
  GHS: 'en-GH',
  NGN: 'en-NG',
  KES: 'en-KE',
  ZAR: 'en-ZA',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  XOF: 'fr-SN',
  XAF: 'fr-CM',
  TZS: 'en-TZ',
  UGX: 'en-UG',
  RWF: 'en-RW',
  ETB: 'en-ET',
  EGP: 'en-EG',
  MAD: 'fr-MA',
}

/**
 * Formats a numeric amount with the appropriate currency symbol and locale.
 */
export function formatCurrency(amount: number, currency: string): string {
  const locale = CURRENCY_LOCALES[currency] ?? 'en-US'

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Fallback for unknown currency codes
    return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }
}

export interface CurrencyDisplayProps extends Omit<TypographyProps, 'children'> {
  /** Numeric amount */
  amount: number
  /** ISO 4217 currency code */
  currency: string
}

export function CurrencyDisplay({ amount, currency, component = 'span', ...typographyProps }: CurrencyDisplayProps & { component?: React.ElementType }) {
  return <Typography component={component} {...typographyProps}>{formatCurrency(amount, currency)}</Typography>
}
