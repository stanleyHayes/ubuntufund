import { useCallback } from 'react'
import { View } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { usePublicRead } from '@/hooks/usePublicRead'
import { splitDisclosureText, validSplitDisclosure } from '@/lib/splitDisclosure'
import { usePalette } from '@/context/ColorModeContext'

/**
 * Donor-facing notice that the campaign's proceeds are split between named
 * beneficiaries, shown before a donor gives. Renders nothing when the campaign
 * has no active split or the disclosure cannot be read.
 */
export function SplitDisclosure({ campaignId }: { campaignId: string }) {
  const p = usePalette()
  const fetchDisclosure = useCallback(async () => validSplitDisclosure(await api.get<unknown>(`/campaigns/${encodeURIComponent(campaignId)}/split`)), [campaignId])
  const { data } = usePublicRead(`split:${campaignId}`, fetchDisclosure)
  if (!data) return null
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border }}>
      <Icon source="call-split" size={18} color={p.primary} />
      <Text style={{ flex: 1, color: p.text }}>{splitDisclosureText(data)}</Text>
    </View>
  )
}
