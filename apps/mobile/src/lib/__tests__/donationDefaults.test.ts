import { describe, expect, it } from 'vitest'
import { anonymousDonationDefaults } from '../donationDefaults'

// I081: the saved "anonymous by default" setting used to be ignored by the form.
describe('anonymous-by-default donation form', () => {
  it('selects anonymous and drops the pre-filled account name', () => {
    expect(anonymousDonationDefaults({ anonymousDonations: true }, { name: 'Ama Mensah', accountName: 'Ama Mensah', chosen: false }))
      .toEqual({ anonymous: true, name: '' })
  })
  it('keeps a name the donor typed themselves', () => {
    expect(anonymousDonationDefaults({ anonymousDonations: true }, { name: 'A friend', accountName: 'Ama Mensah', chosen: false }))
      .toEqual({ anonymous: true, name: 'A friend' })
  })
  it('changes nothing when the setting is off, unknown, or the donor already chose', () => {
    expect(anonymousDonationDefaults({ anonymousDonations: false }, { name: 'Ama', accountName: 'Ama', chosen: false })).toBeNull()
    expect(anonymousDonationDefaults(null, { name: 'Ama', accountName: 'Ama', chosen: false })).toBeNull()
    expect(anonymousDonationDefaults({ anonymousDonations: true }, { name: 'Ama', accountName: 'Ama', chosen: true })).toBeNull()
  })
})
