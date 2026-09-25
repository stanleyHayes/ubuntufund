import { expect, it } from 'vitest'
import { privacySettingPatch, privacySettingsFromProfile } from '../privacySettings'

it('sends publicProfile with the review consent only when making the profile public', () => {
  expect(privacySettingPatch('publicProfile', true, false)).toEqual({ publicProfile: true, automatedReviewConsent: false })
  expect(privacySettingPatch('publicProfile', true, true)).toEqual({ publicProfile: true, automatedReviewConsent: true })
  expect(privacySettingPatch('publicProfile', false, true)).toEqual({ publicProfile: false })
  expect(privacySettingPatch('showOnLeaderboard', false, true)).toEqual({ showLeaderboards: false })
  expect(privacySettingPatch('anonymousDonations', true, true)).toEqual({ anonymousDonations: true })
})

it('reads only the privacy fields the API stores, with its defaults', () => {
  expect(privacySettingsFromProfile(undefined)).toEqual({ anonymousDonations: false, showOnLeaderboard: true, publicProfile: true })
  expect(privacySettingsFromProfile({ anonymousDonations: true, showLeaderboards: false, publicProfile: false })).toEqual({ anonymousDonations: true, showOnLeaderboard: false, publicProfile: false })
})
