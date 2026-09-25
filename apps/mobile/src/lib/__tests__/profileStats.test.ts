import { expect, it } from 'vitest'
import { formatMoneyByCurrency, profileStatTiles } from '../profileStats'

it('reads the fields /profile actually returns and keeps currencies apart', () => {
  expect(profileStatTiles({
    campaignsCreated: 2,
    donatedByCurrency: [{ currency: 'GHS', net: 100 }, { currency: 'USD', net: 30 }],
    raisedByCurrency: [{ currency: 'GHS', raised: 1250 }],
  })).toEqual([
    { value: '2', label: 'Campaigns' },
    { value: 'GH₵ 100 · US$ 30', label: 'Donated' },
    { value: 'GH₵ 1.3K', label: 'Raised' },
  ])
})

it('shows zero rather than stale or missing fields', () => {
  expect(profileStatTiles(null)).toEqual([
    { value: '0', label: 'Campaigns' },
    { value: 'GH₵ 0', label: 'Donated' },
    { value: 'GH₵ 0', label: 'Raised' },
  ])
  expect(formatMoneyByCurrency([{ currency: 'XOF', amount: 12.5 }, { currency: 'GHS', amount: 0 }])).toBe('XOF 12.50')
})
