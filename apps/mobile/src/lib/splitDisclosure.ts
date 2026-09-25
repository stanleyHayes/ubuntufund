import type { CampaignSplitDisclosure } from '@ubuntu-fund/types'

/** Accept only a disclosure that names at least one beneficiary with a share. */
export function validSplitDisclosure(value: unknown): CampaignSplitDisclosure | null {
  const disclosure = value as CampaignSplitDisclosure | null
  return disclosure && Array.isArray(disclosure.beneficiaries) && disclosure.beneficiaries.length > 0 &&
    disclosure.beneficiaries.every(b => typeof b.name === 'string' && Number.isFinite(b.sharePercent))
    ? disclosure : null
}

/** "This campaign's proceeds are shared: Ama 60%, Kofi 40%." */
export function splitDisclosureText(disclosure: CampaignSplitDisclosure): string {
  return `This campaign's proceeds are shared: ${disclosure.beneficiaries.map(b => `${b.name} ${Number(b.sharePercent.toFixed(2))}%`).join(', ')}.`
}
