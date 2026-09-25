import { expect, it } from 'vitest'
import { splitDisclosureText, validSplitDisclosure } from '../splitDisclosure'

const disclosure = { campaignId: 'c1', version: 1, locked: true, beneficiaries: [
  { name: 'Ama', shareBps: 6667, sharePercent: 66.67, consent: 'accepted' as const },
  { name: 'Kofi', shareBps: 3333, sharePercent: 33.33, consent: 'accepted' as const },
] }

it('names every beneficiary and share for donors', () => {
  expect(splitDisclosureText(disclosure)).toBe("This campaign's proceeds are shared: Ama 66.67%, Kofi 33.33%.")
})

it('shows nothing for a missing or malformed disclosure', () => {
  expect(validSplitDisclosure(null)).toBeNull()
  expect(validSplitDisclosure({ beneficiaries: [] })).toBeNull()
  expect(validSplitDisclosure({ beneficiaries: [{ name: 'Ama' }] })).toBeNull()
  expect(validSplitDisclosure(disclosure)).toBe(disclosure)
})
