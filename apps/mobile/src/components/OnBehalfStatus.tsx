import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import type { CampaignBeneficiaryDetails, CampaignOnBehalfSummary } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { usePalette } from '@/context/ColorModeContext'
import { GlassSurface } from './GlassSurface'
import { consentLabel, payoutNote } from '@/lib/onBehalf'

function formatDate(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

/**
 * Read-only beneficiary status for a campaign run on someone's behalf, on the
 * Manage screen. Changing the beneficiary or resending the invitation stays on
 * the web in v1.
 */
export function OnBehalfStatus({ campaignId, summary, payoutAuthority }: { campaignId: string; summary: CampaignOnBehalfSummary; payoutAuthority: boolean }) {
  const p = usePalette()
  const [details, setDetails] = useState<CampaignBeneficiaryDetails | null>(null)
  useEffect(() => {
    let active = true
    api.get<CampaignBeneficiaryDetails>(`/campaigns/${encodeURIComponent(campaignId)}/beneficiary`)
      .then(value => { if (active) setDetails(value) })
      // The public summary still gives the consent state and a payout note.
      .catch(() => {})
    return () => { active = false }
  }, [campaignId])
  const beneficiaryView = !!details?.viewer?.beneficiary && !details.viewer.manager
  const consent = details ? consentLabel(details.consentStatus, beneficiaryView ? 'beneficiary' : 'manager')
    : summary.beneficiaryConfirmed ? 'Accepted by the beneficiary' : 'Waiting for the beneficiary to accept'
  const invitation = details?.invitationEmailHint && (details.invitationStatus === 'pending' || details.invitationStatus === 'expired')
    ? `Invitation sent to ${details.invitationEmailHint}${details.invitationExpiresAt ? ` · ${details.invitationStatus === 'expired' ? 'expired' : 'expires'} ${formatDate(details.invitationExpiresAt)}` : ''}`
    : ''
  const payout = payoutAuthority ? beneficiaryView ? 'Payouts come to you.' : 'You can request payouts for this campaign.' : payoutNote({ onBehalf: summary }, details)
  return <GlassSurface style={{ padding: 20, borderRadius: 24, gap: 12 }}>
    <Text variant="titleLarge">Beneficiary</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon source="hand-heart-outline" size={20} color={p.primary} />
      <Text style={{ flex: 1, color: p.text, fontFamily: 'Outfit_700Bold' }}>On behalf of {summary.beneficiaryName}</Text>
    </View>
    <Text style={{ color: p.text }}>{consent}</Text>
    {invitation ? <Text style={{ color: p.textSecondary }}>{invitation}</Text> : null}
    <Text style={{ color: p.textSecondary }}>{payout}</Text>
    {details?.canResendInvitation || details?.canChangeBeneficiary ? <Text style={{ color: p.textSecondary }}>To resend the invitation or change the beneficiary, use ujimora.com.</Text> : null}
  </GlassSurface>
}
