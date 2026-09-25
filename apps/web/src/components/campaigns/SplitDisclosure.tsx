import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded'
import type { CampaignSplitDisclosure } from '@ubuntu-fund/types'
import { SHAPE } from '@ubuntu-fund/ui'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

/** "Ama 60%, Kofi 40%": whole or two-decimal percentages, as agreed in basis points. */
export function splitDisclosureText(disclosure: CampaignSplitDisclosure): string {
  const shares = disclosure.beneficiaries.map(b => `${b.name} ${Number(b.sharePercent.toFixed(2))}%`)
  return `This campaign's proceeds are shared: ${shares.join(', ')}.`
}

function validDisclosure(value: unknown): CampaignSplitDisclosure | null {
  const disclosure = value as CampaignSplitDisclosure | null
  return disclosure && Array.isArray(disclosure.beneficiaries) && disclosure.beneficiaries.length > 0 &&
    disclosure.beneficiaries.every(b => typeof b.name === 'string' && Number.isFinite(b.sharePercent))
    ? disclosure : null
}

/**
 * Donor-facing notice that the campaign's proceeds are split between named
 * beneficiaries. Shown before a donor gives; renders nothing when the
 * campaign has no active split or the disclosure cannot be read.
 */
export function SplitDisclosure({ campaignId, sx }: { campaignId: string; sx?: object }) {
  const { user } = useAuth()
  const scope = `${campaignId}:${user?.id ?? 'guest'}`
  const [state, setState] = useState<{ scope: string; disclosure: CampaignSplitDisclosure | null }>({ scope: '', disclosure: null })
  useEffect(() => {
    let cancelled = false
    api.get<unknown>(`/campaigns/${encodeURIComponent(campaignId)}/split`)
      .then(data => { if (!cancelled) setState({ scope, disclosure: validDisclosure(data) }) })
      .catch(() => { if (!cancelled) setState({ scope, disclosure: null }) })
    return () => { cancelled = true }
  }, [campaignId, scope])
  const disclosure = state.scope === scope ? state.disclosure : null
  if (!disclosure) return null
  return (
    <Alert severity="info" icon={<CallSplitRoundedIcon fontSize="inherit" />} sx={{ borderRadius: SHAPE.sm, ...sx }} data-testid="split-disclosure">
      {splitDisclosureText(disclosure)}
    </Alert>
  )
}
