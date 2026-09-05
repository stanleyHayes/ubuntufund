/** The campaign wallet endpoint accepts active, unexpired campaigns only. */
export function acceptsCampaignDonation(campaign: { status: string; endDate: Date | string } | null, now = Date.now()): boolean {
  return !!campaign && campaign.status === 'active' && new Date(campaign.endDate).getTime() > now
}

export function validWalletDonationAmount(value: string): boolean {
  const amount = Number(value)
  return value.trim() !== '' && Number.isFinite(amount) && amount > 0 && amount === Math.round(amount * 100) / 100
}

/** Enabled providers are not necessarily implemented by the wallet endpoint. */
export function walletDonationProviders<T extends { type: string; slug: string }>(providers: T[]): T[] {
  return providers.filter((provider) => provider.type === 'wallet' && provider.slug === 'wallet')
}
