import { describe, expect, it } from 'vitest'
import type { CampaignViewerAccess } from '@ubuntu-fund/types'
import {
  beneficiaryPayoutLine,
  canOpenManagement,
  canThankDonors,
  cashoutConfirmPrompt,
  consentLabel,
  hasPayoutAuthority,
  payoutNote,
} from '../onBehalf'

const access = (fields: Partial<CampaignViewerAccess> = {}): CampaignViewerAccess => ({ manage: false, beneficiary: false, payoutAuthority: false, thankDonors: false, ...fields })
const onBehalf = (beneficiaryConfirmed: boolean) => ({ beneficiaryName: 'Kofi Boateng', beneficiaryType: 'individual' as const, beneficiaryConfirmed })

describe('payout authority, not ownership, unlocks cashout', () => {
  it('follows the server when it says who may request payouts', () => {
    // The organizer of a campaign run for someone else manages it but cannot withdraw.
    expect(hasPayoutAuthority({ creatorId: 'org', viewerAccess: access({ manage: true }) }, 'org')).toBe(false)
    expect(hasPayoutAuthority({ creatorId: 'org', viewerAccess: access({ beneficiary: true, payoutAuthority: true }) }, 'kofi')).toBe(true)
  })

  it('falls back to the creator only when the API sent no viewer access', () => {
    expect(hasPayoutAuthority({ creatorId: 'ama' }, 'ama')).toBe(true)
    expect(hasPayoutAuthority({ creatorId: 'ama' }, 'kofi')).toBe(false)
    expect(hasPayoutAuthority({ creatorId: 'ama' }, undefined)).toBe(false)
  })

  it('opens management to the owner, co-managers, the payout authority and a consenting beneficiary', () => {
    expect(canOpenManagement({ creatorId: 'ama' }, 'ama')).toBe(true)
    expect(canOpenManagement({ creatorId: 'org', viewerAccess: access({ manage: true }) }, 'editor')).toBe(true)
    expect(canOpenManagement({ creatorId: 'org', viewerAccess: access({ beneficiary: true, thankDonors: true }) }, 'kofi')).toBe(true)
    expect(canOpenManagement({ creatorId: 'org', viewerAccess: access() }, 'donor')).toBe(false)
    expect(canOpenManagement({ creatorId: 'org' }, 'donor')).toBe(false)
    expect(canOpenManagement({ creatorId: 'org' }, null)).toBe(false)
  })

  it('shows the thank-you entry only when the server allows it', () => {
    expect(canThankDonors({ viewerAccess: access({ thankDonors: true }) })).toBe(true)
    expect(canThankDonors({ viewerAccess: access({ manage: true }) })).toBe(false)
    expect(canThankDonors({})).toBe(false)
  })
})

describe('read-only payout note for managers without payout authority', () => {
  it('explains a self-created campaign', () => {
    expect(payoutNote({})).toBe('Only the campaign owner’s account can request payouts.')
  })

  it('uses the public summary when the beneficiary details are unavailable', () => {
    expect(payoutNote({ onBehalf: onBehalf(false) })).toBe('Payouts go to the beneficiary after they accept.')
    expect(payoutNote({ onBehalf: onBehalf(true) })).toBe('Payouts go to the account the beneficiary agreed to.')
  })

  it('follows the consent and payout authority from the beneficiary details', () => {
    const summary = { onBehalf: onBehalf(false) }
    expect(payoutNote(summary, { consentStatus: 'pending', payoutArrangement: 'beneficiary', payoutAuthority: 'none' })).toBe('Payouts go to the beneficiary after they accept.')
    expect(payoutNote(summary, { consentStatus: 'expired', payoutArrangement: 'organization', payoutAuthority: 'none' })).toBe('Payouts start after the beneficiary accepts.')
    expect(payoutNote(summary, { consentStatus: 'declined', payoutArrangement: 'beneficiary', payoutAuthority: 'none' })).toBe('Payouts are paused.')
    expect(payoutNote(summary, { consentStatus: 'revoked', payoutArrangement: 'beneficiary', payoutAuthority: 'none' })).toBe('Payouts are paused.')
    expect(payoutNote(summary, { consentStatus: 'accepted', payoutArrangement: 'beneficiary', payoutAuthority: 'beneficiary' })).toBe('Payouts go to the beneficiary.')
    expect(payoutNote(summary, { consentStatus: 'accepted', payoutArrangement: 'organization', payoutAuthority: 'organization' })).toBe('Payouts go to the organization account that runs this campaign.')
    // Staff paused payouts after acceptance.
    expect(payoutNote(summary, { consentStatus: 'accepted', payoutArrangement: 'beneficiary', payoutAuthority: 'none' })).toBe('Payouts are paused.')
  })
})

describe('consent wording', () => {
  it('speaks to the manager or to the beneficiary', () => {
    expect(consentLabel('pending', 'manager')).toBe('Waiting for the beneficiary to accept')
    expect(consentLabel('pending', 'beneficiary')).toBe('Waiting for your answer')
    expect(consentLabel('accepted', 'beneficiary')).toBe('You accepted this campaign')
    expect(consentLabel('revoked', 'manager')).toBe('The beneficiary withdrew their consent')
  })

  it('tells the beneficiary where payouts go', () => {
    const item = { organizerName: 'Hope Clinic', payoutArrangement: 'beneficiary' as const }
    expect(beneficiaryPayoutLine({ ...item, consentStatus: 'accepted', payoutAuthority: true })).toBe('Payouts come to you.')
    expect(beneficiaryPayoutLine({ ...item, consentStatus: 'accepted', payoutAuthority: false, payoutArrangement: 'organization' })).toBe('You agreed that payouts go to Hope Clinic.')
    expect(beneficiaryPayoutLine({ ...item, consentStatus: 'pending', payoutAuthority: false })).toBe('Accept or decline from the invitation email.')
    expect(beneficiaryPayoutLine({ ...item, consentStatus: 'revoked', payoutAuthority: false })).toBe('Payouts are paused.')
  })
})

describe('cashout confirmation on a campaign run for someone else', () => {
  it('names the beneficiary next to the destination account and the amounts', () => {
    const prompt = cashoutConfirmPrompt({ beneficiaryName: 'Kofi Boateng', destination: 'paystack', recipient: { accountName: 'Kofi Boateng', last4: '4567' }, amount: 100, receive: 98.5 })
    expect(prompt.title).toBe('Request this cashout?')
    expect(prompt.message).toContain('Funds raised for Kofi Boateng.')
    expect(prompt.message).toContain('Paid to: Kofi Boateng · ending 4567.')
    expect(prompt.message).toContain('Amount GHS 100.00 · you receive GHS 98.50.')
    expect(prompt.confirmLabel).toBe('Request cashout')
  })

  it('names the wallet when funds go to the Ujimora Wallet', () => {
    expect(cashoutConfirmPrompt({ beneficiaryName: 'Kofi', destination: 'ujimora_wallet', recipient: null, amount: 10, receive: 10 }).message).toContain('Paid to: your Ujimora Wallet.')
  })
})
