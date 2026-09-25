/**
 * Applies a signed-in donor's "Make my donations anonymous by default" setting
 * to a fresh donation form. Returns the form fields to change, or null when the
 * setting is off or the donor has already made a choice for this donation.
 * The account name pre-filled into "Name (optional)" is cleared too, so an
 * anonymous-by-default donor never posts it by accident.
 */
export function anonymousDonationDefaults(
  profile: { anonymousDonations?: boolean } | null | undefined,
  form: { name: string; accountName?: string; chosen: boolean },
): { anonymous: true; name: string } | null {
  if (form.chosen || profile?.anonymousDonations !== true) return null
  return { anonymous: true, name: form.name === (form.accountName ?? '') ? '' : form.name }
}
