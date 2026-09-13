import { describe, expect, it } from 'vitest'
import { buildKycSubmission, changeKycIdentityType, emptyKycDraft, validateKycStep } from '../kyc'
const draft = { ...emptyKycDraft, fullName: ' Ama Mensah ', dateOfBirth: '1995-02-03', nationality: 'Ghana', idNumber: 'GHA-123', city: 'Accra', gpsAddress: 'ga-123-4567', idFront: 'https://media.test/front.jpg', idBack: 'https://media.test/back.jpg', selfie: 'https://media.test/selfie.jpg' }
describe('native KYC submission contract', () => {
  it('keeps an underage or invalid birth date on the identity step', () => {
    const birth = new Date()
    birth.setUTCFullYear(birth.getUTCFullYear() - 17)
    expect(validateKycStep({ ...draft, dateOfBirth: birth.toISOString().slice(0, 10) }, 0)).toMatch(/at least 18/)
    expect(validateKycStep({ ...draft, dateOfBirth: '2000-02-30' }, 0)).toMatch(/valid date/)
  })
  it('submits entered identity, address and actual uploaded documents', () => {
    const body = buildKycSubmission(draft)
    expect(body.personalInfo).toMatchObject({ fullName: 'Ama Mensah', idNumber: 'GHA-123', dateOfBirth: '1995-02-03T00:00:00.000Z', address: { city: 'Accra', gpsAddress: 'GA-123-4567' } })
    expect(body.documents.map(d => d.url)).toEqual([draft.idFront, draft.idBack, draft.selfie])
    expect(body.documents).toContainEqual({ type: 'selfie', url: draft.selfie })
    expect(body.documents.some(d => d.type === 'passport')).toBe(false)
  })
  it('requires the selected document proof, excludes old GPS and rejects non-Ghana GPS', () => {
    expect(validateKycStep({ ...draft, country: 'Nigeria' }, 2)).not.toBeNull()
    expect(() => buildKycSubmission({ ...draft, proofMethod: 'document', street: 'Main Road' })).toThrow(/upload/)
    const body = buildKycSubmission({ ...draft, proofMethod: 'document', street: 'Main Road', addressDoc: 'https://media.test/bill.pdf' })
    expect(body.personalInfo.address).not.toHaveProperty('gpsAddress')
    expect(body.documents).toContainEqual({ type: 'utility_bill', url: 'https://media.test/bill.pdf' })
  })
  it('rejects incomplete identity and missing uploads before submission', () => {
    expect(() => buildKycSubmission(emptyKycDraft)).toThrow()
    expect(validateKycStep({ ...draft, idBack: '' }, 1)).not.toBeNull()
    expect(validateKycStep({ ...draft, selfie: '' }, 3)).not.toBeNull()
  })
})

it('uses the passport photo page only and clears old evidence when the identity type changes', () => {
  const changed = changeKycIdentityType(draft, 'passport')
  expect(changed).toMatchObject({ identityDocumentType: 'passport', idFront: '', idBack: '', selfie: '' })
  expect(validateKycStep(changed, 1)).toContain('photo page')
  const complete = { ...changed, idFront: draft.idFront, idBack: 'unused-old-back', selfie: draft.selfie }
  expect(buildKycSubmission(complete).documents).toEqual([{ type: 'passport', url: draft.idFront }, { type: 'selfie', url: draft.selfie }])
  expect(changeKycIdentityType(complete, 'passport')).toBe(complete)
  const driving = { ...draft, identityDocumentType: 'drivers_license' as const }
  expect(buildKycSubmission(driving).documents.slice(0, 2).map(item => item.type)).toEqual(['drivers_license', 'drivers_license'])
})
