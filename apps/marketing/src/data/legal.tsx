import type { ReactNode } from 'react'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import CurrencyExchangeRoundedIcon from '@mui/icons-material/CurrencyExchangeRounded'
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded'
import CookieRoundedIcon from '@mui/icons-material/CookieRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'

import { LEGAL_POLICIES as policies, type LegalPolicy as Policy } from '@ubuntu-fund/types/src/legal'
export { LEGAL_ENTITY } from '@ubuntu-fund/types/src/legal'

export type LegalPolicy = Omit<Policy, 'icon'> & { icon: ReactNode }
const icons: Record<string, ReactNode> = {
  GavelRoundedIcon: <GavelRoundedIcon />,
  ShieldRoundedIcon: <ShieldRoundedIcon />,
  HandshakeRoundedIcon: <HandshakeRoundedIcon />,
  VolunteerActivismRoundedIcon: <VolunteerActivismRoundedIcon />,
  CurrencyExchangeRoundedIcon: <CurrencyExchangeRoundedIcon />,
  PolicyRoundedIcon: <PolicyRoundedIcon />,
  CookieRoundedIcon: <CookieRoundedIcon />,
  ReceiptLongRoundedIcon: <ReceiptLongRoundedIcon />,
}
export const LEGAL_POLICIES: LegalPolicy[] = policies.map(policy => ({ ...policy, icon: icons[policy.icon] }))
export function getPolicyBySlug(slug: string) { return LEGAL_POLICIES.find(policy => policy.slug === slug) }
