import { TransactionType, type Transaction } from '@ubuntu-fund/types'

/** Rows fetched per history page. */
export const WALLET_HISTORY_PAGE_SIZE = 50

/**
 * Money in (+) or out (−) of the wallet for a transaction type. TRANSFER has
 * no direction until its metadata carries one, so it shows unsigned.
 */
export function walletTxSign(type: TransactionType): '+' | '−' | '' {
  switch (type) {
    case TransactionType.DEPOSIT:
    case TransactionType.REFUND:
    case TransactionType.ESCROW_RELEASE:
      return '+'
    case TransactionType.DONATION:
    case TransactionType.WITHDRAWAL:
    case TransactionType.ESCROW_LOCK:
      return '−'
    default:
      return ''
  }
}

/** Cursor for the page after `rows` (the API's `before` parameter). */
export function nextHistoryCursor(rows: Pick<Transaction, 'id' | 'createdAt'>[]): string | null {
  if (rows.length < WALLET_HISTORY_PAGE_SIZE) return null
  const last = rows[rows.length - 1]
  return `${new Date(last.createdAt).toISOString()}_${last.id}`
}
