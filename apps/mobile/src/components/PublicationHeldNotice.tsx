import { useEffect } from 'react'
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import { router } from 'expo-router'
import { usePalette } from '@/context/ColorModeContext'
import { Button } from './Loading'

/**
 * Shown when the API held a public change for safety review (see
 * `isPublicationHeld`). Being held is an expected step, not a failure, so this
 * uses the app's neutral info-banner style, never the error color.
 *
 * `reviews` says where the Publication reviews list is: on this screen
 * (`above` / `below`) or in Settings. `openSettings` adds a button to it; the
 * current screen stays in the stack, so its draft is kept.
 */
export function PublicationHeldNotice({ retry = 'submit it again unchanged', reviews = 'settings', openSettings = false, style }: {
  /** What to do after approval, completing "After a reviewer approves it, …". */
  retry?: string
  reviews?: 'above' | 'below' | 'settings'
  openSettings?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const p = usePalette()
  // A live region that arrives already holding its text is not announced
  // (TalkBack), and VoiceOver ignores live regions, so announce on mount.
  // Queued so VoiceOver does not drop it while re-reading the submit button.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibilityWithOptions('Waiting for safety review. Saved privately; this version is not public yet.', { queue: true })
  }, [])
  const where = reviews === 'settings' ? 'Check Settings → Publication reviews for the decision.' : `Check Publication reviews ${reviews} for the decision.`
  return <View accessibilityLiveRegion="polite" style={[{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, backgroundColor: `${p.primary}0F` }, style]}>
    <Icon source="clock-outline" size={20} color={p.primary} />
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: p.text, fontFamily: 'Outfit_700Bold' }}>Waiting for safety review</Text>
      <Text style={{ color: p.text, lineHeight: 19 }}>Saved privately for safety review. This version is not public yet. After a reviewer approves it, {retry} to publish it. {where}</Text>
      {openSettings && <Button compact style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/settings')}>Open Publication reviews</Button>}
    </View>
  </View>
}
