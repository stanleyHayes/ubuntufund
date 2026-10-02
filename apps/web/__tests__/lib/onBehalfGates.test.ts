import { expect, it } from 'vitest'
import { changeConfirmation, consentExplanation, creationGateText, nextStepText } from '@/lib/onBehalf'

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

// What happens next comes from the server's rules, so the copy never promises
// that an acceptance publishes a campaign our team still has to check.
it('says what makes a campaign go live from here, and nothing during a content check', () => {
  expect(nextStepText('consent', 'Ama')).toBe('The campaign goes live as soon as Ama accepts.')
  expect(nextStepText('staff_after_consent', 'Ama')).toBe('When Ama accepts, our team checks the campaign before it goes live.')
  expect(nextStepText('staff', 'Ama')).toBe('Our team is checking the campaign before it goes live. We will let you know when it has been reviewed.')
  // The held invitation line already says the check comes first.
  expect(nextStepText('content_check', 'Ama')).toBeNull()
  // Declined, then back in review with its invitation withdrawn: the check waits for the organizer.
  expect(nextStepText('name_beneficiary', 'Ama')).toBe('Our team can finish checking the campaign once you name the beneficiary again.')
  expect(nextStepText(undefined, 'Ama')).toBeNull()
})

it('confirms a beneficiary change with what happens next', () => {
  expect(changeConfirmation({ invitationHeld: true, nextStep: 'content_check' }, 'Kofi')).toBe('Beneficiary updated. We will email Kofi an invitation once our team has checked the campaign.')
  expect(changeConfirmation({ invitationHeld: false, nextStep: 'consent' }, 'Kofi')).toBe('Beneficiary updated. We emailed Kofi an invitation. The campaign goes live when they accept.')
  expect(changeConfirmation({ invitationHeld: false, nextStep: 'staff_after_consent' }, 'Kofi')).toBe('Beneficiary updated. We emailed Kofi an invitation. When they accept, our team checks the campaign before it goes live.')
  expect(changeConfirmation({ invitationHeld: false, nextStep: 'staff' }, 'Kofi')).toBe('Beneficiary updated. We emailed Kofi an invitation. Our team checks the campaign before it goes live.')
  // An older API answered with no data.
  expect(changeConfirmation(null, 'Kofi')).toBe('Beneficiary updated. We emailed Kofi an invitation.')
})

it('never says an invitation that was withdrawn unsent is waiting for an answer', () => {
  expect(consentExplanation('pending', 'Ama', 'superseded')).toBe('No invitation is waiting for Ama. Change the beneficiary to send a new one.')
  // An ended campaign can no longer change its beneficiary, so it does not say to.
  expect(consentExplanation('pending', 'Ama', 'superseded', false)).toBe('No invitation is waiting for Ama.')
  expect(consentExplanation('pending', 'Ama', 'pending')).toBe('We emailed Ama an invitation. They have not answered yet.')
})
