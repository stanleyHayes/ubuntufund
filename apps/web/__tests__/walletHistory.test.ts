import { describe, expect, it } from 'vitest'
import { TransactionType } from '@ubuntu-fund/types'
import { WALLET_HISTORY_PAGE_SIZE, nextHistoryCursor, walletTxSign } from '../src/lib/walletHistory'

// I127: history amounts were unsigned and only the newest 50 rows were reachable.
describe('wallet history', () => {
  it('signs money in and out of the wallet', () => {
    expect(walletTxSign(TransactionType.DEPOSIT)).toBe('+')
    expect(walletTxSign(TransactionType.REFUND)).toBe('+')
    expect(walletTxSign(TransactionType.ESCROW_RELEASE)).toBe('+')
    expect(walletTxSign(TransactionType.DONATION)).toBe('−')
    expect(walletTxSign(TransactionType.WITHDRAWAL)).toBe('−')
    expect(walletTxSign(TransactionType.ESCROW_LOCK)).toBe('−')
    expect(walletTxSign(TransactionType.TRANSFER)).toBe('')
  })
  it('offers another page only after a full page', () => {
    const rows = Array.from({ length: WALLET_HISTORY_PAGE_SIZE }, (_, i) => ({ id: `id${i}`, createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, i)) }))
    expect(nextHistoryCursor(rows)).toBe(`2026-09-01T00:00:49.000Z_id${WALLET_HISTORY_PAGE_SIZE - 1}`)
    expect(nextHistoryCursor(rows.slice(1))).toBeNull()
  })
})
