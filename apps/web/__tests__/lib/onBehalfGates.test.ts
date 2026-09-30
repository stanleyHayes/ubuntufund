import { expect, it } from 'vitest'
import { creationGateText } from '@/lib/onBehalf'

// The consent gates are admin settings, so the creation form must describe
// the ones a new campaign will actually get, and never promise a gate that is off.
it('describes the consent gates a new campaign gets', () => {
  expect(creationGateText({ publicationRequiresConsent: true, donationsRequireConsent: true }))
    .toBe('The beneficiary must accept before the campaign can go live or collect donations.')
  expect(creationGateText({ publicationRequiresConsent: true, donationsRequireConsent: false }))
    .toBe('The beneficiary must accept before the campaign can go live. Nothing is paid out until they do.')
  expect(creationGateText({ publicationRequiresConsent: false, donationsRequireConsent: true }))
    .toBe('The beneficiary must accept before the campaign can collect donations. Nothing is paid out until they do.')
  expect(creationGateText({ publicationRequiresConsent: false, donationsRequireConsent: false }))
    .toBe('The campaign can collect donations before the beneficiary accepts, but nothing is paid out until they do.')
})

it('reads unknown settings (an older API) as the strict default', () => {
  expect(creationGateText(undefined)).toBe('The beneficiary must accept before the campaign can go live or collect donations.')
  expect(creationGateText({})).toBe('The beneficiary must accept before the campaign can go live or collect donations.')
})
