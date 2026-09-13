import { expect, it } from 'vitest'
import { buildOrganizationKyc, emptyOrganizationKyc } from '../organizationKyc'
const fixture = () => ({ ...emptyOrganizationKyc(), businessName: 'Synthetic charity', registrationNumber: 'REG-SYNTHETIC', businessType: 'Charity', street: 'Synthetic street', city: 'Accra', fullName: 'Representative', dateOfBirth: '1990-01-01', idNumber: 'ID-SYNTHETIC', representativeCapacity: 'Director', ownershipExplanation: 'The declared trustees control this organization.', controllers: [{ fullName: 'Trustee', role: 'trustee', country: 'Ghana', ownershipPercent: '' }], authorized: true, accurate: true, registration: 'kyc://000000000000000000000001', authorization: 'kyc://000000000000000000000002', identity: 'kyc://000000000000000000000003' })
it('maps private organization evidence and optional ownership without inventing a percentage', () => {
  const payload = buildOrganizationKyc(fixture())
  expect(payload.documents.map(doc => doc.type)).toEqual(['business_registration', 'authorization_letter', 'id_card'])
  expect(payload.businessInfo.controlPersons).toEqual([{ fullName: 'Trustee', role: 'trustee', country: 'Ghana' }])
  expect(payload.personalInfo.dateOfBirth).toBe('1990-01-01T00:00:00.000Z')
  expect(payload.declaration).toEqual({ authorized: true, accurate: true })
  expect(buildOrganizationKyc({ ...fixture(), identityType: 'passport' }).documents[2].type).toBe('passport')
})
it('rejects missing declarations, underage identity and public evidence', () => {
  for (const overrides of [{ authorized: false }, { accurate: false }, { dateOfBirth: '2020-01-01' }, { identity: 'https://example.com/public-id.jpg' }, { authorization: '' }, { street: '' }, { ownershipExplanation: 'too short' }]) expect(() => buildOrganizationKyc({ ...fixture(), ...overrides })).toThrow()
  expect(emptyOrganizationKyc().authorized).toBe(false)
  expect(emptyOrganizationKyc().accurate).toBe(false)
})
it('requires controlling-person details and validates optional percentages', () => {
  expect(() => buildOrganizationKyc({ ...fixture(), controllers: [] })).toThrow()
  for (const percentage of ['NaN', '-1', '101']) expect(() => buildOrganizationKyc({ ...fixture(), controllers: [{ ...fixture().controllers[0], ownershipPercent: percentage }] })).toThrow()
  expect(buildOrganizationKyc({ ...fixture(), controllers: [{ ...fixture().controllers[0], ownershipPercent: '25.5' }] }).businessInfo.controlPersons[0].ownershipPercent).toBe(25.5)
})
