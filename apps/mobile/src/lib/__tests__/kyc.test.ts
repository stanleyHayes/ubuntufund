import { describe, expect, it } from 'vitest'
import { buildKycSubmission, emptyKycDraft, validateKycStep } from '../kyc'
const draft = { ...emptyKycDraft, fullName: ' Ama Mensah ', dateOfBirth: '1995-02-03', nationality: 'Ghana', idNumber: 'GHA-123', city: 'Accra', gpsAddress: 'ga-123-4567', idFront: 'https://media.test/front.jpg', idBack: 'https://media.test/back.jpg', selfie: 'https://media.test/selfie.jpg' }
describe('native KYC submission contract', () => {
  it('submits entered identity, address and actual uploaded documents', () => {
    const body = buildKycSubmission(draft)
    expect(body.personalInfo).toMatchObject({ fullName: 'Ama Mensah', idNumber: 'GHA-123', dateOfBirth: '1995-02-03T00:00:00.000Z', address: { city: 'Accra', gpsAddress: 'GA-123-4567' } })
    expect(body.documents.map(d => d.url)).toEqual([draft.idFront, draft.idBack, draft.selfie])
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
