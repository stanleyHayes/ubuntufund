/** The privacy toggles native Settings shows, as GET /profile returns them. */
export interface PrivacySettings {
  anonymousDonations: boolean
  showOnLeaderboard: boolean
  publicProfile: boolean
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  anonymousDonations: false,
  showOnLeaderboard: true,
  // Matches the API default for accounts without a saved profile.
  publicProfile: true,
}

export function privacySettingsFromProfile(data: { anonymousDonations?: boolean; showLeaderboards?: boolean; publicProfile?: boolean } | null | undefined): PrivacySettings {
  return {
    anonymousDonations: data?.anonymousDonations ?? DEFAULT_PRIVACY_SETTINGS.anonymousDonations,
    showOnLeaderboard: data?.showLeaderboards ?? DEFAULT_PRIVACY_SETTINGS.showOnLeaderboard,
    publicProfile: data?.publicProfile ?? DEFAULT_PRIVACY_SETTINGS.publicProfile,
  }
}

/**
 * The PUT /profile body for one toggle. Making the profile public is a
 * publication: it carries the optional automated-review consent, and the API may
 * answer 409 when it is held for safety review. Hiding it needs no review.
 */
export function privacySettingPatch<K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K], automatedReviewConsent: boolean): Record<string, unknown> {
  if (key === 'showOnLeaderboard') return { showLeaderboards: value }
  if (key === 'publicProfile') return { publicProfile: value, ...(value ? { automatedReviewConsent } : {}) }
  return { [key]: value }
}
